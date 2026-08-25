package plugin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/araddon/dateparse"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	backendlog "github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordedLogEntry struct {
	message string
	args    []interface{}
}

type recordingLogger struct {
	backendlog.Logger
	errors []recordedLogEntry
}

func (logger *recordingLogger) Error(message string, args ...interface{}) {
	logger.errors = append(logger.errors, recordedLogEntry{
		message: message,
		args:    append([]interface{}(nil), args...),
	})
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestNewDatasourceTLSSettings(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":[["3.3.0.0"]]}`))
	})}}
	server.StartTLS()
	t.Cleanup(server.Close)

	caCertificate := string(pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: server.Certificate().Raw,
	}))

	tests := []struct {
		name           string
		jsonData       string
		secureJSONData map[string]string
		wantErr        bool
	}{
		{
			name:     "certificate verification remains enabled by default",
			jsonData: `{}`,
			wantErr:  true,
		},
		{
			name:     "skip verification is opt in",
			jsonData: `{"tlsSkipVerify":true}`,
		},
		{
			name:     "custom CA verifies the server certificate",
			jsonData: `{"tlsAuthWithCACert":true}`,
			secureJSONData: map[string]string{
				"tlsCACert": caCertificate,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instance, err := NewDatasource(context.Background(), backend.DataSourceInstanceSettings{
				URL:                     server.URL,
				JSONData:                json.RawMessage(tt.jsonData),
				DecryptedSecureJSONData: tt.secureJSONData,
			})
			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, instance)
			instance.(interface{ Dispose() }).Dispose()
		})
	}
}

func TestNewDatasourceRedactsTokenFromTLSError(t *testing.T) {
	const token = "tdengine-super-secret-token"

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":[["3.3.0.0"]]}`))
	})}}
	server.StartTLS()
	t.Cleanup(server.Close)

	_, err = NewDatasource(context.Background(), backend.DataSourceInstanceSettings{
		URL: server.URL,
		DecryptedSecureJSONData: map[string]string{
			"token": token,
		},
	})

	require.Error(t, err)
	assert.NotContains(t, err.Error(), token)
	assert.Contains(t, err.Error(), "certificate")
}

func TestDoHTTPPostRedactsMalformedEndpoint(t *testing.T) {
	const password = "tdengine-super-secret-password"
	const querySecret = "tdengine-super-secret-query"
	endpoint := "https://root:" + password + "@example.com/%zz?key=" + querySecret
	datasource := &Datasource{}

	_, err := datasource.doHttpPost(context.Background(), endpoint, "select 1")

	require.Error(t, err)
	assert.NotContains(t, err.Error(), password)
	assert.NotContains(t, err.Error(), querySecret)
	assert.Contains(t, err.Error(), "invalid URL escape")
}

func TestDoHTTPPostDoesNotLogQueryOnRequestConstructionErrors(t *testing.T) {
	const query = "select 'tdengine-super-secret-query'"
	tests := []struct {
		name            string
		ctx             context.Context
		endpoint        string
		expectedMessage string
	}{
		{
			name:            "malformed endpoint",
			ctx:             context.Background(),
			endpoint:        "https://example.com/%zz",
			expectedMessage: "parse query endpoint failed",
		},
		{
			name:            "nil request context",
			ctx:             nil,
			endpoint:        "https://example.com",
			expectedMessage: "create query request failed",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			logger := &recordingLogger{Logger: backendlog.NewNullLogger()}
			originalLogger := backendlog.DefaultLogger
			backendlog.DefaultLogger = logger
			t.Cleanup(func() {
				backendlog.DefaultLogger = originalLogger
			})

			datasource := &Datasource{}
			_, err := datasource.doHttpPost(test.ctx, test.endpoint, query)

			require.Error(t, err)
			require.Len(t, logger.errors, 1)
			assert.Equal(t, test.expectedMessage, logger.errors[0].message)
			assert.NotContains(t, logger.errors[0].args, "data")
			assert.NotContains(t, logger.errors[0].args, query)
		})
	}
}

func TestQueryErrorsDoNotExposeSQL(t *testing.T) {
	const sql = "select 'tdengine-super-secret-query'"
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       []string
	}{
		{
			name:       "unauthorized",
			statusCode: http.StatusUnauthorized,
			body:       `{"code":855,"desc":"Authentication failure"}`,
			want:       []string{"401", "855", "Authentication failure"},
		},
		{
			name:       "server error",
			statusCode: http.StatusInternalServerError,
			body:       `{"code":1,"desc":"Internal error"}`,
			want:       []string{"500", "1", "Internal error"},
		},
		{
			name:       "TDengine business error",
			statusCode: http.StatusOK,
			body:       `{"code":9728,"desc":"Invalid operation"}`,
			want:       []string{"9728", "Invalid operation"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(test.statusCode)
				_, _ = w.Write([]byte(test.body))
			}))
			t.Cleanup(server.Close)

			logger := &recordingLogger{Logger: backendlog.NewNullLogger()}
			originalLogger := backendlog.DefaultLogger
			backendlog.DefaultLogger = logger
			t.Cleanup(func() { backendlog.DefaultLogger = originalLogger })

			queryJSON, err := json.Marshal(map[string]string{"queryType": "SQL", "sql": sql})
			require.NoError(t, err)
			datasource := &Datasource{client: server.Client(), endpoint: server.URL}
			response := datasource.query(context.Background(), backend.PluginContext{}, backend.DataQuery{JSON: queryJSON})

			require.Error(t, response.Error)
			assert.NotContains(t, response.Error.Error(), sql)
			for _, expected := range test.want {
				assert.Contains(t, response.Error.Error(), expected)
			}
			require.NotEmpty(t, logger.errors)
			for _, entry := range logger.errors {
				assert.NotContains(t, fmt.Sprint(entry.args...), sql)
			}
		})
	}
}

