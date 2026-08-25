# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

This is the **TDengine Datasource plugin for Grafana** (`tdengine-datasource`, license AGPL-3.0; current version is declared in `src/plugin.json`). Upstream repository: <https://github.com/taosdata/grafanaplugin>. It lets Grafana query [TDengine](https://tdengine.com) (a time-series database) through TDengine's REST API (`taosadapter`, typically port 6041), and ships bundled dashboards (TDinsightV3, TDsmeters, taosX) plus predefined alert rules for TDengine cluster metrics.

The plugin has two halves that are built and tested separately:

- **Frontend** — TypeScript + React code in `src/`, built with webpack into `dist/`. Implements the datasource config page, the SQL query editor, template-variable interpolation, SQL macro expansion, and automatic provisioning of alert rules through Grafana's HTTP API.
- **Backend** — Go code in `pkg/`, built with Mage into a `tdengine-datasource` executable declared in `src/plugin.json` (`"backend": true, "executable": "tdengine-datasource"`). Implements `QueryData` (runs the SQL against TDengine and converts the result into Grafana data frames) and `CheckHealth`.

`src/plugin.json` is the plugin manifest. It requires **Grafana >= 8.0.0**, enables alerting, and declares two proxy routes (`sql` → `/rest/sql`, `sqlutc` → `/rest/sqlutc`) that inject `Authorization: Basic {{ .SecureJsonData.basicAuth }}` and a `token` URL param from secure json data.

### Runtime flow

1. The query editor (`src/components/QueryEditor/QueryEditor.tsx`) accepts raw SQL only (v4.0.0 removed alias/group-by/timeshift UI fields — see "Breaking changes" in README.md).
2. The frontend `DataSource` class (`src/datasource.ts`, extends `DataSourceWithBackend`) interpolates Grafana template variables and expands SQL macros, then forwards the query to the Go backend.
3. The backend (`pkg/plugin/datasource.go`) expands the same macros again, POSTs the SQL to the TDengine REST endpoint, and converts the JSON result into data frames: time-series results are converted from Long to Wide format (`data.LongToWide`), table results are marked `data.FrameTypeTable`.
4. Server version detection happens on **both** sides: `select server_version()` decides whether to use `/rest/sql` (TDengine 3.x) or `/rest/sqlutc` (TDengine 2.x). Keep frontend (`datasource.ts` `request()`) and backend (`datasource.go` `detectEndpoint()`) logic in sync.

### SQL macros

Supported in **both** `src/datasource.ts` (`generateSql`) and `pkg/plugin/datasource.go` (`applyGrafanaTimeMacros` / `getQueryModel`) — any change must be mirrored in both:

- `$from`, `$begin` → range start; `$to`, `$end` → range end (quoted RFC3339 strings)
- `$interval` → panel interval (e.g. `20000a` on frontend / seconds + `s` on backend)
- `$__timeFrom()`, `$__timeTo()` → same as `$from` / `$to`
- `$__timeFilter(ts_col)` → `(ts_col >= $from AND ts_col <= $to)`; a bare `$__timeFilter` without a column argument is an error

### Alert rules

`src/alert_rules.json` contains predefined rule groups (`alert_30s`, `alert_90s`, `alert_1m`, `alert_5m`, `alert_180s`, `alert_24h`). When a datasource is saved with "Load TDengine Alert" enabled, `sendInitAlert()` in `src/datasource.ts` creates a folder `alert-<datasourceUid>-` and provisions the groups via Grafana's provisioning API (Grafana >= 11 only, see `checkGrafanaVersion()` in `src/utils.ts`). `deleteAlerts()` in `src/utils.ts` removes them. The two stream alert rules (Stream Failed Alert / Stream Recalc Failed Alert) live in the `alert_1m` group (60s interval) and carry a `service=stream` label for notification-policy routing (e.g. DingTalk); they use `noDataState: "OK"` (no failure events is the normal state; avoids the `DatasourceNoData` pseudo-alert notifications that `NoData` emits on transitions — a few other event-style rules such as Delete Request Alert and Query Count Alert also use `OK`) and are the only rules with `execErrState: "Error"`. The Stream Failed Alert is event-based (queries `log.taosd_stream_failure`, which taosd reports failures to and which is auto-created on first event) and — like the recalc rule (queries `information_schema.ins_stream_recalculates`) — uses reduce + threshold (`math`) expressions instead of classic_conditions, because classic_conditions merges all series into one label-less instance; reduce keeps per-series labels so each alert instance shows the failing stream and its error code (`stream_name`/`cluster_id` labels + `{{ $values.B }}`), and each failed recalc job carries `stream_name`/`recalc_id`/`progress`/`message` labels (`message` is the failure reason from the recalc view; both stream observability rules require TDengine 3.4.2.7 or later).

