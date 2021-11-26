package main

import (
	"strings"
)

type AlibabaCloudSmsInfo struct {
	AccessKeyId     string `json:"accessKeyId"`
	AccessKeySecret string `json:"accessKeySecret"`
	SignName        string `json:"signName"`
	TemplateCode    string `json:"templateCode"`
	TemplateParam   string `json:"templateParam"`
}

type SmsConfInfo struct {
	AlibabaCloudSms  AlibabaCloudSmsInfo `json:"alibabaCloudSms"`
	PhoneNumbers     []string            `json:"phoneNumbers"`
	PhoneNumbersList string              `json:"phoneNumbersList"`
	ListenAddr       string              `json:"listenAddr"`
}

func (sc *SmsConfInfo) GetPhoneNumbers() []string {
	if len(sc.PhoneNumbersList) != 0 {
		return strings.Split(sc.PhoneNumbersList, ",")
	} else {
		return sc.PhoneNumbers
	}
}

type JsonData struct {
	User      string      `json:"user"`
	Password  string      `json:"password"`
	SmsConfig SmsConfInfo `json:"smsConfig"`
}
