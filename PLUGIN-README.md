# Grafana Plugin for TDengine

- [Usage](#usage)
  - [Add Data Source](#add-data-source)
  - [Import Dashboard](#import-dashboard)
  - [Alert Feature](#alert-feature)
- [Monitor TDengine Database with TDengine Data Source Plugin](#monitor-tdengine-database-with-tdengine-data-source-plugin)
  - [TDinsight](#tdinsight)
- [Docker Stack](#docker-stack)
- [Dashboards](#dashboards)

[TDengine] is open-sourced big data platform under GNU AGPL v3.0, designed and optimized for the Internet of Things (IoT), Connected Cars, Industrial IoT, and IT Infrastructure and Application Monitoring, developed by [TAOS Data](https://taosdata.com/).

[TDengine] data source plugin is developed for [Grafana]. This document explains how to install and configure the data source plugin, and use it as a time-series database. We'll take a look at the data source options, variables, querying, and other options specific to this data source. 

## Usage

At first, please refer to [Add a data source](https://grafana.com/docs/grafana/latest/datasources/add-a-data-source/) for instructions on how to add a data source to Grafana. Note that, only users with the organization admin role can add data sources.

### Add Data Source

Point to **Configurations** -> **Data Sources** menu and then **Add data source** button.

![add data source button](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/howto-add-datasource-button.png)

Search and choose **TDengine**.
![add data source](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/howto-add-datasource-tdengine.png)

If TDengine is not in the list, please check the installation instructions for allowing loading unsigned plugins.

Configure TDengine data source.

![data source configuration](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/howto-add-datasource.png)

Save and test it, it should say 'TDengine Data source is working'.

![data source test](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/howto-add-datasource-test.png)

### Import Dashboard

Point to **+** / **Create** - **import** (or `/assets/import` url).

![import dashboard and config](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/import_dashboard.png)

Now you can import dashboard with JSON file or grafana dashboard id (please make sure your network is public to <https://grafana.com>).

Here is the first grafana dashboard you want to use for TDengine, the grafana dashboard id is [`15146`](https://grafana.com/grafana/dashboards/15146).

![import via grafana.com](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/import-via-grafana-dot-com.png)

After load:

![import dashboard for tdengine](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/import-dashboard-for-tdengine.png)

After import:

![dashboard display](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/howto-dashboard-display.png)

### Alert Feature

Now TDengine data source plugin provides basic alert feature support by backend plugin since version `3.1.0`. But it has some known limits currently:

1. The sql statement only supports two variables: `$from` and `$to`.
2. When using grafana's alert function, you must use `SQL` as the `Type` option. That means, arithmetic expression will not work as you expected for alert.
3. In addition, only `ALIAS BY` and `INPUT SQL` are valid. So alert does not work if you requires the time-shift feature.

We've published a dashboard ([15155](https://grafana.com/grafana/dashboards/15155)) for you to under stand how alert working.

Here is the details:

First, you should have a notification channel, if no, add a new one in <http://localhost:3000/alerting/notification/new>(here we use AlertManager for test, we also provides a webhook example here, in `webhook/` directory)

![notification channel](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/alert-notification-channel.png)

Second, set the alert query in panel like this:

![alert query](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/alert-query-demo.png)

Config the alert rule and notifications:

![alert rule](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/alert-rule-condition-notifications.png)

Test it with **Test rule** button, it should return `firing: true`:

![alert rule test](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/alert-rule-test.png)

In alert manager dashboard, you could see the alert:

![alert manager](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/assets/alert-manager-status.png)

## Monitor TDengine Database with TDengine Data Source Plugin

See [How to Monitor TDengine Cluster with Grafana](https://github.com/taosdata/grafanaplugin/blob/master/HOWTO.md) for the details.

### TDinsight

TDinsight is a simple monitoring solution for TDengine database. See [TDinsight README](https://github.com/taosdata/grafanaplugin/blob/master/dashboards/TDinsight.md) for the details.

## Docker Stack

For a quick look and test, you can use `docker-compose` to start a full Grafana + AlertManager + Alert Webhook stack:

```sh
docker-compose up -d
```

Services:

- Grafana: <http://localhost:3000>
- AlertManager: <http://localhost:9093>, in docker it's <http://alertmanager:9010/sms>
- Webhook: <http://localhost:9010/sms>, in docker it's <http://webhook:9010/sms>

## Dashboards

You can get other dashboards in the examples directory, or search in grafana with TDengine datasource <https://grafana.com/grafana/dashboards/?orderBy=downloads&direction=desc&dataSource=tdengine-datasource> .

Here is a short list:

- [15146](https://grafana.com/grafana/dashboards/15146): Multiple TDengines Monitoring Dashboard
- [15155](https://grafana.com/grafana/dashboards/15155): TDengine Alert Demo
- [15167](https://grafana.com/grafana/dashboards/15167): TDsinght

You could open a pr to add one if you want to share your dashboard with TDengine community, we appreciate your contribution!

[TDengine]: https://github.com/taosdata/TDengine
[Grafana]: https://grafana.com
