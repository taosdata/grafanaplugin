package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sync"
)

type AlibabaCloudSmsInfo struct {
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
	SignName        string `json:"signName"`
	TemplateCode    string `json:"templateCode"`
	TemplateParam   string `json:"templateParam"`
}

type SmsConfInfo struct {
	AlibabaCloudSms AlibabaCloudSmsInfo `json:"alibabaCloudSms"`
	PhoneNumbers    []string            `json:"phoneNumbers"`
	ListenAddr      string              `json:"listenAddr"`
}

var file_locker sync.Mutex //config file locker

var fileName = os.Getenv("GF_PATHS_DATA") + "/tdengine-datasource-sms-config.json"

func LoadGrafanaConfig() map[string]SmsConfInfo {
	conf := map[string]SmsConfInfo{}
	req, err := http.NewRequest("GET", "http://127.0.0.1:3000/api/frontend/settings", nil)
	if err != nil {
		pluginLogger.Debug("LoadGrafanaConfig make request error: " + err.Error())
		return nil
	}
	req.SetBasicAuth("admin", "admin")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		pluginLogger.Debug("LoadGrafanaConfig do request error: " + err.Error())
		return nil
	}
	reqData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		pluginLogger.Debug("LoadGrafanaConfig read resp error: " + err.Error())
		return nil
	}
	var dat map[string]interface{}
	if err := json.Unmarshal(reqData, &dat); err != nil {
		pluginLogger.Debug("LoadGrafanaConfig Unmarshal error: %w", err)
		return nil
	}
	pluginLogger.Debug(string(reqData))
	if datasources, ok := dat["datasources"].(map[string]interface{}); ok {
		for _, v := range datasources {
			if datasource, ok := v.(map[string]interface{}); ok {
				if pluginType, ok := datasource["type"].(string); ok && pluginType == "tdengine-datasource" {
					if uid, ok := datasource["uid"].(string); ok {
						if jsonData, ok := datasource["jsonData"].(map[string]interface{}); ok && jsonData["smsConfig"] != nil {
							if smsConfigStr, err := json.Marshal(jsonData["smsConfig"]); err != nil {
								pluginLogger.Debug("LoadGrafanaConfig Marshal smsConfig error : " + err.Error())
							} else {
								var smsConfInfo SmsConfInfo
								if err := json.Unmarshal(smsConfigStr, &smsConfInfo); err != nil {
									pluginLogger.Debug("LoadGrafanaConfig Unmarshal smsConfigStr error : " + err.Error())
								} else {
									conf[uid] = smsConfInfo
									pluginLogger.Debug(fmt.Sprint(ok) + fmt.Sprintf(" %#v %#v ", conf, jsonData["smsConfig"]) + string(smsConfigStr))
								}
							}
						}
					}
				}
			}
		}
	}
	if len(conf) > 0 {
		if confStr, err := json.Marshal(conf); err != nil {
			pluginLogger.Debug("StartSmsWorkers Marshal json error : " + err.Error())
		} else {
			StoreConfig(confStr)
		}
		return conf
	}
	return nil
}

func LoadConfig() (conf map[string]SmsConfInfo) {
	file_locker.Lock()
	data, err := ioutil.ReadFile(fileName)
	file_locker.Unlock()
	if err != nil {
		conf = nil
		pluginLogger.Debug("read config.json file error")
		return
	}
	datajson := []byte(data)
	err = json.Unmarshal(datajson, &conf)
	if err != nil {
		conf = nil
		pluginLogger.Debug("unmarshal json file error")
		return
	}
	return
}

func StoreConfig(conf []byte) (err error) {
	file_locker.Lock()
	err = ioutil.WriteFile(fileName, conf, 0777)
	file_locker.Unlock()
	if err != nil {
		pluginLogger.Debug("write json file error")
		return err
	}
	return err
}
