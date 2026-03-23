---
name: monitoring
description: Structured logging, metrics collection, and distributed tracing for the API platform
domainkit-domain: observability
domainkit-dependencies: auth rate-limiting
domainkit-code-paths: src/modules/monitoring/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Observability (Logging, Metrics, Tracing)

## Data Models

There are no application database tables in this domain. All observability data flows to external systems:
- Logs → structured JSON to stdout, collected by the log aggregator (e.g., Loki, CloudWatch Logs).
- Metrics → emitted via StatsD UDP to a metrics backend (e.g., Prometheus via push gateway, Datadog).
- Traces → OpenTelemetry spans exported to the configured OTLP endpoint (e.g., Jaeger, Honeycomb).

`RequestLog` (the shape of each log line): `traceId`, `spanId`, `timestamp`, `level`, `method`, `path`, `resolvedVersion`, `userId` (nullable), `keyPrefix` (nullable), `statusCode`, `durationMs`, `rateLimitRemaining`, `errorCode` (nullable), `errorMessage` (nullable).

## Business Rules

**Structured logging:**
- All log lines are JSON. No free-form string logs in production code paths.
- Log levels: `debug` (dev only), `info` (normal request lifecycle), `warn` (recoverable issues, rate limit approaches), `error` (unhandled exceptions, downstream failures).
- PII rules: never log email addresses, passwords, raw tokens, or API keys. Log `userId` (UUID) and key `prefix` only. Scrub any field named `password`, `token`, `secret`, `authorization` before logging.

**Request metrics (emitted per request):**
- `api.request.count` (counter): tagged with `method`, `path_template` (not raw path — use `/api/users/:id` not `/api/users/abc-123`), `status_code`, `version`.
- `api.request.duration_ms` (histogram): same tags.
- `api.rate_limit.rejected` (counter): tagged with `key_type` (api_key/user/ip).

**Trace propagation:** Traces use W3C `traceparent` header. If the incoming request has a `traceparent`, extract it and continue the trace. If not, start a new trace. Always propagate `traceId` in outbound service calls and job enqueue calls.

**Health endpoints** (not versioned, not authenticated):
- `GET /health` — liveness: returns `{ status: "ok" }` with `200` if the process is running.
- `GET /health/ready` — readiness: checks database connectivity and Redis connectivity; returns `503` if either is unavailable.

**Alerting thresholds** (configured in the alerting system, not in code):
- Error rate > 1% over 5-minute window → page on-call.
- p99 latency > 2s over 5-minute window → page on-call.
- Rate limit rejection rate > 20% of total requests → warn.

## API Surface

`GET /health` — liveness check; no auth.
`GET /health/ready` — readiness check; no auth.
`GET /api/admin/metrics/summary` — admin: last-hour request counts, error rates, and top-10 slowest endpoints.
`GET /api/admin/audit-log` — admin: recent security-relevant events (logins, key creation, permission errors). Paginated; `?userId=`, `?from=`, `?to=`.

## Gotchas

- `path_template` in metrics tags is critical. If you tag with raw paths, high-cardinality user IDs will explode the metrics cardinality and crash most metrics backends. Always normalize paths before tagging.
- The `GET /health/ready` endpoint must not be behind authentication middleware — the load balancer's health check will fail if it requires a token.
- Trace context must be propagated into background jobs. When enqueuing a job, store the `traceId` and `spanId` as job metadata. The job worker reconstructs the trace context before starting its span.
- Scrubbing PII from logs must happen at the logger level, not at each call site. Implement a `sanitize(obj)` function in the logger that recursively redacts known sensitive field names.
- StatsD emissions are UDP — they are fire-and-forget. A metrics backend being down must never affect API response times. Wrap all metric calls in a try-catch that swallows errors silently.

## Testing Priorities

1. PII scrubbing: log output for a request containing `password` and `authorization` fields contains neither.
2. Path template normalization: request to `/api/users/some-uuid` emits metric tag `path=/api/users/:id`.
3. Trace propagation: outbound call to a downstream service includes `traceparent` header derived from inbound trace.
4. Readiness endpoint: returns `503` when database is unreachable; does not require auth token.
5. Audit log: admin login, key creation, and permission denial events all appear with correct metadata.
