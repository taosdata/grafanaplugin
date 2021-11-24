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
		pluginLogger.Debug("Grafana status: " + b.Title)
		pluginLogger.Debug(b.Message)
		if len(b.Message) > 35 {
			b.Message = b.Message[:35]
		}
		SendSms(worker.conf, fmt.Sprintf(worker.conf.AlibabaCloudSms.TemplateParam, b.State, time.Now().Format("2006-01-02 15:04:05"), b.Title, b.Message))
	}, 0))

	worker.server = &http.Server{Addr: worker.conf.ListenAddr, Handler: handler}

	go worker.server.ListenAndServe()
	pluginLogger.Debug("API is listening on: " + worker.conf.ListenAddr)
}

var workerMutex sync.Mutex

func AssertSmsWorker(ctx context.Context, id int64, conf *SmsConfInfo) {
	uid := fmt.Sprint(id)
	workerMutex.Lock()
	defer workerMutex.Unlock()
	if _, exists := workerList.Load(uid); !exists {
		worker := &SmsWorker{server: nil, conf: *conf}
		worker.StartListen()
		workerList.Store(uid, worker)
	}
}

func RestartSmsWorker(ctx context.Context, id int64, conf *SmsConfInfo) {
	uid := fmt.Sprint(id)
	pluginLogger.Info(fmt.Sprint("Restart sms worker for data source ", uid))
	workerMutex.Lock()
	defer workerMutex.Unlock()

	var worker *SmsWorker
	if worker_v, ok := workerList.LoadAndDelete(uid); ok {
		if worker, ok = worker_v.(*SmsWorker); ok {
			if err := worker.server.Shutdown(ctx); err != nil {
				pluginLogger.Debug("worker shutdown error: " + err.Error())
			}
		}
	}

	worker = &SmsWorker{server: nil, conf: *conf}
	worker.StartListen()
	workerList.Store(uid, worker)
}
