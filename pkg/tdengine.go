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
	if typeNum == 1 { // 1：BOOL
		return []bool{}
	} else if typeNum == 2 { // 2：TINYINT
		return []int8{}
	} else if typeNum == 3 { // 3：SMALLINT
		return []int16{}
	} else if typeNum == 4 { // 4：INT
		return []int32{}
	} else if typeNum == 5 { // 5：BIGINT
		return []int64{}
	} else if typeNum == 6 { // 6：FLOAT
		return []float32{}
	} else if typeNum == 7 { // 7：DOUBLE
		return []float64{}
	} else if typeNum == 8 { // 8：BINARY
		return []string{}
	} else if typeNum == 9 { // 9：TIMESTAMP
		return []time.Time{}
	} else if typeNum == 10 { // 10：NCHAR
		return []string{}
	}
	return []string{}
}
func makeResponse(body []byte, alias string) (response backend.DataResponse, err error) {
	var res map[string]interface{}

	backend.Logger.Debug("body: ", string(body))
	if err = json.Unmarshal(body, &res); err != nil {
		return response, fmt.Errorf("get res error: %w", err)
	}
	frame := data.NewFrame("response")
	aliasList := strings.Split(alias, ",")
	for i := 0; i < len(res["column_meta"].([]interface{})); i++ {
		name := res["column_meta"].([]interface{})[i].([]interface{})[0].(string)
		if i > 0 && len(aliasList) >= i && len(aliasList[i-1]) > 0 {
			name = strings.ReplaceAll(aliasList[i-1], "[[col]]", name)
		}
		frame.Fields = append(frame.Fields,
			data.NewField(name, nil, getTypeArray(int(res["column_meta"].([]interface{})[i].([]interface{})[1].(float64)))),
		)
	}

	timeLayout := ""
	if len(res["data"].([]interface{})) == 0 || len(res["data"].([]interface{})[0].([]interface{})) == 0 {
		return response, nil
	}
	tsLayout := res["data"].([]interface{})[0].([]interface{})[0].(string)
	pluginLogger.Debug("tsLayout:", tsLayout)

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
	for i := 0; i < len(res["data"].([]interface{})); i++ {
		if res["data"].([]interface{})[i].([]interface{})[0], err = time.Parse(timeLayout, res["data"].([]interface{})[i].([]interface{})[0].(string)); err != nil {
			return response, fmt.Errorf("ts parse error: %w", err)
		}
		frame.AppendRow(res["data"].([]interface{})[i].([]interface{})...)
	}
	response.Frames = append(response.Frames, frame)
	// json, _ := response.MarshalJSON()
	// pluginLogger.Debug(string(json))
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
