package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
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

const (
	CTypeBoolStr             = "BOOL"
	CTypeTinyIntStr          = "TINYINT"
	CTypeSmallIntStr         = "SMALLINT"
	CTypeIntStr              = "INT"
	CTypeBigIntStr           = "BIGINT"
	CTypeFloatStr            = "FLOAT"
	CTypeDoubleStr           = "DOUBLE"
	CTypeBinaryStr           = "BINARY"
	CTypeTimestampStr        = "TIMESTAMP"
	CTypeNCharStr            = "NCHAR"
	CTypeUnsignedTinyIntStr  = "TINYINT UNSIGNED"
	CTypeUnsignedSmallIntStr = "SMALLINT UNSIGNED"
	CTypeUnsignedIntStr      = "INT UNSIGNED"
	CTypeUnsignedBigIntStr   = "BIGINT UNSIGNED"
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

func isIntegerTypesForInterface(tp interface{}) bool {
	switch tp := tp.(type) {
	case string:
		return tp == CTypeIntStr || tp == CTypeUnsignedIntStr || tp == CTypeBigIntStr || tp == CTypeUnsignedBigIntStr ||
			tp == CTypeSmallIntStr || tp == CTypeUnsignedSmallIntStr || tp == CTypeTinyIntStr ||
			tp == CTypeUnsignedTinyIntStr
	case int:
		return isIntegerTypes(tp)
	case int32:
		return isIntegerTypes(int(tp))
	case int64:
		return isIntegerTypes(int(tp))
	case float32:
		return isIntegerTypes(int(tp))
	case float64:
		return isIntegerTypes(int(tp))
	}
	return false
}

func isFloatTypes(typeNum int) bool {
	return typeNum == CTypeFloat || typeNum == CTypeDouble
}

func isTimestampType(typeNum int) bool {
	return typeNum == CTypeTimestamp
}

// newDatasource returns datasource.ServeOpts.
func newDatasource() datasource.ServeOpts {
	// creates an instance manager for your plugin. The function passed
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
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
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
		queryDataJson, err := getQueryJson(req.Queries[i])
		if err != nil {
			pluginLogger.Error("generateSql error: %w", err)
			return nil, fmt.Errorf("generateSql error: %v", err)
		}
		res, err := query(req.PluginContext.DataSourceInstanceSettings.URL, dat.BasicAuth, dat.Token, []byte(queryDataJson.Sql))
		if err != nil {
			pluginLogger.Error("query data: %w", err)
			return nil, fmt.Errorf("query data: %w", err)
		}
		formatedRes, err := formatData(res, queryDataJson.Sql, queryDataJson.ColNameFormatStr, queryDataJson.ColNameToGroup)
		if err != nil {
			pluginLogger.Error("format group data error: %w", err)
			return nil, fmt.Errorf("format group data error: %w", err)
		}
		resp, err := makeResponse(formatedRes, queryDataJson.Alias)
		if err != nil {
			pluginLogger.Error("make response: %w", err)
			return nil, fmt.Errorf("make response: %w", err)
		}
		response.Responses[req.Queries[i].RefID] = resp
	}
	return response, nil
}

type queryJson struct {
	Alias            string `json:"alias,omitempty"`
	ColNameFormatStr string `json:"colNameFormatStr,omitempty"`
	ColNameToGroup   string `json:"colNameToGroup,omitempty"`
	FormatType       string `json:"formatType,omitempty"`
	Hide             bool   `json:"hide,omitempty"`
	IntervalMs       int64  `json:"intervalMs,omitempty"`
	MaxDataPoints    int64  `json:"maxDataPoints,omitempty"`
	QueryType        string `json:"queryType,omitempty"`
	RefID            string `json:"refId,omitempty"`
	Sql              string `json:"sql,omitempty"`
}

