package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	hclog "github.com/hashicorp/go-hclog"
)

var pluginLogger hclog.Logger

func main() {
	f, err := os.OpenFile("tdengine_backend.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		os.Exit(1)
	}

	pluginLogger = hclog.New(&hclog.LoggerOptions{
		Name:   "tdengine-grafana",
		Level:  hclog.LevelFromString("DEBUG"),
		Output: f,
	})

	bl := InitConfig()
	if !bl {
		pluginLogger.Debug("init config failed")
		return
	}

	handler := http.DefaultServeMux
	handler.HandleFunc("/sms", HandleWebhook(func(w http.ResponseWriter, b *Body) {
		// pluginLogger.Debug("Grafana status: " + b.Title)
		// pluginLogger.Debug(b.Message)
		SendSms(fmt.Sprintf(SmsConf.AlibabaCloudSms.TemplateParam, b.State, time.Now().Format("2006-01-02 15:04:05"), b.Title, b.Message[:35]))
	}, 0))

	go http.ListenAndServe(SmsConf.ListenAddr, handler)
	pluginLogger.Debug("API is listening on: " + SmsConf.ListenAddr)
	pluginLogger.Debug("start")
	// Start listening to requests send from Grafana. This call is blocking so
	// it wont finish until Grafana shuts down the process or the plugin choose
	// to exit close down by itself
	err = datasource.Serve(newDatasource())

	// Log any error if we could start the plugin.
	if err != nil {
		pluginLogger.Error(err.Error())
		os.Exit(1)
	}
}
