# Grafana Plugin for TDengine

- [Installation](#installation)
- [Usage](#usage)
  - [Add Data Source](#add-data-source)
  - [Import Dashboard](#import-dashboard)
  - [Alert Feature](#alert-feature)
- [Monitor TDengine Database with TDengine Data Source Plugin](#monitor-tdengine-database-with-tdengine-data-source-plugin)
- [Docker Stack](#docker-stack)
- [Dashboards](#dashboards)

A [Grafana] plugin for [TDengine] datasource build by [Taosdata Inc.](https://www.taosdata.com)

TDengine backend server implements 1 url:

- `/rest/sqlutc` return data for the input sql. Please see [Grafana Connector](https://www.taosdata.com/en/documentation/connections#grafana) and [RESTful Connector](https://www.taosdata.com/cn/documentation/connector#restful).

## Installation

We recommend you use the prebuilt package of the plugin in [github latest release download page](https://github.com/taosdata/grafanaplugin/releases/latest).

For version `3.1.0`, you can download the prebuilt package with `wget`:

```sh
VERSION=3.1.0
wget https://github.com/taosdata/grafanaplugin/releases/download/v$VERSION/tdengine-datasource-$VERSION.zip
unzip tdengine-datasource-$VERSION.zip -d YOUR_PLUGIN_DIR/tdengine
```

In linux, the plugins directory(the above `YOUR_PLUGIN_DIR` real value) is `/var/lib/grafana/plugins/` in most of cases(we'll use this in this documents). In Mac OS, it's `/usr/local/var/lib/grafana/plugins`.

To build and install this plugin by yourself, you should following the [CONTRIBUTING](https://github.com/taosdata/grafanaplugin/blob/master/CONTRIBUTING.md) steps to setup develop environment and build the plugins.

```sh
yarn build
yarn mage
```

After building, just copy the `dist/` directory to Grafana plugin directory.

```sh
sudo rm -rf /var/lib/grafana/plugins/tdengine
sudo cp -r ./dist /var/lib/grafana/plugins/tdengine
```

The next step is restart the Grafana server. The new data source should now be available in the data source type dropdown in the **Add Data Source** view. For systemd based system, the restart command is:

```sh
sudo systemctl restart grafana-server
```

For SysVInit based system (CentOS 6 etc.):

```sh
sudo service grafana-server restart
```

Note that the plugin has not been published to <https://grafana.com> officially (the plugin is under review, as if you want to know) - that means the plugin is unsigned for public use. So if you use it in 7.x and 8.x of grafana, you should configure in `/etc/grafana/grafana.ini` by add these lines to allow unsigned plugin before start the Grafana server:

```ini
[plugins]
allow_loading_unsigned_plugins = tdengine-datasource
```

As second solution, if you want to privately sign the plugin, please follow the [instructions here](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin) to sign a private plugin. The commands are like this:

```sh
export GRAFANA_API_KEY=<YOUR_API_KEY>
yarn run grafana-toolkit plugin:sign --signatureType private --rootUrls 'http://localhost:3000'
```

`rootUrls` is your local grafana server url.

## Usage

Now it's ready for you to add your own TDengine data source and use it in a dashboard.

### Add Data Source

Point to **Configurations** -> **Data Sources** menu and then **Add data source** button.

![add data source button](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-button.png)

Search and choose **TDengine**.
![add data source](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-tdengine.png)

Configure TDengine data source.

![data source configuration](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource.png)

Save and test it, it should say 'TDengine Data source is working'.

![data source test](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-test.png)

### Import Dashboard

Point to **+** / **Create** - **import** (or `/dashboard/import` url).

![import dashboard and config](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import_dashboard.png)

Now you can import dashboard with JSON file or grafana dashboard id (please make sure your network is public to <https://grafana.com>).

Here is the first grafana dashboard you want to use for TDengine, the grafana dashboard id is [`15146`](https://grafana.com/grafana/dashboards/15146).

![import via grafana.com](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import-via-grafana-dot-com.png)

After load:

![import dashboard for tdengine](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import-dashboard-for-tdengine.png)

After import:

![dashboard display](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-dashboard-display.png)

### Alert Feature

Now TDengine data source plugin provides basic alert feature support by backend plugin since version `3.1.0`. But it has some known limits currently:

1. The sql statement only supports two variables: `$from` and `$to`.
2. When using grafana's alert function, you must use `SQL` as the `Type` option. That means, arithmetic expression will not work as you expected for alert.
3. In addition, only `ALIAS BY` and `INPUT SQL` are valid. So alert does not work if you requires the time-shift feature.

We've published a dashboard ([15155](https://grafana.com/grafana/dashboards/15155)) for you to under stand how alert working.

Here is the details:

First, you should have a notification channel, if no, add a new one in <http://localhost:3000/alerting/notification/new>(here we use AlertManager for test, we also provides a webhook example here, in `webhook/` directory)

![notification channel](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/alert-notification-channel.png)

Second, set the alert query in panel like this:

![alert query](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/alert-query-demo.png)

Config the alert rule and notifications:

![alert rule](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/alert-rule-condition-notifications.png)

Test it with **Test rule** button, it should return `firing: true`:

![alert rule test](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/alert-rule-test.png)

In alert manager dashboard, you could see the alert:

![alert manager](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/alert-manager-status.png)

## Monitor TDengine Database with TDengine Data Source Plugin

See [How to Monitor TDengine Cluster with Grafana](https://github.com/taosdata/grafanaplugin/blob/master/HOWTO.md) for the details.

## Docker Stack

For a quick look and test, you can use `docker-compose` to start a full Grafana + AlertManager + Alert Webhook stack:

```sh
docker-compose up -d --build
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

You could open a pr to add one if you want to share your dashboard with TDengine community, we appreciate your contribution!

[TDengine]: https://github.com/taosdata/TDengine
[Grafana]: https://grafana.com
