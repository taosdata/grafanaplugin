# Datasource HTTP Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent authenticated datasource requests from following redirects, bound non-200 response reads, remove raw SQL from routine errors, and run frontend checks in CI.

**Architecture:** Keep Grafana SDK HTTP client construction and existing authentication compatibility, then apply a client-level no-redirect policy. Split `doHttpPost` response handling by status so only error responses are bounded, and remove SQL at the two error-construction sites so downstream logs and Grafana responses inherit the safe message.

**Tech Stack:** Go 1.24, Grafana Plugin SDK HTTP client, `net/http`, Testify, GitHub Actions, Yarn/Jest/TypeScript.

---

## File Map

- `pkg/plugin/datasource.go`: HTTP client redirect policy, bounded non-200 reads, SQL-free errors.
- `pkg/plugin/datasource_test.go`: redirect, SQL de-identification, and response-limit regression tests.
- `.github/workflows/ci.yaml`: frontend type-check and Jest steps.
- `CHANGELOG.md`: 4.0.1 security and redirect behavior notes.
- `README.md`: 4.0.1 user-facing behavior notes.

### Task 1: Reject Datasource Redirects

**Files:**
- Modify: `pkg/plugin/datasource.go:51`
- Test: `pkg/plugin/datasource_test.go`
- Include: `docs/superpowers/plans/2026-07-18-datasource-http-hardening.md`

- [ ] **Step 1: Write the failing redirect regression test**

Add `fmt`, `io`, `strings`, and `sync/atomic` imports as needed. Add a test that allows the initial version request, redirects subsequent query and health-check requests with HTTP 307, and records whether the target is contacted:

