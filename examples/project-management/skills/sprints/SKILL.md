---
name: sprints
description: Sprint planning cycles, task scoping, and velocity tracking
domainkit-domain: sprint-planning
domainkit-dependencies: tasks projects
domainkit-code-paths: src/modules/sprints/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Sprint Planning

## Data Models

`Sprint`: `id`, `projectId`, `name`, `goal`, `status` (planned/active/completed), `startDate`, `endDate`, `velocity` (points completed, computed at close), `createdAt`.

`SprintTask`: join table linking sprints to tasks. Fields: `sprintId`, `taskId`, `storyPoints`, `addedAt`, `addedBy`. A task can appear in only one active sprint at a time but may exist in multiple historical sprints (for rollover tracking).

## Business Rules

**Sprint constraints:**
- Only one sprint per project can have status `active` at a time.
- `startDate` must be before `endDate`; minimum sprint length is 1 day, maximum 90 days.
- Tasks can only be added to a sprint if they belong to the same project and are in `draft` or `active` state.
- Completed or cancelled tasks cannot be added to a sprint.

**Sprint lifecycle:**
- `planned` → `active` (start sprint; sets `startDate` to now if not set)
- `active` → `completed` (close sprint; computes `velocity` = sum of `storyPoints` for all `completed` tasks in the sprint)
- On close: tasks still in `draft`, `active`, or `blocked` are rolled over to the backlog (removed from the sprint, not deleted).
- There is no re-opening a completed sprint.

**Velocity calculation:** Only tasks in `completed` status at sprint close time contribute to velocity. Tasks completed after the sprint closes do not retroactively update velocity.

**Backlog:** Tasks not in any active sprint are considered backlog items. The backlog is a virtual list — there is no separate data model.

## API Surface

`GET /api/projects/:projectId/sprints` — list all sprints for a project.
`POST /api/projects/:projectId/sprints` — create a new sprint (status defaults to `planned`).
`PUT /api/projects/:projectId/sprints/:id` — update name, goal, dates, or transition status.
`GET /api/projects/:projectId/sprints/:id/tasks` — list tasks in the sprint with their story points.
`POST /api/projects/:projectId/sprints/:id/tasks` — add tasks to sprint with optional story points.
`DELETE /api/projects/:projectId/sprints/:id/tasks/:taskId` — remove a task from the sprint.
`GET /api/projects/:projectId/backlog` — list tasks not assigned to any active sprint.

## Gotchas

- `velocity` is a snapshot computed at close time. Updating task story points after sprint close has no effect on the recorded velocity.
- A project in `on-hold` status cannot start a new sprint, but an existing active sprint is not automatically paused — the team must manually complete or leave it.
- Story points are optional (`storyPoints: null` is valid). Velocity only counts tasks where `storyPoints` is not null.
- Rolling over tasks preserves their story points assignment — if a task is added to the next sprint, the prior `storyPoints` value from `SprintTask` is not copied automatically; the caller must re-supply it.

## Testing Priorities

1. Single active sprint invariant — attempting to start a second sprint while one is active.
2. Sprint close rollover — verify rolled-over tasks are removed from sprint, not deleted, and have correct status.
3. Velocity calculation with mixed task statuses at close time.
4. Adding a task that belongs to a different project — should be rejected.
5. Date validation: end before start, zero-length sprint, exceeding 90 days.
