package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/araddon/dateparse"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	CTypeNull             = 0
	CTypeBool             = 1
	CTypeTinyInt          = 2
	CTypeSmallInt         = 3
	CTypeInt              = 4
	CTypeBigInt           = 5
	CTypeFloat            = 6
	CTypeDouble           = 7
	CTypeBinary           = 8
	CTypeTimestamp        = 9
	CTypeNChar            = 10
	CTypeUnsignedTinyInt  = 11
	CTypeUnsignedSmallInt = 12
	CTypeUnsignedInt      = 13
	CTypeUnsignedBigInt   = 14
)

// Check if the target type of `typeNum` is boolean or not.
func isBoolType(typeNum int) bool {
	return typeNum == CTypeBool
}

// Check if the target type of `typeNum` is integers or not.
func isIntegerTypes(typeNum int) bool {
	return (typeNum >= CTypeTinyInt && typeNum <= CTypeBigInt) ||
		(typeNum >= CTypeUnsignedTinyInt && typeNum <= CTypeUnsignedBigInt)
}

func isFloatTypes(typeNum int) bool {
	return typeNum == CTypeFloat || typeNum == CTypeDouble
}

func isTimestampType(typeNum int) bool {
	return typeNum == CTypeTimestamp
}

// newDatasource returns datasource.ServeOpts.
func newDatasource() datasource.ServeOpts {
	// creates a instance manager for your plugin. The function passed
	// into `NewInstanceManger` is called when the instance is created
	// for the first time or when a datasource configuration changed.
	im := datasource.NewInstanceManager(newDataSourceInstance)
	ds := &RocksetDatasource{
		im: im,
	}

	return datasource.ServeOpts{
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
		CallResourceHandler: ds,
	}
}

// RocksetDatasource is a backend datasource used to access a Rockset database
type RocksetDatasource struct {
	// The instance manager can help with lifecycle management
	// of datasource instances in plugins. It's not a requirements
	// but a best practice that we recommend that you follow.
	im instancemgmt.InstanceManager
}

