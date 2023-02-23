package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/araddon/dateparse"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces-only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	ops, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, fmt.Errorf("http client options: %w", err)
	}
	client, err := httpclient.New(ops)
	if err != nil {
		return nil, fmt.Errorf("new httpclient error: %w", err)
	}

	ds := Datasource{
		settings: settings,
		client:   client,
		token:    settings.DecryptedSecureJSONData["token"],
	}
	endpoint, err := ds.detectEndpoint()
	if err != nil {
		return nil, fmt.Errorf("detect datasource endpoint error: %w", err)
	}
	ds.endpoint = endpoint
	return &ds, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	settings backend.DataSourceInstanceSettings
	client   *http.Client
	token    string
	endpoint string
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
	d.client.CloseIdleConnections()
}

type dataResponse struct {
	refId string
	data  backend.DataResponse
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// when logging at a non-Debug level, make sure you don't include sensitive information in the message
	// (like the *backend.QueryDataRequest)
	log.DefaultLogger.Debug("## QueryData called", req.Queries)

	// create response struct
	response := backend.NewQueryDataResponse()

	var wait sync.WaitGroup
	ch := make(chan dataResponse, len(req.Queries))
	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		wait.Add(1)
		go func(query backend.DataQuery, w *sync.WaitGroup) {
			defer w.Done()
			res := d.query(ctx, req.PluginContext, query)
			ch <- dataResponse{refId: query.RefID, data: res}
		}(q, &wait)
	}

	go func(w *sync.WaitGroup) {
		defer close(ch)
		w.Wait()
	}(&wait)

	// save the response in a hashmap
	// based on with RefID as identifier
	for res := range ch {
		response.Responses[res.refId] = res.data
	}

	return response, nil
}

func (d *Datasource) query(ctx context.Context, _ backend.PluginContext, query backend.DataQuery) (response backend.DataResponse) {
	// Unmarshal the JSON into our queryModel.
	qm, ok, msg := getQueryModel(query)
	if !ok {
		return backend.ErrDataResponse(http.StatusBadRequest, msg)
	}

	// query data from datasource
	result, err := d.queryDataFromDatasource(ctx, qm)
	if err != nil {
		log.DefaultLogger.Error("## query data error ", err)
		return backend.ErrDataResponse(http.StatusBadRequest, err.Error())
	}
	if len(result.Data) == 0 || len(result.Data[0]) == 0 {
		return
	}
	// if don't hava timestamp col
	hasTs := true
	if len(result.ColumnMeta) == 1 && result.ColumnMeta[0][1] != CTypeTimestampStr && result.ColumnMeta[0][1] != CTypeTimestamp {
		hasTs = false
	}
	// format data
	if err = d.formatData(result, qm, hasTs); err != nil {
		log.DefaultLogger.Error("## format data error ", err)
		return backend.ErrDataResponse(http.StatusBadRequest, err.Error())
	}

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/
	frame := data.NewFrame("") // do not set name for frame. this name will override the data column name

	// add fields.
	aliasList := strings.Split(qm.Alias, ",")
	for i := 0; i < len(result.ColumnMeta); i++ {
		name := toString(result.ColumnMeta[i][0])

		if i > 0 && len(aliasList) >= i && len(aliasList[i-1]) > 0 {
			name = strings.ReplaceAll(aliasList[i-1], "[[col]]", name)
		}
		frame.Fields = append(frame.Fields,
			data.NewField(name, nil, getTypeArray(result.ColumnMeta[i][1])),
		)
	}

	var timeLayout string
	if hasTs {
		timeLayout, err = dateparse.ParseFormat(toString(result.Data[0][0]))
		if err != nil {
			return backend.ErrDataResponse(http.StatusBadRequest, fmt.Sprintf("ts parse layout error: %s", err.Error()))
		}
	}
	response.Frames = make(data.Frames, 0, len(result.Data))
	for i := 0; i < len(result.Data); i++ {
		if hasTs {
			if result.Data[i][0], err = time.Parse(timeLayout, toString(result.Data[i][0])); err != nil {
				log.DefaultLogger.Error(fmt.Sprint("parse error:", err))
				return backend.ErrDataResponse(http.StatusBadRequest, fmt.Sprintf("ts parse error: %s", err.Error()))
			}
		}

		hasNil := false
		for j := 1; j < len(result.Data[i]); j++ {
			if result.Data[i][j] == nil {
				hasNil = true
				break
			}
			if isIntegerTypesForInterface(result.ColumnMeta[j][1]) {
				if result.Data[i][j], err = toFloat(result.Data[i][j]); err != nil {
					log.DefaultLogger.Error(fmt.Sprint("parse numeric data error:", err))
					return backend.ErrDataResponse(http.StatusBadRequest, fmt.Sprintf("parse numeric data error: %s", err.Error()))
				}
			}
		}
		if hasNil {
			continue
		}
		frame.AppendRow(result.Data[i]...)
	}
	// add the frames to the response.
	response.Frames = append(response.Frames, frame)
	return response
}

