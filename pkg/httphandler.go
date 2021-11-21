package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
)

var (
	StateOk       State = "ok"
	StatePaused   State = "paused"
	StateAlerting State = "alerting"
	StatePending  State = "pending"
	StateNoData   State = "no_data"
)

type State string

// Body represents Grafana request body
type Body struct {
	Title       string                   `json:"title"`
	RuleID      int                      `json:"ruleId"`
	RuleName    string                   `json:"ruleName"`
	RuleURL     string                   `json:"ruleUrl"`
	State       State                    `json:"state"`
	ImageURL    string                   `json:"imageUrl"`
	Message     string                   `json:"message"`
	DashboardId string                   `json:"dashboardId"`
	EvalMatches []map[string]interface{} `json:"evalMatches"`
}

// BodyOnReadAllSizeLimitErr creates a default instance in case of a request size limit error
func BodyOnReadAllSizeLimitErr() *Body {
	return &Body{
		Title:   "undefined",
		Message: "request size limit exceeded",
	}
}

// HandleWebhook returns a http handler function
// h - HandlerFunc parameter is called after request successfully unmarshaled to the Body pointer
// bodyLimit - specifies a body size limit for the request, set 0 to unlimited
func HandleWebhook(h HandlerFunc, bodyLimit int64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// Grafana request body
		var b *Body

		// parse POST/ PUT values to the Grafana Body model
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			if bodyLimit > 0 {
				// set request body limit
				r.Body = http.MaxBytesReader(w, r.Body, bodyLimit)
			}
			reqData, e := ioutil.ReadAll(r.Body)
			if e != nil {
				// read body action has failed
				b = BodyOnReadAllSizeLimitErr()
			} else {
				pluginLogger.Debug(string(reqData))
				json.Unmarshal(reqData, &b)
			}
			// run Grafana HandlerFunc
			if h != nil {
				h(w, b)
			}
		}
	}
}

type HandlerFunc func(w http.ResponseWriter, b *Body)
