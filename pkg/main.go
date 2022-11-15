package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var pluginLogger = log.DefaultLogger

func main() {
	pluginLogger.Debug("start")
	// Start listening to requests send from Grafana. This call is blocking so
	// it wont finish until Grafana shuts down the process or the plugin choose
	// to exit close down by itself
	err := datasource.Serve(newDatasource())

	// Log any error if we could start the plugin.
	if err != nil {
		pluginLogger.Error(err.Error())
		os.Exit(1)
	}
}