func (d *Datasource) queryDataFromDatasource(ctx context.Context, query *queryModel) (*dataResult, error) {
	body, err := d.doHttpPost(ctx, d.endpoint, query.Sql)
	if err != nil {
		log.DefaultLogger.Error("## query data error ", err)
		return nil, err
	}

	var result dataResult
	if err = json.Unmarshal(body, &result); err != nil {
		log.DefaultLogger.Error("## unmarshal result data error ", err)
		return nil, err
	}

	if result.Code != 0 {
		err = fmt.Errorf("query data by sql %s error, response code is %d ", query.Sql, result.Code)
		log.DefaultLogger.Error("query data error", err)
		return nil, err
	}

	return &result, nil
}

func (d *Datasource) formatData(result *dataResult, query *queryModel, hasTs bool) error {
	if !hasTs {
		return nil
	}
	upperSql := strings.ToUpper(query.Sql)
	if strings.Contains(upperSql, " PARTITION BY ") || strings.Contains(upperSql, " GROUP BY ") {
		return d.formatGroupData(result, query)
	}

	return nil
}

var configError = errors.New("query config error")

func (d *Datasource) formatGroupData(res *dataResult, query *queryModel) error {
	if len(query.ColNameToGroup) == 0 {
		log.DefaultLogger.Error("config error, group fields is nil", query.Sql)
		return fmt.Errorf("%v, %s", configError, "group_by_column config is null")
	}
	groups := strings.Split(query.ColNameToGroup, ",")
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
		// trans columnMeta num to str for 2.x
		colMeta[1] = trans2CTypeStr(colMeta[1])

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
		if !inSlice[string](colName, groups) {
			valueIndex = i
			valueField = colName
			valueType = colType
			valueLength, _ = toInt(colMeta[2])
			gotValueField = true
		}
	}

	if valueIndex == -1 {
		log.DefaultLogger.Error("config error, unknown value field")
		return fmt.Errorf("%v, %s", configError, "unknown value field")
	}

	for _, resData := range res.Data {
		if _, ok := tsData[resData[tsIndex]]; !ok {
			tsData[resData[tsIndex]] = make(map[string]interface{})
			timestamps = append(timestamps, toString(resData[tsIndex]))
		}
		groupedName := groupedColumnName(resData, valueField, query.ColNameFormatStr, groups, fieldIndex)
		groupedNames[groupedName] = struct{}{}
		value, _ := toFloat(resData[valueIndex])
		tsData[resData[tsIndex]][groupedName] = value
	}

	groupMeta := make([][]interface{}, 0, len(groupedNames)+1)
	groupMeta = append(groupMeta, res.ColumnMeta[tsIndex])
	for col := range groupedNames {
		groupMeta = append(groupMeta, []interface{}{col, valueType, valueLength})
	}

	groupData := make([][]interface{}, 0, len(timestamps))
	for _, ts := range timestamps {
		row := make([]interface{}, len(groupMeta))
		row[0] = ts
		for i, m := range groupMeta[1:] {
			row[i+1] = tsData[ts][toString(m[0])]
		}
		groupData = append(groupData, row)
	}

	res.Data = groupData
	res.ColumnMeta = groupMeta
	res.Rows = len(groupData)

	return nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	// when logging at a non-Debug level, make sure you don't include sensitive information in the message
	// (like the *backend.QueryDataRequest)
	log.DefaultLogger.Debug("CheckHealth called")

	var status = backend.HealthStatusOk
	var message = "Data source is working"

	if _, err := d.queryDataFromDatasource(ctx, &queryModel{Sql: "show databases"}); err != nil {
		status = backend.HealthStatusError
		message = fmt.Sprintf("failed get connect to tdengine. %s", err.Error())
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

const sqlEndPoint = "/rest/sql"
const utcSqlEndPoint = "/rest/sqlutc"

func (d *Datasource) detectEndpoint() (string, error) {
	respData, err := d.doHttpPost(context.Background(), d.settings.URL+sqlEndPoint, "select server_version()")
	if err != nil {
		return "", err
	}

	var ver serverVer
	if err = json.Unmarshal(respData, &ver); err != nil {
		log.DefaultLogger.Error("unmarshall server version data ", err)
		return "", err
	}
	if len(ver.Data) != 1 || len(ver.Data[0]) != 1 {
		log.DefaultLogger.Error("get server version data error, resp data is ", string(respData))
		return "", err
	}

	if is30(ver.Data[0][0]) {
		return d.settings.URL + sqlEndPoint, nil
	}
	return d.settings.URL + utcSqlEndPoint, nil
}

func (d *Datasource) doHttpPost(ctx context.Context, url, data string) (respData []byte, err error) {
	if len(d.token) > 0 {
		url = "?token=" + d.token
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(data))
	if err != nil {
		log.DefaultLogger.Error(fmt.Sprintf("query %s error: %v", url, err))
		return nil, err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		log.DefaultLogger.Error(fmt.Sprintf("query error: %v", err))
		return nil, err
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http request for [%s] received code: %d, status %s ", data,
			resp.StatusCode, resp.Status)
	}

	return io.ReadAll(resp.Body)
}

