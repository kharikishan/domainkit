---
name: tasks
description: Task CRUD, status transitions, and assignment rules
domainkit-domain: task-management
domainkit-dependencies:
domainkit-code-paths: src/modules/tasks/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Task Management

## Data Models

A `Task` is the atomic unit of work. Key fields: `id`, `title`, `description`, `status`, `assigneeId`, `projectId`, `dueDate`, `priority` (low/medium/high/urgent), `createdAt`, `updatedAt`. See `references/contract.yaml` for the full schema.

Tasks also carry a `parentTaskId` for subtasks. Subtasks cannot be assigned a priority that exceeds their parent's priority.

## Business Rules

**Status machine** (strict — no skipping steps):
- `draft` → `active` (when explicitly started or assigned)
- `active` → `completed` (when work is done)
- `active` → `blocked` (waiting on external dependency)
- `blocked` → `active` (blocker resolved)
- `completed` → `archived` (after 30-day retention period, automated)
- Any status → `cancelled` (explicit user action, records `cancelledAt`)

**Assignment rules:**
- A task can have at most one assignee at a time. Reassigning a task from `active` state fires a `task.reassigned` event.
- Only project members with role `member`, `admin`, or `owner` can be assigned tasks. Viewers cannot.
- Assigning a `draft` task automatically transitions it to `active`.

**Priority escalation:** If a task's `dueDate` is within 24 hours and status is still `draft` or `blocked`, the system automatically raises priority to `urgent` and notifies the assignee.

## API Surface

Full CRUD at `/api/tasks`. Filtering via query params: `?status=active&assigneeId=...&projectId=...&priority=high`. Pagination uses cursor-based approach (`?after=<taskId>&limit=50`).

Bulk operations: `POST /api/tasks/bulk` accepts `{ action: 'assign'|'transition'|'archive', ids: [], payload: {} }`. Bulk transitions validate the state machine for each task individually and return per-item results.

## Gotchas

- Never mutate `createdAt` — it is set once at insert and never updated, even on restore from archive.
- The `updatedAt` trigger is on the database side; do not set it in application code or you will cause drift in distributed writes.
- Subtask completion does **not** automatically complete the parent. The frontend polls the parent's subtask completion percentage; no server push is involved.
- `cancelled` is a terminal state. There is no restore path — a cancelled task must be duplicated if work needs to resume.
- The `priority` field on the create payload is optional; it defaults to `medium`. Do not default to `low` in new code paths — this changed in v1.2 and some older tests still assert `low`.

## Testing Priorities

1. State machine transition coverage — every valid and every invalid transition.
2. Assignment boundary cases: assigning to a viewer, reassigning mid-sprint, assigning to a user not in the project.
3. Bulk operation atomicity: partial failures should not partially commit.
4. `dueDate` priority escalation job — test with mocked clock, not real timers.
5. Cursor pagination correctness when tasks are inserted between pages.