func TestDoHTTPPostLimitsErrorResponseBody(t *testing.T) {
	const expectedLimit = 64 * 1024
	payload := strings.Repeat("x", expectedLimit*2)
	reader := strings.NewReader(payload)
	datasource := &Datasource{client: &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Status:     "500 Internal Server Error",
			Header:     make(http.Header),
			Body:       io.NopCloser(reader),
			Request:    request,
		}, nil
	})}}

	_, err := datasource.doHttpPost(context.Background(), "http://tdengine.invalid/rest/sql", "select 1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "500")
	assert.Equal(t, expectedLimit+1, len(payload)-reader.Len())
}

func TestNewDatasourceUsesLegacyBasicAuth(t *testing.T) {
	const username = "root"
	const password = "taosdata"
	var authenticated bool

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUsername, gotPassword, ok := r.BasicAuth()
		if !ok || gotUsername != username || gotPassword != password {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"code":855,"desc":"Authentication failure"}`))
			return
		}

		authenticated = true
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":[["3.3.0.0"]]}`))
	})}}
	server.Start()
	t.Cleanup(server.Close)

	legacyBasicAuth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	instance, err := NewDatasource(context.Background(), backend.DataSourceInstanceSettings{
		URL: server.URL,
		DecryptedSecureJSONData: map[string]string{
			"basicAuth": legacyBasicAuth,
		},
	})

	require.NoError(t, err)
	require.NotNil(t, instance)
	instance.(interface{ Dispose() }).Dispose()
	assert.True(t, authenticated)
}

func TestNewDatasourceRejectsRedirectsForQueryAndHealthCheck(t *testing.T) {
	const username = "root"
	const password = "taosdata"
	var redirectedRequests atomic.Int32

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		redirectedRequests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":[["unexpected redirect"]]}`))
	}))
	t.Cleanup(target.Close)

	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if string(body) == "select server_version()" {
			gotUsername, gotPassword, ok := r.BasicAuth()
			if !ok || gotUsername != username || gotPassword != password {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"code":0,"data":[["3.3.0.0"]]}`))
			return
		}
		http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
	}))
	t.Cleanup(source.Close)

	encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	instance, err := NewDatasource(context.Background(), backend.DataSourceInstanceSettings{
		URL: source.URL,
		DecryptedSecureJSONData: map[string]string{
			"basicAuth": encoded,
		},
	})
	require.NoError(t, err)
	t.Cleanup(func() { instance.(interface{ Dispose() }).Dispose() })

	datasource := instance.(*Datasource)
	_, err = datasource.queryDataFromDatasource(context.Background(), &queryModel{Sql: "select 1"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "307")

	health, err := datasource.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, health.Status)
	assert.Contains(t, health.Message, "307")
	assert.Zero(t, redirectedRequests.Load())
}

func TestNewDatasourceReturnsTDengineErrorWhenVersionQueryFails(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":855,"desc":"Authentication failure"}`))
	})}}
	server.Start()
	t.Cleanup(server.Close)

	_, err = NewDatasource(context.Background(), backend.DataSourceInstanceSettings{URL: server.URL})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "Authentication failure")
	assert.NotContains(t, err.Error(), "unsupported protocol scheme")
}

func TestCheckHealthIncludesTDengineDescription(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":855,"desc":"Authentication failure"}`))
	})}}
	server.Start()
	t.Cleanup(server.Close)

	datasource := &Datasource{
		client:   server.Client(),
		endpoint: server.URL,
	}
	result, err := datasource.CheckHealth(context.Background(), &backend.CheckHealthRequest{})

	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "Authentication failure")
}

func TestCheckHealthIncludesTDengineDescriptionFromHTTPError(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":855,"desc":"Authentication failure"}`))
	})}}
	server.Start()
	t.Cleanup(server.Close)

	datasource := &Datasource{
		client:   server.Client(),
		endpoint: server.URL,
	}
	result, err := datasource.CheckHealth(context.Background(), &backend.CheckHealthRequest{})

	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "Authentication failure")
}

type dateTest struct {
	in, out string
	err     bool
}