func getQueryModel(query backend.DataQuery) (model *queryModel, success bool, errMsg string) {
	err := json.Unmarshal(query.JSON, &model)
	if err != nil {
		log.DefaultLogger.Error("## unmarshal query to query model error ", query.JSON, err)
		return nil, false, fmt.Sprintf("json unmarshal: %v", err.Error())
	}

	if len(model.QueryType) == 0 {
		model.QueryType = "SQL"
	}

	if model.QueryType != "SQL" {
		log.DefaultLogger.Error("## queryType error, only support SQL queryType")
		return nil, false, "queryType error, only support SQL queryType"
	}

	sql := model.Sql
	if len(sql) == 0 {
		log.DefaultLogger.Error("## generateSql can not get SQL")
		return nil, false, "generateSql can not get SQL"
	}
	timeZone, err := time.LoadLocation("")
	if err != nil {
		log.DefaultLogger.Error("## get time location zone: %w", err)
		return nil, false, fmt.Sprintf("get time location zone: %v", err)
	}
	if query.Interval > 0 {
		sql = strings.ReplaceAll(sql, "$interval", fmt.Sprint(query.Interval.Seconds())+"s")
	}
	sql = strings.ReplaceAll(sql, "$from", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$begin", "'"+fmt.Sprint(query.TimeRange.From.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$to", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	sql = strings.ReplaceAll(sql, "$end", "'"+fmt.Sprint(query.TimeRange.To.In(timeZone).Format(time.RFC3339Nano))+"'")
	log.DefaultLogger.Debug("## query sql", sql)

	model.Sql = sql
	success = true
	return
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
