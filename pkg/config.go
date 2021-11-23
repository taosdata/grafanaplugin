package main

import (
	"encoding/json"
	io "io/ioutil"
	"os"
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

var file_locker sync.Mutex //config file locker

var fileName = os.Getenv("GF_PATHS_DATA") + "tdengine-datasource-sms-config.json"

func LoadConfig() (conf map[string]SmsConfInfo) {
	file_locker.Lock()
	data, err := io.ReadFile(fileName)
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
	err = io.WriteFile(fileName, conf, 0777)
	file_locker.Unlock()
	if err != nil {
		pluginLogger.Debug("write json file error")
		return err
	}
	return err
}