func TestParseLayout(t *testing.T) {

	time.Local = time.UTC
	var testParseFormat = []dateTest{
		{in: "2009-08-12T22:15Z", out: "2006-01-02T15:04Z"},
		{in: "2006-01-02T15:04:05.000Z", out: "2006-01-02T15:04:05.000Z"},
		{in: "2006-01-02T15:04:05.000000Z", out: "2006-01-02T15:04:05.000000Z"},
		{in: "2006-01-02T15:04:05.000000000Z", out: "2006-01-02T15:04:05.000000000Z"},

		{in: "2009-08-12T22:15:09+08:00", out: "2006-01-02T15:04:05-07:00"},
		{in: "2009-08-12T22:15:09.123-07:00", out: "2006-01-02T15:04:05.000-07:00"},
		{in: "2009-08-12T22:15:09.123456-07:00", out: "2006-01-02T15:04:05.000000-07:00"},
		{in: "2009-08-12T22:15:09.123456789-07:00", out: "2006-01-02T15:04:05.000000000-07:00"},

		{in: "2009-08-12T22:15:09-0700", out: "2006-01-02T15:04:05-0700"},
		{in: "2009-08-12T22:15:09.123-0700", out: "2006-01-02T15:04:05.000-0700"},
		{in: "2009-08-12T22:15:09.123456-0700", out: "2006-01-02T15:04:05.000000-0700"},
		{in: "2009-08-12T22:15:09.123456789-0700", out: "2006-01-02T15:04:05.000000000-0700"},
	}

	for _, th := range testParseFormat {
		l, err := dateparse.ParseFormat(th.in)
		if th.err {
			assert.NotEqual(t, nil, err)
		} else {
			assert.Equal(t, nil, err)
			assert.Equal(t, th.out, l, "for in=%v", th.in)
		}
	}
}

// TestDetermineFrameType tests Frame format detection logic
func TestDetermineFrameType(t *testing.T) {
	tests := []struct {
		name     string
		fields   []*data.Field
		expected data.FrameType
	}{
		{
			name: "TimeSeriesWide - has time column, numeric columns, no string columns",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("value", nil, []float64{}),
			},
			expected: data.FrameTypeTimeSeriesWide,
		},
		{
			name: "TimeSeriesWide - has time column, multiple numeric columns, no string columns",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("value1", nil, []float64{}),
				data.NewField("value2", nil, []float64{}),
			},
			expected: data.FrameTypeTimeSeriesWide,
		},
		{
			name: "TimeSeriesLong - has time column, numeric column, string column (dimension)",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("value", nil, []float64{}),
				data.NewField("device", nil, []string{}),
			},
			expected: data.FrameTypeTimeSeriesLong,
		},
		{
			name: "TimeSeriesLong - has time column, numeric column, bool column (dimension)",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("value", nil, []float64{}),
				data.NewField("active", nil, []bool{}),
			},
			expected: data.FrameTypeTimeSeriesLong,
		},
		{
			name: "TimeSeriesLong - has time column, numeric column, multiple string columns (multiple dimensions)",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("value", nil, []float64{}),
				data.NewField("device", nil, []string{}),
				data.NewField("location", nil, []string{}),
			},
			expected: data.FrameTypeTimeSeriesLong,
		},
		{
			name: "Table - has time column and string columns but no numeric columns",
			fields: []*data.Field{
				data.NewField("time", nil, []time.Time{}),
				data.NewField("status", nil, []string{}),
			},
			expected: data.FrameTypeTable,
		},
		{
			name: "NumericWide - no time column, only numeric columns",
			fields: []*data.Field{
				data.NewField("avg_value", nil, []float64{}),
				data.NewField("max_value", nil, []float64{}),
			},
			expected: data.FrameTypeNumericWide,
		},
		{
			name: "NumericWide - no time column, integer column",
			fields: []*data.Field{
				data.NewField("count", nil, []int64{}),
			},
			expected: data.FrameTypeNumericWide,
		},
		{
			name: "Table - no time column, no numeric columns, only string columns",
			fields: []*data.Field{
				data.NewField("name", nil, []string{}),
				data.NewField("description", nil, []string{}),
			},
			expected: data.FrameTypeTable,
		},
		{
			name:     "Table - empty field list",
			fields:   []*data.Field{},
			expected: data.FrameTypeTable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := determineFrameType(tt.fields)
			assert.Equal(t, tt.expected, result, "Frame type mismatch for: %s", tt.name)
		})
	}
}

// TestFrameMetaInResponse tests that Frame Meta is correctly set
func TestFrameMetaInResponse(t *testing.T) {
	// Create a Frame with time, numeric, and string (dimension) columns
	// This should be identified as TimeSeriesLong format
	frame := data.NewFrame("")
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("value", nil, []float64{}),
		data.NewField("device", nil, []string{}), // dimension column
	)

	// Set Meta
	frame.Meta = &data.FrameMeta{
		Type:        determineFrameType(frame.Fields),
		TypeVersion: data.FrameTypeVersion{0, 1},
	}

	// Verify Meta type
	require.NotNil(t, frame.Meta)
	assert.Equal(t, data.FrameTypeTimeSeriesLong, frame.Meta.Type)
	assert.Equal(t, data.FrameTypeVersion{0, 1}, frame.Meta.TypeVersion)

	// Verify Frame is time series type
	assert.True(t, frame.Meta.Type.IsTimeSeries())
}

