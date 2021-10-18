# Grafana Plugin for TDengine

A [Grafana] plugin for [TDengine] datasource build by [Taosdata Inc.](https://www.taosdata.com)

TDengine backend server implement 1 url:

* `/rest/sqlutc` return data based on input sqls. Please see [Grafana Connector](https://www.taosdata.com/en/documentation/connections#grafana) and [RESTful Connector](https://www.taosdata.com/cn/documentation/connector#restful).

## Installation

To install this plugin, just copy the `dist/` directory to Grafana plugin dir: `/var/lib/grafana/plugins/`. Then restart grafana-server. The new data source should now be available in the data source type dropdown in the **Add Data Source** view.

```sh
sudo rm -rf /var/lib/grafana/plugins/tdengine
sudo cp -r ./dist /var/lib/grafana/plugins/tdengine
# if you use TDengine repo's grafana plugin submodule, use "cp -r <tdengine-extrach-dir>/src/connector/grafanaplugin/dist /var/lib/grafana/plugins/tdengine" instead of above command.

# start grafana service
sudo service grafana-server restart
# or with systemd
sudo systemctl start grafana-server
```

### Dev setup

This plugin requires node >=12.0.0 and Go >= 1.7
```
npm install -g yarn
yarn install
yarn build
```
In order to use the build target provided by the plug-in SDK, you can use the [mage](https://github.com/magefile/mage) build file. After the build is complete, copy mage to $PATH.
```
git clone https://github.com/magefile/mage ../mage
cd ../mage
go run bootstrap.go
```
Run the following to update Grafana plugin SDK for Go dependency to the latest minor version:

```
go get -u github.com/grafana/grafana-plugin-sdk-go
go mod tidy
```
[Build backend plugin binaries](https://grafana.com/tutorials/build-a-data-source-backend-plugin/) for Linux, Windows and Darwin to dist directory:
```
mage -v
```

### Attention
Since version 3.1.0, it began to support the alert function of grafana, but currently its sql statement only supports two variables: `$from` and `$to`.
When using grafana's alert function, you must use `SQL` as the `Type` option. In addition, only `ALIAS BY` and `INPUT SQL` are valid.

### Import Dashboard

After login `http://localhost:3000` , then you can import the tdengine demo dashboard to monitor the system metrics.

Ad as example, you can import the [`dashboard/tdengine-grafana.json`](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/tdengine-grafana.json) (Note that the dashboard panel requires Grafana 6.2+):

![import_dashboard](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import_dashboard.png)

after finished import:

![import_dashboard](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/tdengine_dashboard.png)

[TDengine]: https://github.com/taosdata/TDengine
[Grafana]: https://grafana.com