Rule groups are provisioned via `ensureAlertGroup()` in `src/datasource.ts`: a missing group is created from the template, while for an already-provisioned group (upgraded data source) only the rule titles whitelisted in `backfillAlertRules` are appended. Existing rules — including user-modified ones — are never modified, and no non-whitelisted rules are appended, so user-deleted legacy rules stay deleted (deleting a whitelisted rule is undone by the next backfill). Two conventions follow: (1) a rule added to `alert_rules.json` for a group that may already exist at users must also be listed in `backfillAlertRules` under that group, otherwise upgraded data sources silently never receive it; (2) rule titles are the stable identity used for this matching — never rename a title in `alert_rules.json` (renaming a rule in the Grafana UI makes the next backfill append a fresh copy alongside the renamed one).

## Repository layout

- `src/` — frontend TypeScript/React source
  - `module.ts` — plugin entry (`DataSourcePlugin` registration)
  - `datasource.ts` — main `DataSource` class (queries, macros, template vars, alert provisioning, health test)
  - `types.ts` — `Query`, `DataSourceOptions`, `SecureJsonData` interfaces
  - `utils.ts` — alert folder/rule-group helpers, Grafana version check
  - `alert_rules.json` — predefined alert rule groups
  - `components/ConfigEditor/` — datasource config page (Basic auth vs TDengine Cloud token; credentials live in `secureJsonData`)
  - `components/QueryEditor/` — SQL-only query editor
  - `dashboards/` — bundled dashboards (`TDinsightV3.json` — includes a collapsed "Stream Computing" row fed by `information_schema` stream views — `TDsmeters.json`, `taosX.json`) plus their docs/wiki sources
  - `plugin.json` — plugin manifest
- `pkg/` — Go backend
  - `main.go` — plugin entry point
  - `plugin/datasource.go` — `QueryData`, `CheckHealth`, frame building, macro expansion, HTTP calls to TDengine
  - `plugin/config.go` — TDengine column-type constants/mappings, `queryModel`, conversion helpers
  - `plugin/datasource_test.go` — backend unit tests (Go `testing` + `stretchr/testify`)
- `.config/` — **auto-generated Grafana scaffolding** (webpack, jest, tsconfig, eslint, prettier, Dockerfile). Do **not** edit files here; extend via the root config files (`.eslintrc`, `.prettierrc.js`, `jest.config.js`, `tsconfig.json`).
- `scripts/` — `package.sh` (zip packaging), `release.sh` / `release.py` (version bump + release), `data-generation/`
- `webhook/` — standalone example Go webhook server (receives Grafana alert notifications on `:9010/sms`), separate `go.mod`
- `examples/` — demo docker-compose stacks for telegraf / collectd / statsd writing into TDengine
- `grafana/` — `grafana.ini` and provisioning for the docker stack
- `assets/` — images used by README/docs
- `.github/workflows/` — CI (`ci.yaml`), release workflows, `trivy-scan.yml`

## Build and test commands

Prerequisites: **Node.js >= 22**, **Yarn 1.22.4** (`packageManager` field), **Go 1.21+** (go.mod targets 1.25; CI uses 1.25), plus `jq` and `zip` for packaging.

```bash
yarn install --frozen-lockfile   # frontend deps
go mod download                  # backend deps

yarn build                       # frontend production bundle -> dist/
yarn dev                         # frontend watch mode
mage                             # backend build (or: go run github.com/magefile/mage@latest)
yarn build:dist                  # frontend + backend -> full dist/

yarn test:ci                     # frontend unit tests (jest, CI mode)
yarn test                        # jest watch mode
go test ./...                    # backend unit tests

yarn typecheck                   # tsc --noEmit
yarn lint                        # eslint (use yarn lint:fix to auto-fix)

yarn server                      # docker compose up --build: Grafana 11.3.0 container
                                 # mounting ./dist as the plugin (unsigned plugin allowed)
yarn package                     # scripts/package.sh: dist/ -> tdengine-datasource-<version>.zip
yarn build:all                   # build + sign (@grafana/sign-plugin) + package
```

