package main

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"
)

var workerList sync.Map

type SmsWorker struct {
	conf   SmsConfInfo
	server *http.Server
}

func (worker *SmsWorker) StartListen() {
	handler := http.NewServeMux()
	handler.HandleFunc("/sms", HandleWebhook(func(w http.ResponseWriter, b *Body) {
		// pluginLogger.Debug("Grafana status: " + b.Title)
		// pluginLogger.Debug(b.Message)
		if len(b.Message) > 35 {
			b.Message = b.Message[:35]
		}
		SendSms(worker.conf, fmt.Sprintf(worker.conf.AlibabaCloudSms.TemplateParam, b.State, time.Now().Format("2006-01-02 15:04:05"), b.Title, b.Message))
	}, 0))

	worker.server = &http.Server{Addr: worker.conf.ListenAddr, Handler: handler}

	go worker.server.ListenAndServe()
	pluginLogger.Debug("API is listening on: " + worker.conf.ListenAddr)
}

func StartSmsWorkers(ctx context.Context) {
	LoadGrafanaConfig()
	conf := LoadConfig()
	if conf == nil {
		conf = LoadGrafanaConfig()
	}
	for k, v := range conf {
		if len(v.ListenAddr) == 0 {
			continue
		}
		pluginLogger.Debug(fmt.Sprintf("%s %#v", k, v))
		var worker *SmsWorker
		// workerList.Delete(k)
		if worker_v, ok := workerList.LoadAndDelete(k); ok {
			if worker, ok = worker_v.(*SmsWorker); ok {
				if err := worker.server.Shutdown(ctx); err != nil {
					pluginLogger.Debug("worker shutdown error: " + err.Error())
					break
				}
			}
		}
		worker = &SmsWorker{server: nil, conf: v}
		worker.StartListen()
		workerList.Store(k, worker)
	}
}