func TestDetermineFrameType_TimeAndStringOnlyIsTable(t *testing.T) {
	frame := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)}),
		data.NewField("status", nil, []string{"running"}),
	)

	tsSchema := frame.TimeSeriesSchema()
	metaType := determineFrameType(frame.Fields)

	assert.Equal(t, data.TimeSeriesTypeNot, tsSchema.Type)
	assert.Equal(t, data.FrameTypeTable, metaType)
}

// TestGetQueryModel tests query model parsing and SQL macro replacement
func TestGetQueryModel(t *testing.T) {
	fromTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	toTime := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)

	tests := []struct {
		name        string
		json        map[string]interface{}
		interval    time.Duration
		expectOK    bool
		expectSQL   string
		expectError string
	}{
		{
			name: "valid SQL with macros",
			json: map[string]interface{}{
				"sql":       "SELECT * FROM test WHERE ts >= $from AND ts <= $to INTERVAL($interval)",
				"queryType": "SQL",
			},
			interval:  10 * time.Second,
			expectOK:  true,
			expectSQL: "SELECT * FROM test WHERE ts >= '2024-01-01T00:00:00Z' AND ts <= '2024-01-01T01:00:00Z' INTERVAL(10s)",
		},
		{
			name: "valid SQL with $begin and $end macros",
			json: map[string]interface{}{
				"sql":       "SELECT * FROM test WHERE ts >= $begin AND ts <= $end",
				"queryType": "SQL",
			},
			interval:  0,
			expectOK:  true,
			expectSQL: "SELECT * FROM test WHERE ts >= '2024-01-01T00:00:00Z' AND ts <= '2024-01-01T01:00:00Z'",
		},
		{
			name: "valid SQL with $__timeFrom and $__timeTo macros",
			json: map[string]interface{}{
				"sql":       "SELECT * FROM test WHERE ts >= $__timeFrom() AND ts <= $__timeTo()",
				"queryType": "SQL",
			},
			interval:  0,
			expectOK:  true,
			expectSQL: "SELECT * FROM test WHERE ts >= '2024-01-01T00:00:00Z' AND ts <= '2024-01-01T01:00:00Z'",
		},
		{
			name: "valid SQL with $__timeFilter macro",
			json: map[string]interface{}{
				"sql":       "SELECT * FROM test WHERE $__timeFilter(ts)",
				"queryType": "SQL",
			},
			interval:  0,
			expectOK:  true,
			expectSQL: "SELECT * FROM test WHERE (ts >= '2024-01-01T00:00:00Z' AND ts <= '2024-01-01T01:00:00Z')",
		},
		{
			name: "invalid $__timeFilter without args should fail",
			json: map[string]interface{}{
				"sql":       "SELECT * FROM test WHERE $__timeFilter",
				"queryType": "SQL",
			},
			interval:    0,
			expectOK:    false,
			expectError: "macro $__timeFilter requires a column argument",
		},
		{
			name: "default queryType to SQL",
			json: map[string]interface{}{
				"sql": "SELECT 1",
			},
			interval:  0,
			expectOK:  true,
			expectSQL: "SELECT 1",
		},
		{
			name: "empty SQL should fail",
			json: map[string]interface{}{
				"sql":       "",
				"queryType": "SQL",
			},
			interval:    0,
			expectOK:    false,
			expectError: "generateSql can not get SQL",
		},
		{
			name: "non-SQL queryType should fail",
			json: map[string]interface{}{
				"sql":       "SELECT 1",
				"queryType": "Arithmetic",
			},
			interval:    0,
			expectOK:    false,
			expectError: "queryType error, only support SQL queryType",
		},
		{
			name: "deprecated timeShift should fail",
			json: map[string]interface{}{
				"sql":             "SELECT 1",
				"queryType":       "SQL",
				"timeShiftPeriod": "1",
				"timeShiftUnit":   "hours",
			},
			interval:    0,
			expectOK:    false,
			expectError: "timeShift is deprecated, use panel Query options -> Time shift instead",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBytes, err := json.Marshal(tt.json)
			require.NoError(t, err)

			query := backend.DataQuery{
				JSON:     jsonBytes,
				Interval: tt.interval,
				TimeRange: backend.TimeRange{
					From: fromTime,
					To:   toTime,
				},
			}

			model, ok, errMsg := getQueryModel(query)

			assert.Equal(t, tt.expectOK, ok, "success mismatch")

			if tt.expectOK {
				require.NotNil(t, model)
				assert.Equal(t, tt.expectSQL, model.Sql, "SQL mismatch")
				assert.Equal(t, "SQL", model.QueryType)
			} else {
				assert.Contains(t, errMsg, tt.expectError, "error message mismatch")
			}
		})
	}
}

