---
name: auth
description: JWT authentication, OAuth2 flows, and API key management
domainkit-domain: authentication
domainkit-dependencies:
domainkit-code-paths: src/modules/auth/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Authentication

## Data Models

`User`: `id`, `email`, `passwordHash` (nullable — null for OAuth-only accounts), `status` (active/suspended/deleted), `createdAt`, `lastLoginAt`.

`ApiKey`: `id`, `userId`, `name`, `keyHash` (SHA-256 of the raw key), `prefix` (first 8 chars of raw key, stored plaintext for display), `scopes` (array of strings), `lastUsedAt`, `expiresAt` (nullable), `revokedAt` (nullable), `createdAt`.

`OAuthAccount`: `userId`, `provider` (github/google/microsoft), `providerUserId`, `accessToken` (encrypted), `refreshToken` (encrypted), `tokenExpiresAt`.

Raw API keys are shown to the user **only once** at creation time. Only `keyHash` is stored. See `references/contract.yaml` for routes.

## Business Rules

**JWT authentication:**
- Tokens are RS256-signed JWTs. Claims: `sub` (userId), `email`, `jti` (UUID), `iat`, `exp` (1 hour).
- Refresh tokens are opaque random strings (32 bytes, hex-encoded), stored hashed in a `RefreshToken` table with a 30-day TTL.
- Rotating refresh: each use of a refresh token issues a new access token AND a new refresh token; the old refresh token is immediately invalidated.
- Token revocation uses a deny-list keyed by `jti` in Redis with TTL equal to the remaining access token lifetime.

**OAuth2:**
- Authorization code flow with PKCE. State parameter is required and validated to prevent CSRF.
- On first OAuth login, a `User` record is created and linked via `OAuthAccount`.
- If an OAuth provider email matches an existing password account, the OAuth account is linked to the existing user (not a new user created). The user is prompted to confirm the link.

**API keys:**
- Scopes follow a `resource:action` pattern (e.g., `data:read`, `data:write`, `webhooks:manage`). A key can only grant scopes the creating user themselves holds.
- Rate limits are applied per API key (see rate-limiting skill).
- Revoked or expired keys must return `401` with body `{ code: "key_revoked" }` or `{ code: "key_expired" }` respectively — not a generic auth error, so clients can handle them distinctly.

## API Surface

See `references/contract.yaml` for full route definitions.

`POST /api/auth/register` — email + password registration.
`POST /api/auth/login` — returns access token and refresh token.
`POST /api/auth/refresh` — exchange refresh token for new token pair.
`POST /api/auth/logout` — revoke current access token and refresh token.
`GET /api/auth/oauth/:provider` — initiate OAuth2 flow; redirects to provider.
`GET /api/auth/oauth/:provider/callback` — OAuth2 callback; exchanges code for tokens.
`GET /api/auth/me` — authenticated user profile.
`POST /api/keys` — create API key; returns raw key once.
`GET /api/keys` — list API keys (prefix and metadata, never raw key).
`DELETE /api/keys/:id` — revoke an API key.

## Gotchas

- Never log access tokens, refresh tokens, or raw API keys. Log the `jti` or key `prefix` only.
- The RS256 private key must never be committed to source control or passed as a plain environment variable string. Use a secrets manager (Vault, AWS Secrets Manager) and load it at startup.
- OAuth `state` must be tied to a server-side session or a signed cookie — do not accept an arbitrary client-supplied state as valid.
- API key lookups must use constant-time comparison when checking the hash to prevent timing attacks. `crypto.timingSafeEqual` in Node.js.
- `lastUsedAt` on `ApiKey` is updated asynchronously (fire-and-forget) — do not block the request on this write. A few-second lag in `lastUsedAt` is acceptable.

## Testing Priorities

1. Refresh token rotation: old token invalid after use; new token valid.
2. Deny-list: revoked access token returns `401` before its `exp`.
3. OAuth account linking: OAuth login with existing email prompts link confirmation, does not create duplicate user.
4. API key scope enforcement: key with `data:read` cannot perform `data:write` operations.
5. Expired API key returns `{ code: "key_expired" }` not a generic 401 body.
