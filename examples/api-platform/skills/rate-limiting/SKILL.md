---
name: rate-limiting
description: Per-key and per-user rate limits, quota management, and throttling
domainkit-domain: rate-limiting
domainkit-dependencies: auth
domainkit-code-paths: src/modules/rate-limiting/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Rate Limiting

## Data Models

Rate limit state is stored in Redis only — no database tables. Keys follow the pattern:

- Per API key: `rl:key:{keyId}:{windowStart}` → request count (integer)
- Per user (JWT auth): `rl:user:{userId}:{windowStart}` → request count
- Per IP (unauthenticated): `rl:ip:{ipHash}:{windowStart}` → request count

`RateLimitConfig` (loaded from config, not database): `tier` (free/pro/enterprise), `requestsPerMinute`, `requestsPerHour`, `requestsPerDay`, `burstAllowance`.

`QuotaUsage` (database, for billing-relevant metering): `id`, `userId`, `month` (YYYY-MM), `apiCallCount`, `lastUpdatedAt`. Updated in batches every 5 minutes, not per-request.

## Business Rules

**Algorithm:** Fixed window counters in Redis with `INCR` + `EXPIRE`. Windows align to the clock (minute/hour/day boundaries), not rolling from first request.

**Tier limits (defaults):**
| Tier | Per minute | Per hour | Per day |
|---|---|---|---|
| free | 60 | 1,000 | 10,000 |
| pro | 600 | 20,000 | 200,000 |
| enterprise | 6,000 | unlimited | unlimited |

**Burst allowance:** Each tier gets a burst pool equal to 2× the per-minute limit, replenished at 1× per-minute rate. Implemented as a token bucket alongside the fixed window. The token bucket state is also in Redis.

**Priority:** Limits are checked in order: IP (unauthenticated) → API key → user. The most restrictive applicable limit applies. An API key limit does not stack with a user limit — the lower of the two takes effect.

**Rate limit headers:** Every response includes:
- `X-RateLimit-Limit`: per-minute limit for this caller
- `X-RateLimit-Remaining`: remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when current window resets
- `Retry-After`: present only on `429` responses (seconds to wait)

**429 response body:** `{ "error": "rate_limit_exceeded", "limit": 60, "remaining": 0, "resetAt": "<ISO timestamp>" }`

## API Surface

`GET /api/rate-limit/status` — returns current usage for the authenticated caller across all windows (minute/hour/day).
`GET /api/admin/rate-limits` — admin: list all per-key and per-user current usage snapshots.
`PUT /api/admin/users/:userId/rate-limit` — admin: override rate limit tier for a specific user.
`POST /api/admin/rate-limits/reset` — admin: reset rate limit counters for a specific key or user (for support use).

## Gotchas

- Redis `INCR` is atomic; use it rather than GET-then-SET to avoid race conditions. The increment-and-expire pattern: `INCR key` then `EXPIRE key <windowSeconds>` only on the first increment (check return value of INCR is 1).
- Fixed windows can cause "thundering herd" at window boundaries when all callers reset simultaneously. This is an accepted trade-off for simplicity; document it for consumers.
- IP-based limiting must use a hashed IP (SHA-256), not the raw IP, in the Redis key to avoid storing PII in Redis.
- The `X-RateLimit-Remaining` header should reflect the per-minute window (most immediate limit), not the per-day window. Sending the per-day remaining on every response is misleading.
- `QuotaUsage` is for metering/billing display only — do not use it for real-time enforcement. It lags by up to 5 minutes.

## Testing Priorities

1. Window alignment: requests at minute boundary correctly start a new window.
2. Burst allowance: up to 2× limit allowed in a burst; subsequent requests within the window are rejected.
3. Concurrent INCR: simulate parallel requests to verify no counter under/over count.
4. Rate limit headers: verify all four headers present on every response; `Retry-After` only on 429.
5. Admin reset: resetting counters immediately allows requests that were previously throttled.