func transcode(in, out interface{}) {
	buf := new(bytes.Buffer)
	json.NewEncoder(buf).Encode(in)
	json.NewDecoder(buf).Decode(out)
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (rd *RocksetDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var dat JsonData

	// pluginLogger.Debug(fmt.Sprintf("%#v", string(req.Queries[0].JSON)))
	decryptedJSONData := req.PluginContext.DataSourceInstanceSettings.DecryptedSecureJSONData
	transcode(decryptedJSONData, &dat)

	// pluginLogger.Debug(fmt.Sprintf("DataSource: %v", req.PluginContext.DataSourceInstanceSettings))
	AssertSmsWorker(ctx, req.PluginContext.DataSourceInstanceSettings.ID, dat)

	response := backend.NewQueryDataResponse()
	for i := 0; i < len(req.Queries); i++ {
		if sql, alias, err := generateSql(req.Queries[i]); err != nil {
			pluginLogger.Debug("generateSql error: %w", err)
			return nil, fmt.Errorf("generateSql error: %w", err)
		} else {
			if res, err := query(req.PluginContext.DataSourceInstanceSettings.URL, dat.BasicAuth, dat.Token, []byte(sql)); err != nil {
				pluginLogger.Debug("query data: %w", err)
				return nil, fmt.Errorf("query data: %w", err)
			} else if resp, err := makeResponse(res, alias); err != nil {
				pluginLogger.Debug("make reponse: %w", err)
				return nil, fmt.Errorf("make reponse: %w", err)
			} else {
				response.Responses[req.Queries[i].RefID] = resp
			}
		}
	}
	return response, nil
}

func generateSql(query backend.DataQuery) (sql, alias string, err error) {
	var queryDataJson map[string]interface{}
	// pluginLogger.Debug(fmt.Sprintf("req.Queries.JSON:%+v", string(query.JSON)))
	if err = json.Unmarshal(query.JSON, &queryDataJson); err != nil {
		pluginLogger.Debug("get query error: %w", err)
		return "", "", fmt.Errorf("get query error: %w", err)
	}
	queryType, ok := queryDataJson["queryType"].(string)
	if ok && queryType != "SQL" {
		pluginLogger.Debug("queryType error, only support SQL queryType")
		return "", "", fmt.Errorf("queryType error, only support SQL queryType")
	}
	sql, ok = queryDataJson["sql"].(string)
	if !ok {
		pluginLogger.Debug("generateSql can not get SQL")
		return "", "", fmt.Errorf("generateSql can not get SQL")
	}
	if timeZone, err := time.LoadLocation(""); err != nil {
		pluginLogger.Debug("get time location zone: %w", err)
		return "", "", fmt.Errorf("get time location zone: %w", err)
	} else {
		// pluginLogger.Debug("use timeZone: %v", timeZone)
		// sql = strings.ReplaceAll(sql, "$interval", fmt.Sprint(query.Interval.Seconds())+"s")  // Do not support $interval,because it always be 0.
		sql = strings.ReplaceAll(sql, "$from", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$begin", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$to", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$end", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	}

	// pluginLogger.Debug(sql)
	alias, _ = queryDataJson["alias"].(string)
	return sql, alias, nil
}

func getTypeArray(typeNum int) interface{} {
	if isBoolType(typeNum) {
		// BOOL
		return []bool{}
	} else if isIntegerTypes(typeNum) {
		// 2/3/4/5,11/12/13/14, INTs
		return []int64{}
	} else if isFloatTypes(typeNum) {
		// float/double
		return []float64{}
	} else if isTimestampType(typeNum) {
		// timestamp
		return []time.Time{}
	} else {
		// binary/nchar, and maybe json
		return []string{}
	}
}

type restResult struct {
	Status     string          `json:"status"`
	Head       []string        `json:"head"`
	ColumnMeta [][]interface{} `json:"column_meta"`
	Data       [][]interface{} `json:"data"`
	Rows       int             `json:"rows"`
}

func makeResponse(body []byte, alias string) (response backend.DataResponse, err error) {

	// var res map[string]interface{}
	var res restResult

	// pluginLogger.Debug(fmt.Sprint("body: ", string(body)))
	if err = json.Unmarshal(body, &res); err != nil {
		pluginLogger.Error(fmt.Sprint("parse json error: ", err))
		return response, fmt.Errorf("get res error: %w", err)
	}
	// pluginLogger.Info(fmt.Sprint("parsed: ", res))
	frame := data.NewFrame("response")

	aliasList := strings.Split(alias, ",")
	for i := 0; i < len(res.ColumnMeta); i++ {
		name := res.ColumnMeta[i][0].(string)
		if i > 0 && len(aliasList) >= i && len(aliasList[i-1]) > 0 {
			name = strings.ReplaceAll(aliasList[i-1], "[[col]]", name)
		}
		frame.Fields = append(frame.Fields,
			data.NewField(name, nil, getTypeArray(int(res.ColumnMeta[i][1].(float64)))),
		)
		// pluginLogger.Debug(fmt.Sprint("frame: ", frame, ", after field: ", name, ", typeNum: ", int(res.ColumnMeta[i][1].(float64))))
	}

	timeLayout := ""
	if len(res.Data) == 0 || len(res.Data[0]) == 0 {
		return response, nil
	}
	tsLayout := res.Data[0][0].(string)
	// pluginLogger.Debug(fmt.Sprint("tsLayout: ", tsLayout))

	timeLayout, err = dateparse.ParseFormat(tsLayout)

	if err != nil {
		return response, fmt.Errorf("ts parse layout error %s", tsLayout)
	}
	// pluginLogger.Debug(fmt.Sprint("frame: ", frame))
	for i := 0; i < len(res.Data); i++ {
		if res.Data[i][0], err = time.Parse(timeLayout, res.Data[i][0].(string)); err != nil {
			pluginLogger.Error(fmt.Sprint("parse error:", err))
			return response, fmt.Errorf("ts parse error: %w", err)
		}
		hasNil := false
		for j := 1; j < len(res.Data[i]); j++ {
			if res.Data[i][j] == nil {
				hasNil = true
				break
			}
			typeNum := int(res.ColumnMeta[j][1].(float64))
			// pluginLogger.Debug(fmt.Sprintf("column: %d, type: %d", j, typeNum))
			if isIntegerTypes(typeNum) {
				res.Data[i][j] = int64(res.Data[i][j].(float64))

			}
		}
		if hasNil {
			continue
		}
		// pluginLogger.Debug(fmt.Sprint("before appended row ", i))
		frame.AppendRow(res.Data[i]...)
		// pluginLogger.Debug(fmt.Sprint("appended row ", i))
	}
	response.Frames = append(response.Frames, frame)
	// json, _ := response.MarshalJSON()
	// pluginLogger.Debug(fmt.Sprint("response is", string(json)))
	return response, nil
}
func query(url, basicAuth, token string, reqBody []byte) ([]byte, error) {
	var reqBodyBuffer io.Reader = bytes.NewBuffer(reqBody)

	sqlUtcUrl := url + "/rest/sqlutc"
	if token != "" {
		sqlUtcUrl = sqlUtcUrl + "?token=" + token
	}
	req, err := http.NewRequest("POST", sqlUtcUrl, reqBodyBuffer)
	if err != nil {
		pluginLogger.Error(fmt.Sprint("query "+url+"/rest/sqlutc error: ", err))
		return []byte{}, err
	}

	req.Header.Set("Authorization", "Basic "+basicAuth) // cm9vdDp0YW9zZGF0YQ==

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		pluginLogger.Error(fmt.Sprint("query "+url+"/rest/sqlutc error: ", err))
		return []byte{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		pluginLogger.Error("when writing to [] received status code: %d", resp.StatusCode)
		return []byte{}, fmt.Errorf("when writing to [] received status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		pluginLogger.Error("when writing to [] received error: %v", err)
		return []byte{}, fmt.Errorf("when writing to [] received error: %v", err)
	}
	defer resp.Body.Close()
	return body, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (rd *RocksetDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginLogger.Debug("CheckHealth")
	// pluginLogger.Debug(fmt.Sprintf("%#v", req.PluginContext))
	// pluginLogger.Debug(fmt.Sprintf("%#v", req.PluginContext.User))
	// pluginLogger.Debug(fmt.Sprintf("%#v", req.PluginContext.AppInstanceSettings))
	var dat map[string]interface{}
	if err := json.Unmarshal(req.PluginContext.DataSourceInstanceSettings.JSONData, &dat); err != nil {
		pluginLogger.Error("get dataSourceInstanceSettings error: %s", err.Error())
		return healthError("get dataSourceInstanceSettings error: %s", err.Error()), nil
	}

	basicAuth, _ := dat["basicAuth"].(string)

	token, found := dat["token"].(string)
	if !found {
		token = ""
	}

	if _, err := query(req.PluginContext.DataSourceInstanceSettings.URL, basicAuth, token, []byte("show databases")); err != nil {
		pluginLogger.Error("failed get connect to tdengine: %s", err.Error())
		return healthError("failed get connect to tdengine: %s", err.Error()), nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "tdengine datasource is working",
	}, nil
}

func healthError(msg string, args ...string) *backend.CheckHealthResult {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: fmt.Sprintf(msg, args),
	}
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (rd *RocksetDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	// pluginLogger.Debug("CallResource")
	if req.Path == "setSmsConfig" {
		pluginLogger.Info("set sms config")

		var data map[int64]JsonData
		if err := json.Unmarshal(req.Body, &data); err != nil {
			pluginLogger.Debug("CallResource error: " + err.Error())
			pluginLogger.Debug("CallResource req.Body: " + string(req.Body))
			return err
		}

		for k, v := range data {
			RestartSmsWorker(k, v)
		}
		sender.Send(&backend.CallResourceResponse{Status: 204})
	}
	return nil
}

type instanceSettings struct {
	httpClient *http.Client
}

func newDataSourceInstance(setting backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &instanceSettings{
		httpClient: &http.Client{},
	}, nil
}

func (s *instanceSettings) Dispose() {
	// Called before creating a new instance to allow plugin authors to cleanup.
	pluginLogger.Debug("dispose")
}
