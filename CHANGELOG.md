# Changelog

All notable changes to this project will be documented in this file.

## [3.3.4] - 2023-07-25

### Bug Fixes

- Fix for http status code dashboard

### Enhancements

- Check tdengine api schema in tdinsight.sh
- Delete login history dashboard

### Build

- Bump word-wrap from 1.2.3 to 1.2.4 (#218)

## [3.3.3] - 2023-07-12

### Bug Fixes

- Fix for http status code
- Fix for taoskeeper prometheus dashboard v3
- Fix for tdinsight v3 and prometheus v3 dashboard

### Documentation

- Update tdinsight document

### Enhancements

- Add default value to database and delete `user db`

### Features

- Add taoskeeper prometheus dashboard (#209)

### Build

- Bump google.golang.org/grpc from 1.41.0 to 1.53.0 (#213)
- Bump semver from 5.7.1 to 5.7.2 (#214)

## [3.3.2] - 2023-04-13

### Bug Fixes

- Remove group by
- Adapt keepColName params
- Set datasource for http status code dashboard (#200)
- Fix for total tables (#201)
- Fix for table summary
- Fix for table data type
- Fix for duplicate metric name

### Enhancements

- Support variables query key/value

### Build

- Bump webpack from 5.75.0 to 5.76.0 (#195)

## [3.3.1] - 2023-03-15

### Bug Fixes

- Revert `testDatasource` function
- Change httpclient and delete sensitive log
- Delete token from log (#184)
- Typos
- Typos
- Fix for telegraf dashboard (#187)
- Fix for unused formatType config
- Delete console log in datasource.ts (#191)
- Refactor readme and upgrade dependence and fix tdinsight v3
- Typos
- Fix for log (#194)

### Documentation

- Add readme for tdinsight v3

### Enhancements

- Refactor by grafana/create-plugin (#179)

### Build

- Fix release workflow for missing module.js.map
- Fix release work flow

## [3.2.9] - 2023-02-08

### Bug Fixes

- Tdinsight v3.x support grafana 7.x (#170)
- Fix http request dashboard
- Fix block while format column name
- Add error message when query data error

### Enhancements

- Support multi dimension alert
- Add http_status_code dashboard (#173)

### Features

- Support set legend alias by setting format-str

### Build

- Add license to dist

## [3.2.8] - 2022-12-29

### Bug Fixes

- Delete frame name, otherwise this name will override data column name
- Tdinsight dashboard show error

## [3.2.7] - 2022-11-15

### Bug Fixes

- Fix TDinsight.sh --offline error (#152)
- Change time unit and placement of charts (#153)
- Telegraf conf refine (#154)
- Fix page fault for TDinsight v3 in grafana (#161)

### Documentation

- Add install plugin from config section (#157)
- Readme add bullet link (#158)
- Wording align with official doc (#159)
- Fix a few typos and wording

### Enhancements

- Grafana plugin support TDengine 3.0 (#162)

## [3.2.6] - 2022-08-12

### Bug Fixes

- Install.sh -p not work
- Fix offline plugin not found error (#146)
- Compatible with python2 (#148)
- Modify taosAdapter http_request_total dashboard
- Add error reason
- Add V3 dashboard
- Timestamp code

### CI

- Fix ci syntax error

### Documentation

- Update README for data source name settings

### Enhancements

- Do not cache zip file when there's no python in system (#138)
- Anyone can request a release by pr
- Match 3.0 (#149)

## [3.2.5] - 2022-06-10

### Bug Fixes

- Auto detect sudo command in installer (#135)
- Fix --plugin-version bug and support cloud token like install.sh (#136)

### Enhancements

- Remove unused timeInterval in provisioning configurations (#137)

## [3.2.4] - 2022-06-08

### Bug Fixes

- Fix url params lost with cloud token in secure json data

### Features

- Improve telegraf example and publish to Grafana (#133)
- Add install.sh as one-line installer

## [3.2.3] - 2022-06-02

### Bug Fixes

- Remove user/password in backend plugin config (#131)

### Documentation

- Fix basic auth generation comment error (#130)

## [3.2.2] - 2022-05-30

### Bug Fixes

- Fix datasource test check bug (#128)

## [3.2.1] - 2022-05-26

### Bug Fixes

- Remove sensitive logging, fix ts layout format parsing method (#127)

## [3.2.0] - 2022-05-25

### Bug Fixes

- Fix bug when label not match while group by multi column (#124)

### Documentation

- V3.1.7 released as signed (#121)

### Features

- Group by multiple columns implicitly (#122)
- Store user, password, token in secureJsonData
- Use secureJsonData for all sensitive data
- Add dashboards tab in data source configuration page

## [3.1.7] - 2022-05-14

### CI

- Sign plugin before release (#119)

### Features

- Add config option for cloud service token (#118)

## [3.1.6] - 2022-05-05

### Bug Fixes

- Change link to tdengine.com for plugin-check (#117)

## [3.1.5] - 2022-05-05

### Bug Fixes

- Rename timestamp _ts to ts (#112)
- Add --offline/--download-only pair options (#113)
- Fix warnings by grafana plugin validator (#116)

### [TD-13076]<fix>

- Update dependencies (#99)

### [TD-13320]<docs>

- Add instruction for TDinsight (#100)
- Enrich TDinsight introduction in en/cn (#101)

### [TD-13366]<docs>

- Update installation instructions of datasource plugin in tdinsight (#102)

### [TD-13540]<fix>

- Fail if grafana not installed in TDinsight.sh (#104)

### [TD-13556]<feat>

- Add taosadapter metrics (#106)

### [TD-13722]<fix>

- Remove Requests (Inserts) panel in Requests row (#105)

### [TD-14180]<fix>

- Fix cpu and memory percent in taosAdapter (#108)

### [TDREL-24]<docs>

- Add installation instruction for macOS (#110)

## [3.1.4] - 2022-01-14

### [TD-11474]<docs>

- Improve TDinsight documentations (#84)

### [TD-11556]<docs>

- Add chinese version of TDinsight user manual (#85)

### [TD-11589]<docs>

- Apply review suggestions (#87)

### [TD-11900]<docs>

- Use relative image links for official website link (#90)
- Remove toc and fix images display in website (#92)

### [TD-12501]<docs>

- Add upgrade/uninstall section for TDinsight (#94)

### [TM-1532]<docs>

- Image minor fix for TDinsight (#93)

### [TS-1125]<fix>

- Compatible to grafana 5.2.4 (#97)

### [TS-781]<fix>

- Use show databases instead of select distinct(database_name) from vgroups_info (#91)

### [TS-790]<fix>

- Fix incrrect time range in TDinsight disk/net panels (#88)

## [3.1.3] - 2021-11-26

### [10610]<fix>

- Fix TD-11023 TD-11024 TD-11079 TDinsight dashboard bugs (#71)

### [TD-10610]<fix>

- Update TDinsight dashboard layout (#75)
- Push sms alert. (#77)

### [TD-11003]<fix>

- Interval replaced once error

### [TD-11078]<fix>

- Fix backend plugin error in case of integer types (#72)

### [TD-11092]<fix>

- Consist TDinsight time interval by variable
- Update time interval and default it as auto

### [TD-11147]<fix>

- Fill(null) caused taosadapter/httpd coredump (#76)

### [TD-11242]<fix>

- Data source config sms. (#79)

### [TD-11243]<feat>

- Add provisioning script for TDinsight (#81)

### [TD-11245]<fix>

- Fix value mapping error in VNnodes Masters (#78)

### [TD-11414]<fix>

- Grafanaplugin alert error. (#82)

### [TD-11441]<fix>

- Fix ts layout error 2021-11-26T03:06:00Z and improve documents (#83)

## [3.1.2] - 2021-11-12

### [TD-10854]<fix>

- GENERATE SQL error.

### [TD-11002]<release>

- Release v3.1.2 (#68)

### [TS-552]<fix>

- Support group by col.
- Support group by col.
- Support group by col.
- Support group by col.

## [3.1.1] - 2021-10-31

### Bug Fixes

- Grafana-webhook submodule url not found (#64)

### Documentation

- Fix directory name in package script
- Fix typo by @jtao1735

### [TD-10584]<docs>

- Add TDengine Dashboard with alert support (#62)

### [TD-10618]<fix>

- Generate the latest sql

### [TD-10760]<fix>

- Could not locate user error.
- Could not locate user error.

### [TD-10808]<release>

- Update grafana plugin version to v3.1.1 (#63)

## [3.1.0] - 2021-10-27

### Features

- 实现metricFindQuery方法,解决查询值的问题

### [TD-10477]<fix>

- A much better dashboard for 7.x grafana (#38)

### [TD-10484]<fix>

- B is not defined error. (#39)

### [TD-10549]<fix>

- Grafana plugin alert error.
- Grafana plugin alert error.

### [TD-10552]<docs>

- Add collectd dashboard example (#45)

### [TD-10612]<docs>

- Support datasource selection in TDengine new dashboard (#50)

### [TD-10617]<docs>

- Add grafana dashboard for telegraf (#43)

### [TD-10618]<fix>

- Plugin variable repeat error. (#42)

### [TD-10636]<docs>

- Add statsd fake dashboard (#46)

### [TD-10637]<fix>

- Fix grafana dashboard error for telegraf (#47)

### [TD-10774]<fix>

- Remove dist/ directory in grafanaplugin source (#52)

### [TD-10777]<fix>

- Add CI and Release workflow in GitHub Actions, and fix warnings in submission (#54)

### [TD-10791]<docs>

- Fix some typos, add howto section (#56)

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

- Add how to monitor TDengine with Grafana document (#40)

### [TD-6030]<fix>

- Tdengine restful api (#36)

### [TS-76]<fix>

- Fix grafana datasource api in 6.x (#29)

<!-- generated by git-cliff -->
