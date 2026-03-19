---
name: time-tracking
description: Time entry logging against tasks and reporting on hours spent
domainkit-domain: time-tracking
domainkit-dependencies: tasks
domainkit-code-paths: src/modules/time/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Time Tracking

## Data Models

`TimeEntry`: `id`, `taskId`, `userId`, `description`, `startedAt`, `endedAt`, `durationMinutes` (computed on write), `billable` (boolean, default true), `createdAt`, `updatedAt`.

`durationMinutes` is always derived from `endedAt - startedAt` at write time and stored for fast aggregation. Never recompute duration from live timestamps after insert.

## Business Rules

**Entry constraints:**
- `startedAt` must be before `endedAt`. Entries spanning more than 24 hours are rejected (likely a mistake — use multiple entries instead).
- Users can only log time against tasks they can see (i.e., tasks in projects they are a member of). Role does not further restrict logging — viewers can log time if given project access that includes tasks.
- Entries cannot be logged against `cancelled` or `archived` tasks.
- Past entries can be edited, but `startedAt` cannot be moved to a date more than 90 days ago (configurable per organization).

**Rounding:** `durationMinutes` is stored as an integer. Fractional minutes are truncated, not rounded.

**Active timer:** The system supports a single "running" timer per user (an entry with `endedAt: null`). Attempting to start a second running timer auto-stops the first. The running entry must be stopped before reporting queries include it.

**Deletion:** Hard delete is allowed for entries by the entry owner or a project admin. Deleted entries are permanently removed — this is intentional for privacy compliance.

## API Surface

`GET /api/time-entries` — list entries; filter by `?taskId=`, `?userId=`, `?from=`, `?to=`, `?billable=`.
`POST /api/time-entries` — log an entry; supply both `startedAt` and `endedAt` for a completed entry.
`POST /api/time-entries/start` — start a running timer (creates entry with `endedAt: null`).
`POST /api/time-entries/:id/stop` — stop a running timer, setting `endedAt` and computing duration.
`PUT /api/time-entries/:id` — edit an entry; cannot change `userId`.
`DELETE /api/time-entries/:id` — hard delete.
`GET /api/tasks/:taskId/time-summary` — total minutes logged, broken out by user and billable flag.

## Gotchas

- Do not expose `durationMinutes` as an input field on create/update. It is always server-computed. If a client sends it, ignore it silently.
- The running timer check must be transactional — use a database-level unique partial index on `(userId) WHERE endedAt IS NULL` to enforce the single-timer invariant, not application logic alone.
- Reporting queries aggregate `durationMinutes` directly; avoid re-deriving from timestamps for aggregations or you will get floating point inconsistencies.
- `billable` defaults to `true` but can be overridden per organization settings. Check `org.defaultBillable` during entry creation.

## Testing Priorities

1. Timer start/stop cycle — including auto-stop of previous running timer.
2. Duration calculation and storage (verify stored value matches expected truncated minutes).
3. 90-day lookback restriction enforcement.
4. Logging against cancelled/archived tasks — should be rejected.
5. Aggregation accuracy in time-summary endpoint with mixed billable and non-billable entries.
