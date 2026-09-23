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

package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"webhook/grafana_webhook"
)

func main() {
	addr := "0.0.0.0:9010"
	handler := http.DefaultServeMux
	handler.HandleFunc("/sms", grafana_webhook.HandleWebhook(func(w http.ResponseWriter, b *grafana_webhook.Body) {

		fmt.Printf("Grafana status: %s\n%s\n", b.Title, b.Message)
		// sendMessage(msg)

	}, 0))

	go http.ListenAndServe(addr, handler)
	log.Println(fmt.Sprintf("API is listening on: %s", addr))
	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM, syscall.SIGKILL)
	<-quit
	log.Println("Shutdown WebServer ...")
}