func TestSortFrameRowsByTime(t *testing.T) {
	t1 := time.Date(2024, 1, 1, 0, 1, 0, 0, time.UTC)
	t2 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	frame := data.NewFrame("",
		data.NewField("time", nil, []time.Time{t1, t2}),
		data.NewField("value", nil, []float64{2, 1}),
		data.NewField("host", nil, []string{"b", "a"}),
	)

	sortFrameRowsByTime(frame)

	require.Equal(t, t2, frame.Fields[0].At(0))
	require.Equal(t, t1, frame.Fields[0].At(1))
	require.Equal(t, 1.0, frame.Fields[1].At(0))
	require.Equal(t, 2.0, frame.Fields[1].At(1))
	require.Equal(t, "a", frame.Fields[2].At(0))
	require.Equal(t, "b", frame.Fields[2].At(1))
}

func TestSortFrameRowsByTime_WhenTimeFieldIsNotFirst(t *testing.T) {
	t1 := time.Date(2024, 1, 1, 0, 1, 0, 0, time.UTC)
	t2 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	frame := data.NewFrame("",
		data.NewField("value", nil, []float64{2, 1}),
		data.NewField("time", nil, []time.Time{t1, t2}),
		data.NewField("host", nil, []string{"b", "a"}),
	)

	sortFrameRowsByTime(frame)

	require.Equal(t, 1.0, frame.Fields[0].At(0))
	require.Equal(t, 2.0, frame.Fields[0].At(1))
	require.Equal(t, t2, frame.Fields[1].At(0))
	require.Equal(t, t1, frame.Fields[1].At(1))
	require.Equal(t, "a", frame.Fields[2].At(0))
	require.Equal(t, "b", frame.Fields[2].At(1))
}

func TestBuildFrame_ReordersImplicitTimeColumn(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"vnodes_num", float64(CTypeInt)},
			{"_wstart", float64(CTypeTimestamp)},
		},
		Data: [][]interface{}{
			{float64(3), "2024-01-01T00:00:00Z"},
			{float64(4), "2024-01-01T00:10:00Z"},
		},
	}

	frame, err := buildFrame(result, &queryModel{}, false)

	require.NoError(t, err)
	require.Len(t, frame.Fields, 2)
	require.Equal(t, "_wstart", frame.Fields[0].Name)
	require.Equal(t, data.FieldTypeTime, frame.Fields[0].Type())
	require.Equal(t, "vnodes_num", frame.Fields[1].Name)
	require.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[1].Type())
	require.Equal(t, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), frame.Fields[0].At(0))
	value, ok := frame.Fields[1].ConcreteAt(0)
	require.True(t, ok)
	require.Equal(t, 3.0, value)
}

func TestBuildFrame_AliasAppliesToValueColumnsOnly(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"value", float64(CTypeInt)},
			{"bucket_start", float64(CTypeTimestamp)},
			{"host", float64(CTypeBinary)},
		},
		Data: [][]interface{}{
			{float64(8), "2024-01-01T00:00:00Z", "dn1"},
		},
	}

	frame, err := buildFrame(result, &queryModel{Alias: "metric_alias,host_alias"}, false)

	require.NoError(t, err)
	require.Len(t, frame.Fields, 3)
	require.Equal(t, "bucket_start", frame.Fields[0].Name)
	require.Equal(t, "metric_alias", frame.Fields[1].Name)
	require.Equal(t, "host_alias", frame.Fields[2].Name)
	value, valueOK := frame.Fields[1].ConcreteAt(0)
	require.True(t, valueOK)
	require.Equal(t, 8.0, value)
	host, hostOK := frame.Fields[2].ConcreteAt(0)
	require.True(t, hostOK)
	require.Equal(t, "dn1", host)
}

func TestBuildFrame_PreservesRowsWithNilValueColumns(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"_wstart", float64(CTypeTimestamp)},
			{"value", float64(CTypeInt)},
			{"host", float64(CTypeBinary)},
		},
		Data: [][]interface{}{
			{"2024-01-01T00:00:00Z", nil, "dn1"},
			{"2024-01-01T00:10:00Z", float64(9), "dn1"},
		},
	}

	frame, err := buildFrame(result, &queryModel{}, false)
	require.NoError(t, err)
	require.Len(t, frame.Fields, 3)
	require.Equal(t, 2, frame.Fields[0].Len())
	require.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[1].Type())
	require.Nil(t, frame.Fields[1].At(0))

	secondValue, ok := frame.Fields[1].ConcreteAt(1)
	require.True(t, ok)
	require.Equal(t, 9.0, secondValue)
}

func TestBuildFrame_LongToWidePreservesNilValues(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"_wstart", float64(CTypeTimestamp)},
			{"value", float64(CTypeDouble)},
			{"host", float64(CTypeBinary)},
		},
		Data: [][]interface{}{
			{"2024-01-01T00:10:00Z", nil, "dn1"},
			{"2024-01-01T00:00:00Z", float64(1), "dn1"},
			{"2024-01-01T00:00:00Z", float64(2), "dn2"},
			{"2024-01-01T00:10:00Z", float64(3), "dn2"},
		},
	}

	frame, err := buildFrame(result, &queryModel{}, false)
	require.NoError(t, err)
	require.Equal(t, data.TimeSeriesTypeLong, frame.TimeSeriesSchema().Type)

	sortFrameRowsByTime(frame)
	wide, err := data.LongToWide(frame, nil)
	require.NoError(t, err)
	require.Equal(t, data.TimeSeriesTypeWide, wide.TimeSeriesSchema().Type)
	require.Len(t, wide.Fields, 3)

	var dn1Field *data.Field
	for _, field := range wide.Fields[1:] {
		if field.Labels["host"] == "dn1" {
			dn1Field = field
			break
		}
	}
	require.NotNil(t, dn1Field)
	require.Equal(t, data.FieldTypeNullableFloat64, dn1Field.Type())
	require.Nil(t, dn1Field.At(1))
}

