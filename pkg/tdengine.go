package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

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
		QueryDataHandler:   ds,
		CheckHealthHandler: ds,
	}
}

// RocksetDatasource is a backend datasource used to access a Rockset database
type RocksetDatasource struct {
	// The instance manager can help with lifecycle management
	// of datasource instances in plugins. It's not a requirements
	// but a best practice that we recommend that you follow.
	im instancemgmt.InstanceManager
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (rd *RocksetDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var dat map[string]string
	if err := json.Unmarshal(req.PluginContext.DataSourceInstanceSettings.JSONData, &dat); err != nil {
		return nil, fmt.Errorf("get dataSourceInstanceSettings error: %w", err)
	}
	user, found := dat["user"]
	if !found {
		user = "root"
	}
	password, found := dat["password"]
	if !found {
		password = "taosdata"
	}

	response := backend.NewQueryDataResponse()
	for i := 0; i < len(req.Queries); i++ {
		if sql, alias, err := generateSql(req.Queries[i]); err != nil {
			return nil, fmt.Errorf("generateSql error: %w", err)
		} else {
			if res, err := query(req.PluginContext.DataSourceInstanceSettings.URL, user, password, []byte(sql)); err != nil {
				return nil, fmt.Errorf("query data: %w", err)
			} else if resp, err := makeResponse(res, alias); err != nil {
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
	pluginLogger.Debug(fmt.Sprintf("req.Queries.JSON:%+v", string(query.JSON)))
	if err = json.Unmarshal(query.JSON, &queryDataJson); err != nil {
		return "", "", fmt.Errorf("get query error: %w", err)
	}
	if queryDataJson["queryType"].(string) != "SQL" {
		return "", "", fmt.Errorf("queryType error, only support SQL queryType")
	}
	sql = queryDataJson["sql"].(string)
	if timeZone, err := time.LoadLocation(""); err != nil {
		return "", "", fmt.Errorf("get time location zone: %w", err)
	} else {
		// pluginLogger.Debug("use timeZone: %v", timeZone)
		// sql = strings.ReplaceAll(sql, "$interval", fmt.Sprint(query.Interval.Seconds())+"s")  // Do not support $interval,because it always be 0.
		sql = strings.ReplaceAll(sql, "$from", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$begin", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$to", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
		sql = strings.ReplaceAll(sql, "$end", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	}

	pluginLogger.Debug(sql)
	// alias := ""
	aliasJ, exist := queryDataJson["alias"]
	if exist {
		alias = aliasJ.(string)
	}
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

	if len(tsLayout) == len("2006-01-02T15:04:05-07:00") {
		timeLayout = "2006-01-02T15:04:05-07:00"
	} else if len(tsLayout) == len("2006-01-02T15:04:05-0700") {
		timeLayout = "2006-01-02T15:04:05-0700"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000-07:00") {
		timeLayout = "2006-01-02T15:04:05.000-07:00"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000-0700") {
		timeLayout = "2006-01-02T15:04:05.000-0700"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000000-07:00") {
		timeLayout = "2006-01-02T15:04:05.000000-07:00"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000000-0700") {
		timeLayout = "2006-01-02T15:04:05.000000-0700"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000000000-07:00") {
		timeLayout = "2006-01-02T15:04:05.000000000-07:00"
	} else if len(tsLayout) == len("2006-01-02T15:04:05.000000000-0700") {
		timeLayout = "2006-01-02T15:04:05.000000000-0700"
	} else {
		return response, fmt.Errorf("ts parse layout error %s", tsLayout)
	}
	// pluginLogger.Debug(fmt.Sprint("frame: ", frame))
	for i := 0; i < len(res.Data); i++ {
		if res.Data[i][0], err = time.Parse(timeLayout, res.Data[i][0].(string)); err != nil {
			pluginLogger.Error(fmt.Sprint("parse error:", err))
			return response, fmt.Errorf("ts parse error: %w", err)
		}
		for j := 1; j < len(res.Data[i]); j++ {
			// pluginLogger.Debug(fmt.Sprint("column: ", j))
			typeNum := int(res.ColumnMeta[j][1].(float64))
			if isIntegerTypes(typeNum) {
				res.Data[i][j] = int64(res.Data[i][j].(float64))
			}
		}
		frame.AppendRow(res.Data[i]...)
		// pluginLogger.Debug(fmt.Sprint("appended row ", i))
	}
	response.Frames = append(response.Frames, frame)
	// json, _ := response.MarshalJSON()
	// pluginLogger.Debug(fmt.Sprint("response is", string(json)))
	return response, nil
}
func query(url, user, password string, reqBody []byte) ([]byte, error) {
	var reqBodyBuffer io.Reader = bytes.NewBuffer(reqBody)

	req, err := http.NewRequest("POST", url+"/rest/sqlutc", reqBodyBuffer)
	if err != nil {
		return []byte{}, err
	}

	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(user+":"+password))) // cm9vdDp0YW9zZGF0YQ==

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return []byte{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return []byte{}, fmt.Errorf("when writing to [] received status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
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
	var dat map[string]string
	if err := json.Unmarshal(req.PluginContext.DataSourceInstanceSettings.JSONData, &dat); err != nil {
		return healthError("get dataSourceInstanceSettings error: %s", err.Error()), nil
	}
	user, found := dat["user"]
	if !found {
		user = "root"
	}
	password, found := dat["password"]
	if !found {
		password = "taosdata"
	}

	if _, err := query(req.PluginContext.DataSourceInstanceSettings.URL, user, password, []byte("show databases")); err != nil {
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