```go
func TestNewDatasourceRejectsRedirectsForQueryAndHealthCheck(t *testing.T) {
	const username = "root"
	const password = "taosdata"
	var redirectedRequests atomic.Int32

	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		redirectedRequests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":[["unexpected redirect"]]}`))
	}))
	t.Cleanup(target.Close)

	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if string(body) == "select server_version()" {
			gotUsername, gotPassword, ok := r.BasicAuth()
			if !ok || gotUsername != username || gotPassword != password {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"code":0,"data":[["3.3.0.0"]]}`))
			return
		}
		http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
	}))
	t.Cleanup(source.Close)

	encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	instance, err := NewDatasource(context.Background(), backend.DataSourceInstanceSettings{
		URL: source.URL,
		DecryptedSecureJSONData: map[string]string{"basicAuth": encoded},
	})
	require.NoError(t, err)
	t.Cleanup(func() { instance.(interface{ Dispose() }).Dispose() })

	datasource := instance.(*Datasource)
	_, err = datasource.queryDataFromDatasource(context.Background(), &queryModel{Sql: "select 1"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "307")

	health, err := datasource.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, health.Status)
	assert.Contains(t, health.Message, "307")
	assert.Zero(t, redirectedRequests.Load())
}
```

- [ ] **Step 2: Run the redirect test and verify it fails**

Run:

```bash
rtk go test ./pkg/plugin -run TestNewDatasourceRejectsRedirectsForQueryAndHealthCheck -count=1
```

Expected: FAIL because the SDK client follows the 307 and the target receives the query.

- [ ] **Step 3: Disable redirects on the SDK HTTP client**

Immediately after `httpclient.New(ops)` succeeds, configure:

```go
client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
	return http.ErrUseLastResponse
}
```

This returns the 3xx response to `doHttpPost` without issuing another request.

- [ ] **Step 4: Format and run the redirect and existing Basic Auth/TLS tests**

Run:

```bash
rtk gofmt -w pkg/plugin/datasource.go pkg/plugin/datasource_test.go
rtk go test ./pkg/plugin -run 'TestNewDatasource(RejectsRedirectsForQueryAndHealthCheck|UsesLegacyBasicAuth|TLSSettings)' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit the redirect policy**

```bash
rtk git add pkg/plugin/datasource.go pkg/plugin/datasource_test.go docs/superpowers/plans/2026-07-18-datasource-http-hardening.md
rtk git commit -m "fix: reject datasource HTTP redirects"
```

### Task 2: Bound Error Bodies and Remove SQL from Errors

**Files:**
- Modify: `pkg/plugin/datasource.go:414`
- Modify: `pkg/plugin/datasource.go:509`
- Test: `pkg/plugin/datasource_test.go`

- [ ] **Step 1: Add a reusable test RoundTripper**

Add this test-only adapter near the existing logger helpers:

```go
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}
```

- [ ] **Step 2: Write failing SQL de-identification tests**

Add a table test for 401, 500, and HTTP 200 with a non-zero TDengine code. Execute through `Datasource.query`, capture Error-level logs with `recordingLogger`, and assert neither `response.Error` nor any Error log argument contains the sentinel query:

```go
func TestQueryErrorsDoNotExposeSQL(t *testing.T) {
	const sql = "select 'tdengine-super-secret-query'"
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       []string
	}{
		{name: "unauthorized", statusCode: http.StatusUnauthorized, body: `{"code":855,"desc":"Authentication failure"}`, want: []string{"401", "855", "Authentication failure"}},
		{name: "server error", statusCode: http.StatusInternalServerError, body: `{"code":1,"desc":"Internal error"}`, want: []string{"500", "1", "Internal error"}},
		{name: "TDengine business error", statusCode: http.StatusOK, body: `{"code":9728,"desc":"Invalid operation"}`, want: []string{"9728", "Invalid operation"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(test.statusCode)
				_, _ = w.Write([]byte(test.body))
			}))
			t.Cleanup(server.Close)

			logger := &recordingLogger{Logger: backendlog.NewNullLogger()}
			originalLogger := backendlog.DefaultLogger
			backendlog.DefaultLogger = logger
			t.Cleanup(func() { backendlog.DefaultLogger = originalLogger })

			queryJSON, err := json.Marshal(map[string]string{"queryType": "SQL", "sql": sql})
			require.NoError(t, err)
			datasource := &Datasource{client: server.Client(), endpoint: server.URL}
			response := datasource.query(context.Background(), backend.PluginContext{}, backend.DataQuery{JSON: queryJSON})

			require.Error(t, response.Error)
			assert.NotContains(t, response.Error.Error(), sql)
			for _, expected := range test.want {
				assert.Contains(t, response.Error.Error(), expected)
			}
			for _, entry := range logger.errors {
				assert.NotContains(t, fmt.Sprint(entry.args...), sql)
			}
		})
	}
}
```

- [ ] **Step 3: Write the failing bounded-body test**

Use a `strings.Reader` to prove the client consumes no more than the limit plus one byte:

```go
func TestDoHTTPPostLimitsErrorResponseBody(t *testing.T) {
	payload := strings.Repeat("x", maxErrorResponseBodyBytes*2)
	reader := strings.NewReader(payload)
	datasource := &Datasource{client: &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Status:     "500 Internal Server Error",
			Header:     make(http.Header),
			Body:       io.NopCloser(reader),
			Request:    request,
		}, nil
	})}}

	_, err := datasource.doHttpPost(context.Background(), "http://tdengine.invalid/rest/sql", "select 1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "500")
	assert.Equal(t, maxErrorResponseBodyBytes+1, len(payload)-reader.Len())
}
```

- [ ] **Step 4: Run the new error tests and verify they fail**

Run:

```bash
rtk go test ./pkg/plugin -run 'Test(QueryErrorsDoNotExposeSQL|DoHTTPPostLimitsErrorResponseBody)' -count=1
```

Expected: FAIL because SQL is present in errors and non-200 bodies are fully read.

- [ ] **Step 5: Implement SQL-free business errors**

Change the non-zero TDengine result error to:

```go
err = fmt.Errorf("query data error, %s", formatTDengineError(result.Code, result.Desc))
```

- [ ] **Step 6: Split response reads by HTTP status and enforce the limit**

Define:

```go
const maxErrorResponseBodyBytes = 64 * 1024
```

Replace the unconditional body read and non-200 block with:

```go
if resp.StatusCode != http.StatusOK {
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxErrorResponseBodyBytes+1))
	if readErr != nil {
		return nil, fmt.Errorf("read HTTP error response: %w", readErr)
	}

	message := fmt.Sprintf("http request received code: %d, status %s", resp.StatusCode, resp.Status)
	if len(body) <= maxErrorResponseBodyBytes {
		if detail := tdengineErrorFromBody(body); detail != "" {
			message += ", " + detail
		}
	}
	return nil, fmt.Errorf("%s", message)
}