func TestBuildFrame_TableFormatKeepsColumnOrderAndNilPrimaryTime(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"task_id", float64(CTypeBinary)},
			{"update_time", float64(CTypeTimestamp)},
			{"latest", float64(CTypeDouble)},
		},
		Data: [][]interface{}{
			{"task_1", nil, float64(10)},
			{"task_2", "2024-01-01T00:10:00Z", float64(11)},
		},
	}

	frame, err := buildFrame(result, &queryModel{FormatType: "Table"}, true)
	require.NoError(t, err)
	require.Len(t, frame.Fields, 3)
	require.Equal(t, "task_id", frame.Fields[0].Name)
	require.Equal(t, "update_time", frame.Fields[1].Name)
	require.Equal(t, "latest", frame.Fields[2].Name)
	require.Equal(t, data.FieldTypeNullableTime, frame.Fields[1].Type())
	require.Equal(t, 2, frame.Fields[1].Len())
	require.Nil(t, frame.Fields[1].At(0))

	timeValue, ok := frame.Fields[1].ConcreteAt(1)
	require.True(t, ok)
	require.Equal(t, time.Date(2024, 1, 1, 0, 10, 0, 0, time.UTC), timeValue)
}

func TestBuildFrame_TableFormatAllNilTimestamp(t *testing.T) {
	result := &dataResult{
		ColumnMeta: [][]interface{}{
			{"task_id", float64(CTypeBinary)},
			{"update_time", float64(CTypeTimestamp)},
			{"latest", float64(CTypeDouble)},
		},
		Data: [][]interface{}{
			{"task_1", nil, float64(10)},
			{"task_2", nil, float64(11)},
		},
	}

	frame, err := buildFrame(result, &queryModel{FormatType: "Table"}, true)
	require.NoError(t, err)
	require.Len(t, frame.Fields, 3)
	require.Equal(t, "update_time", frame.Fields[1].Name)
	require.Equal(t, data.FieldTypeNullableTime, frame.Fields[1].Type())
	require.Equal(t, 2, frame.Fields[1].Len())
	require.Nil(t, frame.Fields[1].At(0))
	require.Nil(t, frame.Fields[1].At(1))
}

func TestHasDeprecatedTimeShift(t *testing.T) {
	tests := []struct {
		name     string
		period   interface{}
		unit     string
		expected bool
	}{
		{name: "empty values", period: nil, unit: "", expected: false},
		{name: "unit set", period: nil, unit: "hours", expected: true},
		{name: "blank string period", period: "   ", unit: "", expected: false},
		{name: "non-empty string period", period: "1", unit: "", expected: true},
		{name: "zero float64 period", period: float64(0), unit: "", expected: false},
		{name: "non-zero float64 period", period: float64(2), unit: "", expected: true},
		{name: "zero int period", period: int(0), unit: "", expected: false},
		{name: "non-zero int64 period", period: int64(1), unit: "", expected: true},
		{name: "unknown period type", period: true, unit: "", expected: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, hasDeprecatedTimeShift(tt.period, tt.unit))
		})
	}
}

func TestSplitAliasList(t *testing.T) {
	tests := []struct {
		name     string
		alias    string
		expected []string
	}{
		{name: "empty alias", alias: "", expected: nil},
		{name: "spaces only alias", alias: "   ", expected: nil},
		{name: "single alias", alias: "metric", expected: []string{"metric"}},
		{name: "comma separated aliases", alias: "metric,host", expected: []string{"metric", "host"}},
		{name: "aliases with extra commas", alias: "metric,, host ,", expected: []string{"metric", "", "host", ""}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, splitAliasList(tt.alias))
		})
	}
}

// TestIsTableFormat tests table format detection
func TestIsTableFormat(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{name: "exact table", input: "Table", expected: true},
		{name: "lowercase table", input: "table", expected: true},
		{name: "mixed case table", input: "TaBlE", expected: true},
		{name: "table with spaces", input: " Table ", expected: true},
		{name: "time series", input: "Time series", expected: false},
		{name: "empty string", input: "", expected: false},
		{name: "spaces only", input: "   ", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isTableFormat(tt.input))
		})
	}
}

