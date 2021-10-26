# Grafana Plugin for TDengine

A [Grafana] plugin for [TDengine] datasource build by [Taosdata Inc.](https://www.taosdata.com)

TDengine backend server implement 1 url:

* `/rest/sqlutc` return data for the input sql. Please see [Grafana Connector](https://www.taosdata.com/en/documentation/connections#grafana) and [RESTful Connector](https://www.taosdata.com/cn/documentation/connector#restful).

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

## Create Data Source

Point to **Configurations** -> **Data Sources** menu and then **Add data source** button.

![add data source button](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-button.png)

Search and choose **TDengine**.
![add data source](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-tdengine.png)

Configure TDengine data source.

![data source configuration](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource.png)

Save and test it, it should say 'TDengine Data source is working'.

![data source test](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-add-datasource-test.png)

## Import Dashboard

Point to **+** / **Create** - **import** (or `/dashboard/import` url).

![import dashboard and config](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import_dashboard.png)

Now you can import dashboard with JSON file or grafana dashboard id (please make sure your network is public to <https://grafana.com>).

Here is the first grafana dashboard you want to use for TDengine, the grafana dashboard id is [`15146`](https://grafana.com/grafana/dashboards/15146).

![import via grafana.com](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import-via-grafana-dot-com.png)

After load:

![import dashboard for tdengine](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/import-dashboard-for-tdengine.png)

After import:

![dashboard display](https://raw.githubusercontent.com/taosdata/grafanaplugin/master/dashboard/howto-dashboard-display.png)

### Attention

Since version 3.1.0, it began to support the alert function of grafana, but currently its sql statement only supports two variables: `$from` and `$to`.

When using grafana's alert function, you must use `SQL` as the `Type` option. In addition, only `ALIAS BY` and `INPUT SQL` are valid.

[TDengine]: https://github.com/taosdata/TDengine
[Grafana]: https://grafana.com
