package main

import (
	"strings"
)

type JsonData struct {
	BasicAuth string `json:"basicAuth"`
	Token     string `json:"token"`

	AccessKeyId      string   `json:"aliSmsAccessKeyId"`
	AccessKeySecret  string   `json:"aliSmsAccessKeySecret"`
	SignName         string   `json:"aliSmsSignName"`
	TemplateCode     string   `json:"aliSmsTemplateCode"`
	TemplateParam    string   `json:"aliSmsTemplateParam"`
	PhoneNumbers     []string `json:"aliSmsPhoneNumbers"`
	PhoneNumbersList string   `json:"aliSmsPhoneNumbersList"`
	ListenAddr       string   `json:"aliSmsListenAddr"`
}

func (sc *JsonData) GetPhoneNumbers() []string {
	if len(sc.PhoneNumbersList) != 0 {
		return strings.Split(sc.PhoneNumbersList, ",")
	} else {
		return sc.PhoneNumbers
	}
}
