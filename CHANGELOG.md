# Changelog

All notable changes to this project will be documented in this file.

## [3.2.2] - 2022-05-30

### Bug Fixes

- Fix datasource test check bug ([#128](https://github.com/orhun/git-cliff/issues/128))

## [3.2.1] - 2022-05-26

### Bug Fixes

- Remove sentitive logging, fix ts layout format parsing method ([#127](https://github.com/orhun/git-cliff/issues/127))

### Miscellaneous Tasks

- Bump grunt from 1.5.2 to 1.5.3

### Release

- V3.2.1

## [3.2.0] - 2022-05-25

### Bug Fixes

- Fix bug when label not match while group by multi column ([#124](https://github.com/orhun/git-cliff/issues/124))

### Documentation

- V3.1.7 released as signed ([#121](https://github.com/orhun/git-cliff/issues/121))

### Features

- Group by multiple columns implicitly ([#122](https://github.com/orhun/git-cliff/issues/122))
- Store user, password, token in secureJsonData
- Use secureJsonData for all sensitive data
- Add dashboards tab in data source configuration page

### Miscellaneous Tasks

- Remove unused code

### Release

- V3.2.0 ([#125](https://github.com/orhun/git-cliff/issues/125))

## [3.1.7] - 2022-05-14

### Features

- Add config option for cloud service token ([#118](https://github.com/orhun/git-cliff/issues/118))

### Miscellaneous Tasks

- Change tdengine screenshot for signed plugin

### Ci

- Sign plugin before release ([#119](https://github.com/orhun/git-cliff/issues/119))

### Release

- V3.1.7

## [3.1.6] - 2022-05-05

### Bug Fixes

- Change link to tdengine.com for plugincheck ([#117](https://github.com/orhun/git-cliff/issues/117))

## [3.1.5] - 2022-05-05

### Bug Fixes

- Rename timestamp _ts to ts ([#112](https://github.com/orhun/git-cliff/issues/112))
- Add --offline/--download-only pair options ([#113](https://github.com/orhun/git-cliff/issues/113))
- Fix warnings by grafana plugin validator ([#116](https://github.com/orhun/git-cliff/issues/116))

### [TD-13076]<fix>

- Update dependencies ([#99](https://github.com/orhun/git-cliff/issues/99))

### [TD-13320]<docs>

- Add instruction for TDinsight ([#100](https://github.com/orhun/git-cliff/issues/100))
- Enrich TDinsight introduction in en/cn ([#101](https://github.com/orhun/git-cliff/issues/101))

### [TD-13366]<docs>

- Update installation instructions of datasource plugin in tdinsight ([#102](https://github.com/orhun/git-cliff/issues/102))

### [TD-13540]<fix>

- Fail if grafana not installed in TDinsight.sh ([#104](https://github.com/orhun/git-cliff/issues/104))

### [TD-13556]<feat>

- Add taosadapter metrics ([#106](https://github.com/orhun/git-cliff/issues/106))

### [TD-13722]<fix>

- Remove Requests (Inserts) panel in Requests row ([#105](https://github.com/orhun/git-cliff/issues/105))

### [TD-14180]<fix>

- Fix cpu and memery percent in taosAdapter ([#108](https://github.com/orhun/git-cliff/issues/108))

### [TDREL-24]<docs>

- Add installation instruction for macOS ([#110](https://github.com/orhun/git-cliff/issues/110))

## [3.1.4] - 2022-01-14

### Miscellaneous Tasks

- Fix TDinsight README error ([#86](https://github.com/orhun/git-cliff/issues/86))

### [TD-11474]<docs>

- Improve TDinsight documentations ([#84](https://github.com/orhun/git-cliff/issues/84))

### [TD-11556]<docs>

- Add chinese version of TDinsight user manual ([#85](https://github.com/orhun/git-cliff/issues/85))

### [TD-11589]<docs>

- Apply review suggestions ([#87](https://github.com/orhun/git-cliff/issues/87))

### [TD-11900]<docs>

- Use relative image links for official website link ([#90](https://github.com/orhun/git-cliff/issues/90))
- Remove toc and fix images display in website ([#92](https://github.com/orhun/git-cliff/issues/92))

### [TD-12501]<docs>

- Add upgrade/uninstall section for TDinsight ([#94](https://github.com/orhun/git-cliff/issues/94))

### [TM-1532]<docs>

- Image minor fix for TDinsight ([#93](https://github.com/orhun/git-cliff/issues/93))

### [TS-1125]<fix>

- Compatible to grafana 5.2.4 ([#97](https://github.com/orhun/git-cliff/issues/97))

### [TS-781]<fix>

- Use show databases instead of select distinct(database_name) from vgroups_info ([#91](https://github.com/orhun/git-cliff/issues/91))

### [TS-790]<fix>

- Fix incrrect time range in TDinsight disk/net panels ([#88](https://github.com/orhun/git-cliff/issues/88))

## [3.1.3] - 2021-11-26

### [10610]<fix>

- Fix TD-11023 TD-11024 TD-11079 TDinsight dashboard bugs ([#71](https://github.com/orhun/git-cliff/issues/71))

### [TD-10610]<fix>

- Update TDinsight dashboard layout ([#75](https://github.com/orhun/git-cliff/issues/75))
- Push sms alert. ([#77](https://github.com/orhun/git-cliff/issues/77))

### [TD-11003]<fix>

- Interval replaced once error

### [TD-11078]<fix>

- Fix backend plugin error in case of integer types ([#72](https://github.com/orhun/git-cliff/issues/72))

### [TD-11092]<fix>

- Consist TDinsight time interval by variable
- Update time interval and default it as auto

### [TD-11147]<fix>

- Fill(null) caused taosadapter/httpd coredump ([#76](https://github.com/orhun/git-cliff/issues/76))

### [TD-11242]<fix>

- Data source config sms. ([#79](https://github.com/orhun/git-cliff/issues/79))

### [TD-11243]<feat>

- Add provisioning script for TDinsight ([#81](https://github.com/orhun/git-cliff/issues/81))

### [TD-11245]<fix>

- Fix value mapping error in VNnodes Masters ([#78](https://github.com/orhun/git-cliff/issues/78))

### [TD-11414]<fix>

- Grafanaplugin alert error. ([#82](https://github.com/orhun/git-cliff/issues/82))

### [TD-11441]<fix>

- Fix ts layout error 2021-11-26T03:06:00Z and improve documents ([#83](https://github.com/orhun/git-cliff/issues/83))

## [3.1.2] - 2021-11-12

### [TD-10854]<fix>

- GENERATE SQL error.

### [TD-11002]<release>

- Release v3.1.2 ([#68](https://github.com/orhun/git-cliff/issues/68))

### [TS-552]<fix>

- Support group by col.
- Support group by col.
- Support group by col.
- Support group by col.

## [3.1.1] - 2021-10-31

### Bug Fixes

- Grafana-webhook submodule url not found ([#64](https://github.com/orhun/git-cliff/issues/64))

### Documentation

- Fix directory name in package script
- Fix typo by @jtao1735

### [TD-10584]<docs>

- Add TDengine Dashboard with alert support ([#62](https://github.com/orhun/git-cliff/issues/62))

### [TD-10618]<fix>

- Generate the latest sql

### [TD-10760]<fix>

- Could not locate user error.
- Could not locate user error.

### [TD-10808]<release>

- Update grafana plugin version to v3.1.1 ([#63](https://github.com/orhun/git-cliff/issues/63))

## [3.1.0] - 2021-10-27

### Features

- 实现metricFindQuery方法,解决查询值的问题

### Miscellaneous Tasks

- Remove dist/taosdata-tdengine-* binaries ([#44](https://github.com/orhun/git-cliff/issues/44))
- Fix name alias error in telegraf dashboard json model ([#48](https://github.com/orhun/git-cliff/issues/48))

### [TD-10477]<fix>

- A much better dashboard for 7.x grafana ([#38](https://github.com/orhun/git-cliff/issues/38))

### [TD-10484]<fix>

- B is not defined error. ([#39](https://github.com/orhun/git-cliff/issues/39))

### [TD-10549]<fix>

- Grafana plugin alert error.
- Grafana plugin alert error.

### [TD-10552]<docs>

- Add collectd dashboard example ([#45](https://github.com/orhun/git-cliff/issues/45))

### [TD-10612]<docs>

- Support datasource selection in TDengine new dashboard ([#50](https://github.com/orhun/git-cliff/issues/50))

### [TD-10617]<docs>

- Add grafana dashboard for telegraf ([#43](https://github.com/orhun/git-cliff/issues/43))

### [TD-10618]<fix>

- Plugin variable repeat error. ([#42](https://github.com/orhun/git-cliff/issues/42))

### [TD-10636]<docs>

- Add statsd fake dashboard ([#46](https://github.com/orhun/git-cliff/issues/46))

### [TD-10637]<fix>

- Fix grafana dashboard error for telegraf ([#47](https://github.com/orhun/git-cliff/issues/47))

### [TD-10774]<fix>

- Remove dist/ directory in grafanaplugin source ([#52](https://github.com/orhun/git-cliff/issues/52))

### [TD-10777]<fix>

- Add CI and Release workflow in GitHub Actions, and fix warnings in submission ([#54](https://github.com/orhun/git-cliff/issues/54))

### [TD-10791]<docs>

- Fix some typos, add howto section ([#56](https://github.com/orhun/git-cliff/issues/56))

### [TD-4310]<feature>

- Support variables

### [TD-4906]<fix>

- Fix demo dashboard import error in Grafana 6.2

### [TD-5014]<feature>

- Support timeshift for query result

### [TD-5109]<feature>

- Support arithmetic calculation among queris

### [TD-5215]<fix>

- Fix read property 'status' of undefined

### [TD-5232]<fix>

- Fix dashboard import unexpected view

### [TD-5233]<enhance>

- Solve warnings in build

### [TD-5736]<docs>

- Add how to monitor TDengine with Grafana document ([#40](https://github.com/orhun/git-cliff/issues/40))

### [TD-6030]<fix>

- Tdengine restful api ([#36](https://github.com/orhun/git-cliff/issues/36))

### [TS-76]<fix>

- Fix grafana datasource api in 6.x ([#29](https://github.com/orhun/git-cliff/issues/29))

<!-- generated by git-cliff -->