// TestFindTimeColumnIndex tests timestamp column detection
func TestFindTimeColumnIndex(t *testing.T) {
	tests := []struct {
		name     string
		meta     [][]interface{}
		expected int
	}{
		{
			name: "timestamp at index 0",
			meta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
			},
			expected: 0,
		},
		{
			name: "timestamp at index 1",
			meta: [][]interface{}{
				{"value", "INT"},
				{"ts", "TIMESTAMP"},
			},
			expected: 1,
		},
		{
			name: "timestamp with numeric type",
			meta: [][]interface{}{
				{"value", float64(CTypeInt)},
				{"ts", float64(CTypeTimestamp)},
			},
			expected: 1,
		},
		{
			name: "no timestamp column",
			meta: [][]interface{}{
				{"name", "BINARY"},
				{"value", "INT"},
			},
			expected: -1,
		},
		{
			name:     "empty metadata",
			meta:     [][]interface{}{},
			expected: -1,
		},
		{
			name: "metadata with incomplete column",
			meta: [][]interface{}{
				{"ts"},
			},
			expected: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, findTimeColumnIndex(tt.meta))
		})
	}
}

// TestBuildColumnOrder tests column ordering with timestamp first
func TestBuildColumnOrder(t *testing.T) {
	tests := []struct {
		name        string
		columnCount int
		timeColIdx  int
		expected    []int
	}{
		{
			name:        "time column at index 0",
			columnCount: 3,
			timeColIdx:  0,
			expected:    []int{0, 1, 2},
		},
		{
			name:        "time column at index 1",
			columnCount: 3,
			timeColIdx:  1,
			expected:    []int{1, 0, 2},
		},
		{
			name:        "time column at index 2",
			columnCount: 3,
			timeColIdx:  2,
			expected:    []int{2, 0, 1},
		},
		{
			name:        "no time column",
			columnCount: 3,
			timeColIdx:  -1,
			expected:    []int{0, 1, 2},
		},
		{
			name:        "single column",
			columnCount: 1,
			timeColIdx:  0,
			expected:    []int{0},
		},
		{
			name:        "empty columns",
			columnCount: 0,
			timeColIdx:  -1,
			expected:    []int{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildColumnOrder(tt.columnCount, tt.timeColIdx)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestBuildNaturalColumnOrder tests natural column order (for table format)
func TestBuildNaturalColumnOrder(t *testing.T) {
	tests := []struct {
		name        string
		columnCount int
		expected    []int
	}{
		{
			name:        "three columns",
			columnCount: 3,
			expected:    []int{0, 1, 2},
		},
		{
			name:        "single column",
			columnCount: 1,
			expected:    []int{0},
		},
		{
			name:        "empty columns",
			columnCount: 0,
			expected:    []int{},
		},
		{
			name:        "five columns",
			columnCount: 5,
			expected:    []int{0, 1, 2, 3, 4},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildNaturalColumnOrder(tt.columnCount)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestDetectTimeLayout tests time layout detection from data rows
func TestDetectTimeLayout(t *testing.T) {
	tests := []struct {
		name           string
		rows           [][]interface{}
		timeColIdx     int
		expectError    bool
		expectedLayout string
	}{
		{
			name: "ISO 8601 format",
			rows: [][]interface{}{
				{"2024-01-01T00:00:00Z", 1.0},
				{"2024-01-01T01:00:00Z", 2.0},
			},
			timeColIdx:     0,
			expectError:    false,
			expectedLayout: "2006-01-02T15:04:05Z",
		},
		{
			name: "ISO 8601 with milliseconds",
			rows: [][]interface{}{
				{"2024-01-01T00:00:00.000Z", 1.0},
			},
			timeColIdx:     0,
			expectError:    false,
			expectedLayout: "2006-01-02T15:04:05.000Z",
		},
		{
			name: "no time column",
			rows: [][]interface{}{
				{1.0, "value"},
			},
			timeColIdx:     -1,
			expectError:    false,
			expectedLayout: "",
		},
		{
			name: "all nil time values",
			rows: [][]interface{}{
				{nil, 1.0},
				{nil, 2.0},
			},
			timeColIdx:  0,
			expectError: true,
		},
		{
			name: "first row nil, second row valid",
			rows: [][]interface{}{
				{nil, 1.0},
				{"2024-01-01T00:00:00Z", 2.0},
			},
			timeColIdx:     0,
			expectError:    false,
			expectedLayout: "2006-01-02T15:04:05Z",
		},
		{
			name: "time column index out of range",
			rows: [][]interface{}{
				{1.0, "value"},
			},
			timeColIdx:  5,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layout, err := detectTimeLayout(tt.rows, tt.timeColIdx)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedLayout, layout)
			}
		})
	}
}

// TestConvertRow tests row conversion logic
func TestConvertRow(t *testing.T) {
	layout := "2006-01-02T15:04:05Z"

	tests := []struct {
		name               string
		srcRow             []interface{}
		columnMeta         [][]interface{}
		columnOrder        []int
		timeColIdx         int
		keepNilPrimaryTime bool
		expectError        bool
		expectSkip         bool
		expectedRowLen     int
	}{
		{
			name:   "normal row conversion",
			srcRow: []interface{}{"2024-01-01T00:00:00Z", int64(42), "test"},
			columnMeta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
				{"name", "BINARY"},
			},
			columnOrder:        []int{0, 1, 2},
			timeColIdx:         0,
			keepNilPrimaryTime: false,
			expectError:        false,
			expectSkip:         false,
			expectedRowLen:     3,
		},
		{
			name:   "row with nil value column",
			srcRow: []interface{}{"2024-01-01T00:00:00Z", nil, "test"},
			columnMeta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
				{"name", "BINARY"},
			},
			columnOrder:        []int{0, 1, 2},
			timeColIdx:         0,
			keepNilPrimaryTime: false,
			expectError:        false,
			expectSkip:         false,
			expectedRowLen:     3,
		},
		{
			name:   "row with nil time column - should skip",
			srcRow: []interface{}{nil, int64(42), "test"},
			columnMeta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
				{"name", "BINARY"},
			},
			columnOrder:        []int{0, 1, 2},
			timeColIdx:         0,
			keepNilPrimaryTime: false,
			expectError:        false,
			expectSkip:         true,
			expectedRowLen:     0,
		},
		{
			name:   "row with nil time column in table format - keep it",
			srcRow: []interface{}{nil, int64(42), "test"},
			columnMeta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
				{"name", "BINARY"},
			},
			columnOrder:        []int{0, 1, 2},
			timeColIdx:         0,
			keepNilPrimaryTime: true,
			expectError:        false,
			expectSkip:         false,
			expectedRowLen:     3,
		},
		{
			name:   "column order different from source",
			srcRow: []interface{}{"test", float64(42), "2024-01-01T00:00:00Z"},
			columnMeta: [][]interface{}{
				{"name", "BINARY"},
				{"value", "INT"},
				{"ts", "TIMESTAMP"},
			},
			columnOrder:        []int{2, 1, 0},
			timeColIdx:         2,
			keepNilPrimaryTime: false,
			expectError:        false,
			expectSkip:         false,
			expectedRowLen:     3,
		},
		{
			name:   "column index out of range",
			srcRow: []interface{}{"2024-01-01T00:00:00Z", int64(42)},
			columnMeta: [][]interface{}{
				{"ts", "TIMESTAMP"},
				{"value", "INT"},
			},
			columnOrder:        []int{0, 1, 5},
			timeColIdx:         0,
			keepNilPrimaryTime: false,
			expectError:        true,
			expectSkip:         false,
			expectedRowLen:     0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			row, skip, err := convertRow(tt.srcRow, tt.columnMeta, tt.columnOrder, tt.timeColIdx, layout, tt.keepNilPrimaryTime)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.expectSkip, skip)
			if !tt.expectSkip && !tt.expectError {
				assert.Equal(t, tt.expectedRowLen, len(row))
			}
		})
	}
}