CI (`.github/workflows/ci.yaml`, pushes/PRs to `master`/`develop`) runs: `yarn install --frozen-lockfile`, `yarn typecheck`, `yarn test:ci`, `yarn build && yarn sign` (needs `GRAFANA_API_KEY` secret), then backend `mage coverage` and `mage buildAll` via `magefile/mage-action`.

There are jest unit tests in `src/datasource.test.ts`, `src/module.test.ts`, `src/dashboards/dashboards.test.ts`, and `src/components/ConfigEditor/ConfigEditor.test.tsx`. `package.json` still contains cypress-based `e2e` scripts, but there is no e2e test suite in the repo — don't rely on them.

## Code style guidelines

- Frontend: TypeScript (strict per `.config/tsconfig.json`), React 18 function components with hooks (see `useChangeString.tsx`, `useChangeSecureOptions.tsx` patterns in `src/components/`). Formatting/linting is inherited from the Grafana scaffolding configs — run `yarn lint` and `yarn typecheck` before considering frontend work done. Indentation in existing `src/` files is 4 spaces.
- Lint toolchain note: `eslint` is pinned to 9.x in `resolutions` (security fixes), while `@grafana/eslint-config` v7 + `@typescript-eslint` 6.x target eslint 8. `yarn lint` therefore runs with `ESLINT_USE_FLAT_CONFIG=false` (legacy eslintrc mode), `eslint-plugin-react`/`eslint-plugin-jsdoc` are bumped via `resolutions` for eslint 9 API compatibility, and three incompatible rules (`@typescript-eslint/naming-convention`, `@typescript-eslint/consistent-type-assertions`, `deprecation/deprecation`) are disabled in the root `.eslintrc`. The proper fix is migrating to `@grafana/eslint-config` v10 + flat config.
- Backend: standard Go, formatted with `gofmt`; table-driven unit tests with `stretchr/testify` in `pkg/plugin/datasource_test.go`.
- Comments in this codebase are written in English.
- TDengine column types are represented by numeric constants (`CTypeBool` … `CTypeUnsignedBigInt`) and their string forms in `pkg/plugin/config.go`; numeric/integer columns are surfaced to Grafana as `float64` fields (see `getTypeArrayForInt` — required by Grafana frame validation).
- The query model is deliberately minimal after v4.0.0: `queryType` must be `"SQL"` (or empty); legacy `timeShiftPeriod`/`timeShiftUnit` values are **rejected with an error** on both frontend (`getDeprecatedQueryError`) and backend (`getQueryModel`). Don't reintroduce removed fields (`alias`, `colNameFormatStr`, `colNameToGroup`, time shift).

## Security considerations

- Credentials are stored only in `secureJsonData` (`basicAuth`, `token`, `password`, cloud `url`) — never in plain `jsonData`. The backend reads the token via `settings.DecryptedSecureJSONData["token"]` (`pkg/plugin/datasource.go`).
- When logging in the backend, do not include sensitive data (query request objects may contain credentials) — follow the existing comments in `QueryData`/`CheckHealth`.
- `go.mod` carries `replace` directives pinning `golang.org/x/oauth2`, `github.com/golang/glog`, and `go.opentelemetry.io/otel/sdk` to fix CVEs (e.g. CVE-2026-24051) — keep them.
- The repo ships a `trivy.rego` policy and a Trivy scan workflow (`.github/workflows/trivy-scan.yml`); dependency bumps should consider scan results.
- SQL is passed through to TDengine mostly verbatim after macro/variable substitution — be careful not to break escaping/quoting in `generateSql` / `applyGrafanaTimeMacros`.

## Packaging and release

- `yarn build:dist && yarn package` produces `tdengine-datasource-<version>.zip` (version read from `src/plugin.json` via `jq`).
- `scripts/release.sh <version>` bumps the version in `package.json` and `src/plugin.json` and refreshes the `updated` date; release workflows (`.github/workflows/release*.yaml`) automate release PRs and publishing.
- `install.sh` installs the plugin into a local Grafana (plugins dir `/var/lib/grafana/plugins` by default, configurable via env vars); `INSTALLATION.md` has full install instructions.
- `docker-compose.yaml` is for local development (single Grafana container mounting `./dist`). The README "Docker Stack" section and `grafana/` provisioning support a fuller Grafana + AlertManager + webhook demo using `webhook/`.
