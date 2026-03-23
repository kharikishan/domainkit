---
name: projects
description: Project lifecycle management and member role administration
domainkit-domain: project-management
domainkit-dependencies: tasks
domainkit-code-paths: src/modules/projects/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Project Management

## Data Models

A `Project` groups tasks and members. Fields: `id`, `name`, `description`, `status` (planning/active/on-hold/completed/archived), `ownerId`, `startDate`, `targetDate`, `createdAt`, `updatedAt`.

A `ProjectMember` join record carries: `projectId`, `userId`, `role` (owner/admin/member/viewer), `joinedAt`, `invitedBy`.

## Business Rules

**Lifecycle:**
- `planning` → `active` (owner or admin starts the project)
- `active` → `on-hold` (can be done by owner/admin; blocks task creation)
- `on-hold` → `active`
- `active` → `completed` (requires all non-cancelled tasks to be in `completed` or `archived` state)
- Any non-archived → `archived` (owner only; irreversible through UI)

**Member roles:**
- `owner`: one per project, always. Transferring ownership creates a new `owner` record and demotes the previous owner to `admin`. Cannot leave the project — must transfer first.
- `admin`: can invite/remove members, manage sprints, modify project settings.
- `member`: can create, edit, and transition tasks they are assigned to or created.
- `viewer`: read-only access to tasks and project data; cannot be assigned tasks.

**Cascade on archival:** When a project is archived, all `active` tasks are transitioned to `cancelled` with `cancelledAt` set. Tasks already `completed` are left as-is.

**Soft delete:** Projects are never hard-deleted. `status: archived` is the terminal state, and archived projects are excluded from default list queries (pass `?includeArchived=true` to include them).

## API Surface

`GET /api/projects` — list projects for the authenticated user (projects they are a member of).
`POST /api/projects` — create; creator becomes `owner` automatically.
`GET /api/projects/:id` — full project detail including member list.
`PUT /api/projects/:id` — update name, description, dates, status (state-machine validated).
`GET /api/projects/:id/members` — paginated member list.
`POST /api/projects/:id/members` — invite a user by email or userId; specify role.
`PUT /api/projects/:id/members/:userId` — change a member's role.
`DELETE /api/projects/:id/members/:userId` — remove a member; cannot remove the owner.

## Gotchas

- Completing a project does not fire individual `task.completed` events for already-completed tasks — it fires a single `project.completed` event. Do not rely on task events to detect project completion.
- `targetDate` is advisory and never enforced by the system. It is exposed in the dashboard for display only.
- When an on-hold project transitions back to active, it does **not** automatically restore tasks that were blocked during the hold; those remain `blocked` until manually resolved.
- Pagination for members uses offset-based pagination (`?page=1&limit=20`), unlike task pagination which is cursor-based. This inconsistency is intentional for now (member lists are small and stable).

## Testing Priorities

1. Role-based access for every project mutation (especially viewer attempting to create a task).
2. Ownership transfer: verify old owner is demoted, new owner is set, single owner invariant holds.
3. Project completion pre-condition: at least one test where uncompleted tasks block completion.
4. Archival cascade: confirm active tasks are cancelled and completed tasks are untouched.
5. Member removal edge case: attempting to remove the sole owner.