// TestConvertNonTimeValue tests non-time value conversion
func TestConvertNonTimeValue(t *testing.T) {
	layout := "2006-01-02T15:04:05Z"

	tests := []struct {
		name        string
		value       interface{}
		columnType  interface{}
		expectError bool
		expectNil   bool
		verifyType  func(interface{}) bool
	}{
		{
			name:        "nil value",
			value:       nil,
			columnType:  "INT",
			expectError: false,
			expectNil:   true,
		},
		{
			name:        "integer to float",
			value:       int64(42),
			columnType:  "INT",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*float64)
				return ok && ptr != nil && *ptr == 42.0
			},
		},
		{
			name:        "float to float",
			value:       float64(3.14),
			columnType:  "DOUBLE",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*float64)
				return ok && ptr != nil && *ptr == 3.14
			},
		},
		{
			name:        "bool true",
			value:       true,
			columnType:  "BOOL",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*bool)
				return ok && ptr != nil && *ptr == true
			},
		},
		{
			name:        "bool false",
			value:       false,
			columnType:  "BOOL",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*bool)
				return ok && ptr != nil && *ptr == false
			},
		},
		{
			name:        "string to bool true",
			value:       "1",
			columnType:  "BOOL",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*bool)
				return ok && ptr != nil && *ptr == true
			},
		},
		{
			name:        "string to bool false",
			value:       "0",
			columnType:  "BOOL",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*bool)
				return ok && ptr != nil && *ptr == false
			},
		},
		{
			name:        "binary string",
			value:       "test string",
			columnType:  "BINARY",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*string)
				return ok && ptr != nil && *ptr == "test string"
			},
		},
		{
			name:        "timestamp string",
			value:       "2024-01-01T00:00:00Z",
			columnType:  "TIMESTAMP",
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*time.Time)
				if !ok || ptr == nil {
					return false
				}
				return ptr.Format(time.RFC3339) == "2024-01-01T00:00:00Z"
			},
		},
		{
			name:        "integer type",
			value:       int64(100),
			columnType:  int(CTypeInt),
			expectError: false,
			expectNil:   false,
			verifyType: func(v interface{}) bool {
				ptr, ok := v.(*float64)
				return ok && ptr != nil && *ptr == 100.0
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := convertNonTimeValue(tt.value, tt.columnType, layout)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			if tt.expectNil {
				assert.Nil(t, result)
			} else if !tt.expectError && tt.verifyType != nil {
				assert.True(t, tt.verifyType(result), "value conversion verification failed")
			}
		})
	}
}
