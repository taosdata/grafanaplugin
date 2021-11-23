package main

import (
	openapi "github.com/alibabacloud-go/darabonba-openapi/client"
	dysmsapi20170525 "github.com/alibabacloud-go/dysmsapi-20170525/v2/client"
	"github.com/alibabacloud-go/tea/tea"
)

/**
 * 使用AK&SK初始化账号Client
 * @param accessKeyId
 * @param accessKeySecret
 * @return Client
 * @throws Exception
 */
func CreateClient(accessKeyId *string, accessKeySecret *string) (_result *dysmsapi20170525.Client, _err error) {
	config := &openapi.Config{
		// 您的AccessKey ID
		AccessKeyId: accessKeyId,
		// 您的AccessKey Secret
		AccessKeySecret: accessKeySecret,
	}
	// 访问的域名
	config.Endpoint = tea.String("dysmsapi.aliyuncs.com")
	_result, _err = dysmsapi20170525.NewClient(config)
	if _err != nil {
		pluginLogger.Debug(_err.Error())
		return nil, _err
	}
	return _result, _err
}

func SendSms(conf SmsConfInfo, templateParam string) (_err error) {
	client, _err := CreateClient(tea.String(conf.AlibabaCloudSms.AccessKeyId), tea.String(conf.AlibabaCloudSms.AccessKeySecret))
	if _err != nil {
		return _err
	}
	// pluginLogger.Debug(templateParam)
	for i := 0; i < len(conf.PhoneNumbers); i++ {
		if len(conf.PhoneNumbers) != 11 {
			continue
		}
		sendSmsRequest := &dysmsapi20170525.SendSmsRequest{
			PhoneNumbers:  tea.String(conf.PhoneNumbers[i]),
			TemplateCode:  tea.String(conf.AlibabaCloudSms.TemplateCode),
			TemplateParam: tea.String(templateParam),
			SignName:      tea.String(conf.AlibabaCloudSms.SignName),
		}
		// 复制代码运行请自行打印 API 的返回值
		resp, _err := client.SendSms(sendSmsRequest)
		if _err != nil {
			pluginLogger.Debug(_err.Error())
			return _err
		}
		pluginLogger.Debug(resp.String())

	}
	return _err
}
