---
name: reporting
description: Dashboard metrics, progress reports, and data exports across tasks, sprints, and time
domainkit-domain: reporting
domainkit-dependencies: tasks projects sprints time-tracking
domainkit-code-paths: src/modules/reports/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Reporting

## Data Models

Reports are not persisted entities — they are computed on demand from the underlying task, sprint, and time-entry tables. However, `ReportExport` records are kept for audit: `id`, `userId`, `reportType`, `params` (JSON), `format` (csv/pdf), `fileUrl`, `createdAt`, `expiresAt`.

Export files are stored in object storage (S3-compatible). `fileUrl` is a pre-signed URL valid until `expiresAt` (default 24 hours).

## Business Rules

**Available report types:**

- `task-summary`: counts by status, priority, and assignee within a project or date range.
- `sprint-velocity`: velocity trend across the last N sprints (default 5, max 20).
- `burndown`: remaining story points over the course of an active or completed sprint.
- `time-by-member`: hours logged per user within a project and date range.
- `time-by-task`: hours logged per task, with billable breakdown.

**Access control:** Reports are scoped to projects the requesting user is a member of. A user with `viewer` role can view reports but cannot export them. Export is restricted to `member` and above.

**Caching:** Dashboard summary queries (task-summary, sprint-velocity) are cached with a 5-minute TTL per `(projectId, reportType)` key. Cache is invalidated on any task or sprint write event in that project. Do not cache burndown — it must reflect real-time data.

**Exports:** Generating an export is asynchronous. `POST /api/reports/export` enqueues a job and returns `202 Accepted` with a job ID. The client polls `GET /api/reports/exports/:jobId` for status. On completion, `fileUrl` is populated.

## API Surface

`GET /api/projects/:projectId/reports/task-summary` — task count breakdown.
`GET /api/projects/:projectId/reports/sprint-velocity` — velocity trend; `?lastN=5`.
`GET /api/projects/:projectId/reports/burndown/:sprintId` — burndown chart data points.
`GET /api/projects/:projectId/reports/time-by-member` — time per member; `?from=&to=`.
`GET /api/projects/:projectId/reports/time-by-task` — time per task; `?from=&to=`.
`POST /api/reports/export` — enqueue export job; body: `{ projectId, reportType, params, format }`.
`GET /api/reports/exports/:jobId` — poll export status and retrieve `fileUrl`.

## Gotchas

- Burndown data points are computed from task completion events, not current task state. If historical events were deleted or not recorded, the burndown will appear incomplete. Do not reconstruct burndown from current `updatedAt` timestamps.
- The `time-by-member` and `time-by-task` reports only count `endedAt IS NOT NULL` entries — running timers are excluded. Document this clearly in the API response metadata.
- CSV exports may contain PII (assignee names, email addresses). Exports must be logged in `ReportExport` for compliance, and `expiresAt` must be enforced — the storage cleanup job must actually delete the file, not just expire the URL.
- Sprint velocity averages should exclude sprints cancelled mid-flight (those with zero completed tasks and a close reason of `cancelled`). These are outliers that distort trends.

## Testing Priorities

1. Access control: viewer cannot export; non-member cannot view any report for the project.
2. Cache invalidation: verify a task status change busts the task-summary cache.
3. Export lifecycle: enqueue → job runs → fileUrl populated → expiry enforced.
4. Burndown correctness: verify data points reflect event history, not current state.
5. Velocity averaging with cancelled sprint exclusion.
