package main

import (
	"fmt"
	"os"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	hclog "github.com/hashicorp/go-hclog"
)

var pluginLogger hclog.Logger

func main() {
	logDir := os.Getenv("GF_PATHS_LOGS")
	if logDir == "" {
		logDir = "/var/log/grafana"
	}
	f, err := os.OpenFile(path.Join(logDir, "tdengine_backend.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		fmt.Println(err.Error())
		panic(err)
	}

	pluginLogger = hclog.New(&hclog.LoggerOptions{
		Name:   "tdengine-grafana",
		Level:  hclog.LevelFromString("DEBUG"),
		Output: f,
	})

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
