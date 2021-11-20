package main

import (
	"encoding/json"
	io "io/ioutil"
	"sync"
)

type AlibabaCloudSmsInfo struct {
	AccessKeyId     string `json:accessKeyId`
	AccessKeySecret string `json:accessKeySecret`
	SignName        string `json:signName`
	TemplateCode    string `json:templateCode`
	TemplateParam   string `json:templateParam`
}

type SmsConfInfo struct {
	AlibabaCloudSms AlibabaCloudSmsInfo `json:alibabaCloudSms`
	PhoneNumbers    []string            `json:phoneNumbers`
	ListenAddr      string              `json:listenAddr`
}

var SmsConf SmsConfInfo

var file_locker sync.Mutex //config file locker

func InitConfig() bool {
	conf, bl := LoadConfig("tdengine-datasource/config.json") //get config struct
	if !bl {
		pluginLogger.Debug("InitConfig failed")
		return false
	}
	SmsConf = conf
	return true
}

func LoadConfig(filename string) (SmsConfInfo, bool) {
	var conf SmsConfInfo
	file_locker.Lock()
	data, err := io.ReadFile(filename)
	file_locker.Unlock()
	if err != nil {
		pluginLogger.Debug("read json file error")
		return conf, false
	}
	datajson := []byte(data)
	err = json.Unmarshal(datajson, &conf)
	if err != nil {
		pluginLogger.Debug("unmarshal json file error")
		return conf, false
	}
	return conf, true
}
