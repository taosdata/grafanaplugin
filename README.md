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
