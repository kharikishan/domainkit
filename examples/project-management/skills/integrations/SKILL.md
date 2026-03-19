---
name: integrations
description: Two-way sync with GitHub, Slack notifications, and Jira task import
domainkit-domain: integrations
domainkit-dependencies: tasks projects
domainkit-code-paths: src/modules/integrations/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Integrations

## Data Models

`Integration`: `id`, `projectId`, `provider` (github/slack/jira), `status` (active/paused/error), `config` (encrypted JSON — provider-specific), `createdBy`, `createdAt`, `lastSyncAt`.

`IntegrationEvent`: `id`, `integrationId`, `direction` (inbound/outbound), `eventType`, `payload` (JSON), `status` (pending/processed/failed), `retryCount`, `createdAt`.

Credentials within `config` are encrypted at rest using AES-256-GCM with a key from secrets management. Never log the raw `config` field.

## Business Rules

**GitHub integration:**
- Links a project to a GitHub repository. Opening a GitHub issue creates a task (inbound). Closing a task transitions the linked GitHub issue to closed (outbound).
- Field mapping: GitHub `title` → task `title`, GitHub `body` → task `description`, GitHub `assignees[0].login` → task `assigneeId` (matched by GitHub username stored on `User`).
- Sync is webhook-driven for inbound events. Outbound events are processed from the `IntegrationEvent` queue.

**Slack integration:**
- Posts a message to a configured Slack channel when a task is created, assigned, or overdue.
- Slack slash command `/pm status <taskId>` returns current task status inline.
- No inbound state changes from Slack — Slack is notification-only.

**Jira integration:**
- One-time import of Jira issues into tasks on setup. Ongoing sync is not supported.
- Jira `Story` and `Task` issue types map to tasks. `Epic` maps to projects. `Sub-task` maps to subtasks.
- After import, tasks are independent — changes in Jira are not reflected automatically.

**Error handling:** Failed `IntegrationEvent` records are retried with exponential backoff up to 5 attempts. After 5 failures, `Integration.status` is set to `error` and the project owner is notified. Manual re-activation resets the retry counter.

**Pausing:** An integration in `paused` status does not process inbound webhooks (they are dropped) and does not enqueue outbound events. Existing `pending` events in the queue are held and processed when the integration is resumed.

## API Surface

`GET /api/projects/:projectId/integrations` — list integrations for the project.
`POST /api/projects/:projectId/integrations` — create integration; provider-specific OAuth flow or API key setup.
`PUT /api/projects/:projectId/integrations/:id` — update config or status (pause/resume).
`DELETE /api/projects/:projectId/integrations/:id` — remove integration and stop event processing.
`POST /api/webhooks/:provider/:integrationId` — inbound webhook endpoint; validated with provider-specific HMAC signature.
`POST /api/projects/:projectId/integrations/:id/import` — trigger Jira import (Jira only).

## Gotchas

- Webhook endpoints must validate the provider's HMAC signature before processing any payload. Reject unsigned or invalid requests with 401, not 400 — do not reveal what was wrong.
- GitHub webhook delivery includes a `X-GitHub-Delivery` header (a UUID). Store this in `IntegrationEvent` to detect and deduplicate retried deliveries.
- The Jira import can be long-running (thousands of issues). Always run it as an async job; do not execute synchronously in the HTTP request. Return a job ID and let the client poll.
- Slack message formatting uses Block Kit — do not construct raw text messages. Block Kit payloads are versioned; test against the Slack sandbox before modifying templates.
- OAuth tokens for GitHub and Slack expire or can be revoked externally. On a 401 from the provider, set `Integration.status = error` immediately and alert the project owner rather than endlessly retrying.

## Testing Priorities

1. HMAC validation: invalid signature → 401; valid signature → processed.
2. GitHub deduplication: replaying the same delivery UUID does not create duplicate tasks.
3. Outbound event: completing a task fires an outbound GitHub issue-close event.
4. Retry backoff and error state transition after 5 failures.
5. Jira import mapping: Epic → project, Story/Task → task, Sub-task → subtask.
