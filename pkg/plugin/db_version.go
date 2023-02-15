package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

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

func (v *dbVersion) sqlUrl(ctx context.Context, user, password, basicAuth, url, token string) (sqlUrl string, err error) {
	version, err := v.getVersion(ctx, user, password, basicAuth, url, token)
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

func (v *dbVersion) getVersion(ctx context.Context, user, password, basicAuth, url, token string) (version string, err error) {
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

	respData, err := doHttpPost(ctx, user, password, basicAuth, reqUrl, "select server_version()")
	if err != nil {
		log.DefaultLogger.Error("read response data for server version error ", err)
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

	return ver.Data[0][0], nil
}
