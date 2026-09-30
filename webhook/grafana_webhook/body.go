// Copyright (c) 2021 TAOS Data, Inc. <jhtao@taosdata.com>
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This program is free software: you can use, redistribute, and/or modify
// it under the terms of the GNU Affero General Public License, version 3
// or later ("AGPL"), as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package grafana_webhook

const (
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
	EvalMatches []map[string]interface{} `json:"evalMatches"`
}

// BodyOnReadAllSizeLimitErr creates a default instance in case of a request size limit error
func BodyOnReadAllSizeLimitErr() *Body {
	return &Body{
		Title:   "undefined",
		Message: "request size limit exceeded",
	}
}
