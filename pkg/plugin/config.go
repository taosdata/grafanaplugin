package plugin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
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

var cTypeMapping = map[int]string{
	CTypeBool:             CTypeBoolStr,
	CTypeTinyInt:          CTypeTinyIntStr,
	CTypeSmallInt:         CTypeSmallIntStr,
	CTypeInt:              CTypeIntStr,
	CTypeBigInt:           CTypeBigIntStr,
	CTypeFloat:            CTypeFloatStr,
	CTypeDouble:           CTypeDoubleStr,
	CTypeBinary:           CTypeBinaryStr,
	CTypeTimestamp:        CTypeTimestampStr,
	CTypeNChar:            CTypeNCharStr,
	CTypeUnsignedTinyInt:  CTypeUnsignedTinyIntStr,
	CTypeUnsignedSmallInt: CTypeUnsignedSmallIntStr,
	CTypeUnsignedInt:      CTypeUnsignedIntStr,
	CTypeUnsignedBigInt:   CTypeUnsignedBigIntStr,
}

func cType2CTypeStr(typeNum int) string {
	return cTypeMapping[typeNum]
}

func trans2CTypeStr(t any) string {
	switch t := t.(type) {
	case string:
		return t
	case int64:
		return cType2CTypeStr(int(t))
	case float64:
		return cType2CTypeStr(int(t))
	default:
		return toString(t)
	}
}

// Check if the target type of `typeNum` is boolean or not.
func isBoolType(typeNum int) bool {
	return typeNum == CTypeBool
}

// Check if the target type of `typeNum` is integers or not.
func isIntegerTypes(typeNum int) bool {
	return (typeNum >= CTypeTinyInt && typeNum <= CTypeBigInt) ||
		(typeNum >= CTypeUnsignedTinyInt && typeNum <= CTypeUnsignedBigInt)
}

var integerTypes = []string{CTypeIntStr, CTypeUnsignedIntStr, CTypeBigIntStr, CTypeUnsignedBigIntStr, CTypeSmallIntStr,
	CTypeUnsignedSmallIntStr, CTypeTinyIntStr, CTypeUnsignedTinyIntStr}

func isIntegerTypesForInterface(tp interface{}) bool {
	switch tp := tp.(type) {
	case string:
		return inSlice[string](tp, integerTypes)
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
		return []float64{} // return float64 otherwise will case `no float64 value column found in frame`
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
	if inSlice[string](tp, integerTypes) {
		return []float64{} // return float64 otherwise will case `no float64 value column found in frame`
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

func inSlice[T string | int64 | float64](field T, slice []T) bool {
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

func doHttpPost(ctx context.Context, user, password, basicAuth string, url string, data string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(data))
	if err != nil {
		log.DefaultLogger.Error(fmt.Sprintf("query %s error: %v", url, err))
		return nil, err
	}
	if len(basicAuth) == 0 {
		basicAuth = base64.StdEncoding.EncodeToString([]byte(user + ":" + password))
	}
	req.Header.Set("Authorization", "Basic "+basicAuth) // cm9vdDp0YW9zZGF0YQ==
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.DefaultLogger.Error(fmt.Sprintf("query %s error: %v", url, err))
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("when writing to [] received status code: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

type queryModel struct {
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

type dataResult struct {
	Status     string          `json:"status"`
	Code       int             `json:"code"`
	Head       []string        `json:"head"`
	ColumnMeta [][]interface{} `json:"column_meta"`
	Data       [][]interface{} `json:"data"`
	Rows       int             `json:"rows"`
}