func getQueryJson(query backend.DataQuery) (*queryJson, error) {
	var queryDataJson queryJson
	pluginLogger.Debug(fmt.Sprintf("req.Queries.JSON:%+v", string(query.JSON)))
	if err := json.Unmarshal(query.JSON, &queryDataJson); err != nil {
		pluginLogger.Error("get query error: %w", err)
		return nil, fmt.Errorf("get query error: %w", err)
	}
	if queryDataJson.QueryType != "SQL" {
		pluginLogger.Debug("queryType error, only support SQL queryType")
		return nil, fmt.Errorf("queryType error, only support SQL queryType")
	}

	sql := queryDataJson.Sql
	if len(sql) == 0 {
		pluginLogger.Debug("generateSql can not get SQL")
		return nil, fmt.Errorf("generateSql can not get SQL")
	}
	timeZone, err := time.LoadLocation("")
	if err != nil {
		pluginLogger.Debug("get time location zone: %w", err)
		return nil, fmt.Errorf("get time location zone: %w", err)
	}
	if query.Interval > 0 {
		sql = strings.ReplaceAll(sql, "$interval", fmt.Sprint(query.Interval.Seconds())+"s")
	}
	sql = strings.ReplaceAll(sql, "$from", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$begin", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$to", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$end", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	pluginLogger.Debug(sql)

	queryDataJson.Sql = sql
	return &queryDataJson, nil
}

func getTypeArray(tp interface{}) interface{} {
	switch tp := tp.(type) {
	case string:
		return getTypeArrayForStr(tp)
	case int:
		return getTypeArrayForInt(tp)
	case int32:
		return getTypeArrayForInt(int(tp))
	case int64:
		return getTypeArrayForInt(int(tp))
	case float32:
		return getTypeArrayForInt(int(tp))
	case float64:
		return getTypeArrayForInt(int(tp))
	}
	// binary/nchar, and maybe json
	return []string{}
}

func getTypeArrayForInt(typeNum int) interface{} {
	if isBoolType(typeNum) {
		// BOOL
		return []bool{}
	}
	if isIntegerTypes(typeNum) {
		// 2/3/4/5,11/12/13/14, INTs
		return []int64{}
	}
	if isFloatTypes(typeNum) {
		// float/double
		return []float64{}
	}
	if isTimestampType(typeNum) {
		// timestamp
		return []time.Time{}
	}
	// binary/nchar, and maybe json
	return []string{}
}

func getTypeArrayForStr(tp string) interface{} {
	if tp == CTypeBoolStr {
		return []bool{}
	}
	if tp == CTypeIntStr || tp == CTypeUnsignedIntStr || tp == CTypeBigIntStr || tp == CTypeUnsignedBigIntStr ||
		tp == CTypeSmallIntStr || tp == CTypeUnsignedSmallIntStr || tp == CTypeTinyIntStr ||
		tp == CTypeUnsignedTinyIntStr {
		return []int64{}
	}
	if tp == CTypeFloatStr || tp == CTypeDoubleStr {
		// float/double
		return []float64{}
	}
	if tp == CTypeTimestampStr {
		// timestamp
		return []time.Time{}
	}
	// binary/nchar, and maybe json
	return []string{}
}

type restResult struct {
	Status     string          `json:"status"`
	Code       int             `json:"code"`
	Head       []string        `json:"head"`
	ColumnMeta [][]interface{} `json:"column_meta"`
	Data       [][]interface{} `json:"data"`
	Rows       int             `json:"rows"`
}

func makeResponse(res *restResult, alias string) (response backend.DataResponse, err error) {
	frame := data.NewFrame("") // do not set name for frame. this name will override the data column name

	aliasList := strings.Split(alias, ",")
	for i := 0; i < len(res.ColumnMeta); i++ {
		name := toString(res.ColumnMeta[i][0])
		if i > 0 && len(aliasList) >= i && len(aliasList[i-1]) > 0 {
			name = strings.ReplaceAll(aliasList[i-1], "[[col]]", name)
		}
		frame.Fields = append(frame.Fields,
			data.NewField(name, nil, getTypeArray(res.ColumnMeta[i][1])),
		)
	}

	timeLayout := ""
	if len(res.Data) == 0 || len(res.Data[0]) == 0 {
		return response, nil
	}
	tsLayout := toString(res.Data[0][0])
	timeLayout, err = dateparse.ParseFormat(tsLayout)

	if err != nil {
		return response, fmt.Errorf("ts parse layout error %s", tsLayout)
	}

	for i := 0; i < len(res.Data); i++ {
		if res.Data[i][0], err = time.Parse(timeLayout, toString(res.Data[i][0])); err != nil {
			pluginLogger.Error(fmt.Sprint("parse error:", err))
			return response, fmt.Errorf("ts parse error: %w", err)
		}
		hasNil := false
		for j := 1; j < len(res.Data[i]); j++ {
			if res.Data[i][j] == nil {
				hasNil = true
				break
			}
			if isIntegerTypesForInterface(res.ColumnMeta[j][1]) {
				res.Data[i][j] = int64(res.Data[i][j].(float64))
			}
		}
		if hasNil {
			continue
		}
		frame.AppendRow(res.Data[i]...)
	}
	response.Frames = append(response.Frames, frame)
	return response, nil
}

var configError = errors.New("query config error")

func formatData(body []byte, sql, formatStr, groupFields string) (*restResult, error) {
	var res restResult
	if err := json.Unmarshal(body, &res); err != nil {
		pluginLogger.Error(fmt.Sprint("parse json error: ", err))
		return nil, fmt.Errorf("get res error: %w", err)
	}

	upperSql := strings.ToUpper(sql)
	if strings.Contains(upperSql, " PARTITION BY ") || strings.Contains(upperSql, " GROUP BY ") {
		return formatGroupData(&res, formatStr, groupFields)
	}

	return &res, nil
}

func formatGroupData(res *restResult, formatStr, groupFields string) (*restResult, error) {
	if len(groupFields) == 0 {
		pluginLogger.Error("config error, group fields is nil")
		return nil, fmt.Errorf("%v, %s", configError, "group_by_column config is null")
	}
	groups := strings.Split(groupFields, ",")
	for i, group := range groups {
		groups[i] = strings.TrimSpace(group)
	}

	var timestamps []string
	var tsIndex int
	var valueField, valueType string
	var valueLength int64

	valueIndex := -1
	tsData := make(map[interface{}]map[string]interface{}, len(res.Data)) // {ts: {group: value}}
	fieldIndex := make(map[string]int, len(res.ColumnMeta))
	groupedNames := make(map[string]struct{}, len(res.Data))

	var gotValueField bool
	for i, colMeta := range res.ColumnMeta {
		colName := toString(colMeta[0])
		colType := toString(colMeta[1])
		fieldIndex[colName] = i
		if colType == "TIMESTAMP" {
			tsIndex = i
			continue
		}

		if gotValueField {
			continue
		}
		if !inStrSlice(colName, groups) {
			valueIndex = i
			valueField = colName
			valueType = colType
			valueLength, _ = toInt(colMeta[2])
			gotValueField = true
		}
	}

	if valueIndex == -1 {
		pluginLogger.Error("config error, unknown value field")
		return nil, fmt.Errorf("%v, %s", configError, "unknown value field")
	}

	for _, d := range res.Data {
		if _, ok := tsData[d[tsIndex]]; !ok {
			tsData[d[tsIndex]] = make(map[string]interface{})
			timestamps = append(timestamps, toString(d[tsIndex]))
		}
		groupedName := groupedColumnName(d, valueField, formatStr, groups, fieldIndex)
		groupedNames[groupedName] = struct{}{}
		value, _ := toFloat(d[valueIndex])
		tsData[d[tsIndex]][groupedName] = value
	}

	groupMeta := make([][]interface{}, 0, len(groupedNames)+1)
	groupMeta = append(groupMeta, res.ColumnMeta[tsIndex])
	for col := range groupedNames {
		groupMeta = append(groupMeta, []interface{}{col, valueType, valueLength})
	}

	groupData := make([][]interface{}, 0, len(timestamps))
	for _, ts := range timestamps {
		d := tsData[ts]
		row := make([]interface{}, len(groupMeta))
		row[0] = ts
		for i, m := range groupMeta[1:] {
			row[i+1] = d[toString(m[0])]
		}
		groupData = append(groupData, row)
	}

	res.Data = groupData
	res.ColumnMeta = groupMeta
	res.Rows = len(groupData)
	return res, nil
}

func groupedColumnName(data []interface{}, valueField string, formatStr string, groupFields []string, fieldIndex map[string]int) string {
	if len(formatStr) == 0 {
		m := make(map[string]interface{}, len(groupFields))
		for _, field := range groupFields {
			m[field] = data[fieldIndex[field]]
		}
		j, _ := json.Marshal(m)
		return fmt.Sprintf("%s %s", valueField, string(j))
	}

	for _, field := range groupFields {
		value := data[fieldIndex[field]]
		formatStr = strings.ReplaceAll(formatStr, fmt.Sprintf("{{%s}}", field), toString(value))
	}

	return formatStr
}

func query(url, basicAuth, token string, reqBody []byte) ([]byte, error) {
	var reqBodyBuffer io.Reader = bytes.NewBuffer(reqBody)

	sqlUrl, err := defaultDbVersion.sqlUrl(url, basicAuth, token)
	if token != "" {
		sqlUrl = sqlUrl + "?token=" + token
	}
	req, err := http.NewRequest("POST", sqlUrl, reqBodyBuffer)
	if err != nil {
		pluginLogger.Error(fmt.Sprintf("query %s error: %v", sqlUrl, err))
		return []byte{}, err
	}

	req.Header.Set("Authorization", "Basic "+basicAuth) // cm9vdDp0YW9zZGF0YQ==

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		pluginLogger.Error(fmt.Sprintf("query %s error: %v", sqlUrl, err))
		return []byte{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == 404 {
			defaultDbVersion.cleanVersion(url)
		}
		pluginLogger.Error("when writing to [] received status code: %d", resp.StatusCode)
		return []byte{}, fmt.Errorf("when writing to [] received status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		pluginLogger.Error("when writing to [] received error: %v", err)
		return []byte{}, fmt.Errorf("when writing to [] received error: %v", err)
	}
	return body, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (rd *RocksetDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginLogger.Debug("CheckHealth")
	var dat map[string]interface{}
	if err := json.Unmarshal(req.PluginContext.DataSourceInstanceSettings.JSONData, &dat); err != nil {
		pluginLogger.Error("get dataSourceInstanceSettings error: %s", err.Error())
		return healthError("get dataSourceInstanceSettings error: %s", err.Error()), nil
	}

	basicAuth := toString(dat["basicAuth"])
	token := toString(dat["token"])

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

const sqlEndPoint = "/rest/sql"
const utcSqlEndPoint = "/rest/sqlutc"

var httpStatusErr = errors.New("http status error")

var defaultDbVersion = dbVersion{}

type dbVersion struct {
	cache sync.Map
}

type serverVer struct {
	Data [][]string
}

func (v *dbVersion) cleanVersion(url string) {
	v.cache.Delete(url)
}

func (v *dbVersion) sqlUrl(url, basicAuth, token string) (sqlUrl string, err error) {
	version, err := v.getVersion(url, basicAuth, token)
	if err != nil {
		return "", fmt.Errorf("get sql url error. %v", err)
	}
	if is30(version) {
		sqlUrl = url + sqlEndPoint
	} else {
		sqlUrl = url + utcSqlEndPoint
	}

	return
}

func is30(version string) bool {
	return strings.HasPrefix(version, "3")
}

func (v *dbVersion) getVersion(url, basicAuth, token string) (version string, err error) {
	if cached, ok := v.cache.Load(url); ok {
		return toString(cached), nil
	}

	defer func() {
		if len(version) > 0 && err == nil {
			v.cache.Store(url, version)
		}
	}()

	reqUrl := url + sqlEndPoint
	if len(token) > 0 {
		reqUrl = reqUrl + "?token=" + token
	}
	req, err := http.NewRequest(http.MethodPost, reqUrl, strings.NewReader("select server_version()"))
	if err != nil {
		pluginLogger.Error("create request for url error ", url, err)
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+basicAuth) // cm9vdDp0YW9zZGF0YQ==
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		pluginLogger.Error("request for server version error ", err)
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != 200 {
		pluginLogger.Error("read response data for server version error ", err)
		return "", fmt.Errorf("%v. http status code %d", httpStatusErr, resp.StatusCode)
	}

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		pluginLogger.Error("read response data for server version error ", err)
		return "", err
	}

	var ver serverVer
	if err = json.Unmarshal(respData, &ver); err != nil {
		pluginLogger.Error("unmarshall server version data ", err)
		return "", err
	}
	if len(ver.Data) != 1 || len(ver.Data[0]) != 1 {
		pluginLogger.Error("get server version data error, resp data is ", string(respData))
		return "", err
	}

	return ver.Data[0][0], nil
}

func inStrSlice(field string, slice []string) bool {
	for _, s := range slice {
		if field == s {
			return true
		}
	}

	return false
}

func toString(a interface{}) string {
	if a == nil {
		return ""
	}
	switch a := a.(type) {
	case string:
		return a
	case int:
		return strconv.Itoa(a)
	case int32:
		return strconv.FormatInt(int64(a), 10)
	case int64:
		return strconv.FormatInt(a, 10)
	case float32:
		return strconv.FormatFloat(float64(a), 'f', -1, 64)
	case float64:
		return strconv.FormatFloat(a, 'f', -1, 64)
	case json.Number:
		return a.String()
	case []byte:
		return string(a)
	default:
		return fmt.Sprintf("%v", a)
	}
}

func toInt(i interface{}) (int64, error) {
	switch i := i.(type) {
	case int:
		return int64(i), nil
	case int32:
		return int64(i), nil
	case int64:
		return i, nil
	case float32:
		return int64(i), nil
	case float64:
		return int64(i), nil
	case string:
		return strconv.ParseInt(i, 10, 64)
	default:
		return 0, fmt.Errorf("unknown type %t", i)
	}
}

func toFloat(f interface{}) (float64, error) {
	switch f := f.(type) {
	case int:
		return float64(f), nil
	case int32:
		return float64(f), nil
	case int64:
		return float64(f), nil
	case float32:
		return float64(f), nil
	case float64:
		return f, nil
	default:
		return 0, fmt.Errorf("unknown type %t", f)
	}
}