body, readErr := io.ReadAll(resp.Body)
if readErr != nil {
	return nil, fmt.Errorf("read HTTP response: %w", readErr)
}
return body, nil
```

- [ ] **Step 7: Format and run focused and full backend tests**

Run:

```bash
rtk gofmt -w pkg/plugin/datasource.go pkg/plugin/datasource_test.go
rtk go test ./pkg/plugin -run 'Test(QueryErrorsDoNotExposeSQL|DoHTTPPostLimitsErrorResponseBody|CheckHealthIncludesTDengineDescription)' -count=1
rtk go test ./pkg/plugin -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit backend error hardening**

```bash
rtk git add pkg/plugin/datasource.go pkg/plugin/datasource_test.go
rtk git commit -m "fix: harden datasource error handling"
```

### Task 3: Enforce Frontend Checks and Update Release Notes

**Files:**
- Modify: `.github/workflows/ci.yaml:50`
- Modify: `CHANGELOG.md:5`
- Modify: `README.md:100`

- [ ] **Step 1: Add explicit CI checks before frontend build**

Add these steps after dependency installation:

```yaml
      - name: Typecheck frontend
        run: yarn typecheck

      - name: Test frontend
        run: yarn test:ci

      - name: Build and sign frontend
        run: yarn build && yarn sign
        env:
          GRAFANA_API_KEY: ${{ secrets.GRAFANA_API_KEY }}
```

Replace the existing misleading `Build and test frontend` step.

- [ ] **Step 2: Update 4.0.1 release notes**

Add these bullets to the 4.0.1 Bug Fixes section in `CHANGELOG.md` and equivalent bullets in the README 4.0.1 list:

```text
- Disabled automatic HTTP redirects for datasource requests; configure the datasource URL to the final TDengine endpoint.
- Removed raw SQL from datasource error responses and Error-level logs.
```

- [ ] **Step 3: Run frontend checks exactly as CI will run them**

Run:

```bash
rtk yarn typecheck
rtk yarn test:ci
rtk yarn build
```

Expected: all commands PASS. Do not run signing locally because it requires `GRAFANA_API_KEY`.

- [ ] **Step 4: Validate workflow syntax and documentation diff**

Run:

```bash
rtk git diff --check
rtk git diff -- .github/workflows/ci.yaml CHANGELOG.md README.md
```

Expected: no whitespace errors; diff contains only the two CI checks, renamed build step, and 4.0.1 notes.

- [ ] **Step 5: Commit CI and release notes**

```bash
rtk git add .github/workflows/ci.yaml CHANGELOG.md README.md
rtk git commit -m "ci: run frontend tests and type checking"
```

### Task 4: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Confirm Go files are formatted**

```bash
rtk gofmt -d pkg/plugin/datasource.go pkg/plugin/datasource_test.go
```

Expected: no output.

- [ ] **Step 2: Run all relevant checks from a clean test state**

```bash
rtk go test ./pkg/plugin -count=1
rtk yarn typecheck
rtk yarn test:ci
rtk yarn build
rtk git diff --check
```

Expected: every command PASS.

- [ ] **Step 3: Review final branch state**

```bash
rtk git status --short --branch
rtk git log --oneline origin/feat/support-tls..HEAD
```

Expected: clean worktree and local commits for the design, redirect policy, backend error hardening, and CI/release notes. Do not push or tag.
