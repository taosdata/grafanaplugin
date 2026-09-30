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

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
)

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
