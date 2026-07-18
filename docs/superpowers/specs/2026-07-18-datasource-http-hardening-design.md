# Datasource HTTP Hardening Design

## Context

Version 4.0.1 adds TLS support and restores support for the Base64 Basic Auth value used by existing TDengine datasource configurations and the bundled provisioning scripts. Grafana SDK Basic Auth middleware reapplies credentials to redirected requests, so a cross-origin redirect can bypass Go's normal removal of the `Authorization` header. The same branch also began reading non-200 response bodies before checking their status so TDengine error descriptions could be returned.

The current CI workflow builds and signs the frontend without running the existing Jest tests or TypeScript type checking. Existing error messages also interpolate raw SQL into routine HTTP and TDengine failures.

## Goals

- Preserve legacy and currently provisioned Basic Auth configurations.
- Prevent datasource credentials, tokens, and SQL request bodies from reaching redirect targets.
- Bound memory used to inspect non-200 TDengine responses.
- Remove raw SQL from error-level messages and Grafana error responses.
- Run frontend tests and type checking in pull request CI.
- Document the user-visible redirect behavior in the 4.0.1 release notes.

## Non-Goals

- Do not migrate datasource credentials to a new provisioning format.
- Do not add a redirect configuration option.
- Do not limit successful HTTP 200 query responses.
- Do not change the existing Debug-level SQL log in this patch.
- Do not redesign the datasource error model or sanitize arbitrary TDengine descriptions.

## Design

### Redirect Policy

After creating the Grafana SDK HTTP client, configure `CheckRedirect` to return `http.ErrUseLastResponse` for every redirect. The datasource then receives the 3xx response, closes its body through the existing response lifecycle, and reports it as a non-successful HTTP status.

This policy applies consistently to endpoint detection, health checks, and queries, regardless of whether authentication comes from Grafana standard fields, the compatibility fallback, or a cloud token. TDengine REST endpoints are fixed API endpoints and are not expected to require redirects. Users whose proxy currently redirects must configure the final TDengine endpoint URL.

### Non-200 Response Limit

For non-200 responses, read at most 64 KiB plus one detection byte. Parse the TDengine `code` and `desc` only when the body fits within the limit. If the body exceeds the limit or is not valid TDengine JSON, return the HTTP status without a TDengine description.

Continue using the existing unrestricted read for HTTP 200 query responses so large successful query behavior remains unchanged.

### SQL-Free Errors

Remove SQL interpolation from the two routine failure messages:

- Non-200 HTTP responses report HTTP code, status, and an available bounded TDengine description.
- HTTP 200 responses with a non-zero TDengine code report the TDengine code and description without `query.Sql`.

Because the resulting error no longer contains SQL, existing Error-level logging and `backend.ErrDataResponse` propagation also stop exposing it. Debug SQL logging remains outside this patch.

### CI

Add separate frontend type-check and test steps before build and signing:

```text
yarn typecheck
yarn test:ci
```

Separate steps keep failures attributable and do not change the existing build or signing commands.

### Release Notes

Update both `CHANGELOG.md` and the README 4.0.1 section with user-facing notes that:

- Datasource HTTP requests no longer follow redirects and the configured URL must be the final TDengine endpoint.
- Raw SQL is no longer included in datasource error responses and Error-level logs.

## Testing

- Verify a 307 target is never contacted by a datasource client using compatibility Basic Auth.
- Exercise both query and health-check requests with the no-redirect client policy.
- Verify 401 and 5xx errors contain status and TDengine details but not a sentinel SQL string.
- Verify HTTP 200 with TDengine `code != 0` contains code and description but not sentinel SQL.
- Verify an oversized non-200 body reads no more than the configured limit plus one byte and falls back to the HTTP status.
- Run Go tests, Jest tests, TypeScript checking, and the production frontend build.

## Compatibility

The Basic Auth fallback and TDinsight provisioning contract remain unchanged. Grafana 8 and Grafana 13 use the same backend policy. The only intentional behavior change is that a configured datasource URL returning 3xx no longer redirects automatically.
