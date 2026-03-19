---
name: permissions
description: Role-based access control and project-level authorization rules
domainkit-domain: authorization
domainkit-dependencies:
domainkit-code-paths: src/modules/auth/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Authorization (RBAC)

## Data Models

`User`: `id`, `email`, `passwordHash`, `globalRole` (user/admin), `createdAt`, `lastActiveAt`.

`ProjectMember`: `projectId`, `userId`, `role` (owner/admin/member/viewer). This is the primary authorization source for all project-scoped actions.

There are no separate `Permission` rows — capabilities are derived from role at runtime.

## Business Rules

**Global roles:**
- `user`: default; can create projects and manage their own profile.
- `admin`: platform-level superuser; can access all projects and impersonate users for support purposes. Audit-log all admin actions.

**Project roles (most to least privileged):**
| Capability | owner | admin | member | viewer |
|---|---|---|---|---|
| Delete project | yes | no | no | no |
| Archive project | yes | no | no | no |
| Manage members | yes | yes | no | no |
| Start/close sprints | yes | yes | no | no |
| Create/edit tasks | yes | yes | yes | no |
| Assign tasks | yes | yes | yes | no |
| Log time | yes | yes | yes | yes |
| View tasks/reports | yes | yes | yes | yes |
| Export reports | yes | yes | yes | no |

**Authorization checks must be performed at the service layer**, not only in route middleware. Route middleware can reject unauthenticated requests, but role checks belong in service methods so they are enforced even for internal calls (e.g., from job workers).

**Token format:** JWTs signed with RS256. Claims: `sub` (userId), `email`, `globalRole`, `exp`, `iat`. Project membership is not embedded in the token — it is looked up per request to reflect real-time role changes.

**Session invalidation:** Tokens are stateless. To forcibly invalidate a token (e.g., after password change), maintain a `TokenDenylist` with `(jti, expiresAt)`. Only the JTI (JWT ID) is stored, not the full token. Deny-list entries are cleaned up after `exp` passes.

## API Surface

`POST /api/auth/register` — create a new user account; returns JWT.
`POST /api/auth/login` — authenticate; returns JWT with `exp: now + 24h`.
`POST /api/auth/logout` — add current token's JTI to deny-list.
`POST /api/auth/refresh` — issue a new token from a valid, non-expired token.
`GET /api/auth/me` — return authenticated user profile.
`PUT /api/auth/me` — update email or password; changing password invalidates all other sessions.

## Gotchas

- JWTs contain `globalRole` but not project roles. Never cache project membership in the token — role changes would not take effect until token expiry.
- The deny-list lookup adds latency. Use a Redis `SET` with TTL matching `exp` for O(1) checks. Do not store deny-list in the primary database.
- RS256 means the public key must be distributed to any service that validates tokens. Keep the private key in secrets management (never in env vars in plain text in source).
- Password reset flows must also add all existing tokens for that user to the deny-list. Iterate `TokenDenylist` entries is not needed — store a `passwordChangedAt` timestamp on `User` and reject any token with `iat < passwordChangedAt`.

## Testing Priorities

1. Each role attempting each restricted action — assert correct allow/deny for all combinations.
2. Token denial after logout — reuse of a logged-out token must return 401.
3. `passwordChangedAt` invalidation: tokens issued before password change are rejected.
4. Global admin impersonation: confirm audit log entry is created.
5. Project role changes take effect immediately (no stale role cached in request context).
