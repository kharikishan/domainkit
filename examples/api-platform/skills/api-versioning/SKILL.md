---
name: api-versioning
description: API version strategies, breaking change management, and deprecation lifecycle
domainkit-domain: api-versioning
domainkit-dependencies:
domainkit-code-paths: src/modules/versioning/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# API Versioning

## Data Models

`ApiVersion`: `version` (string, e.g. "2024-01-15"), `status` (current/supported/deprecated/sunset), `releasedAt`, `deprecatedAt` (nullable), `sunsetAt` (nullable), `changelog` (text).

Versions use a date-based scheme (`YYYY-MM-DD`), not semantic versioning. Each version represents a stable contract snapshot. Callers opt in to a version by passing `Domainkit-Version: 2024-01-15` in the request header or via `?version=` query param (header takes precedence).

There is no `VersionedRequest` database model — version resolution is handled at the middleware layer.

## Business Rules

**Version resolution:**
1. If `Domainkit-Version` header is present and valid, use it.
2. If `?version=` query param is present and no header, use it.
3. If neither is supplied, use the **minimum supported version** (not latest). This prevents new integrations from silently getting old behavior.
4. If the requested version is `sunset`, return `410 Gone` with migration guidance.
5. If the requested version is `deprecated`, serve the request but include a `Deprecation` header and a `Sunset` header (RFC 8594).

**Version lifecycle:**
- `current`: the latest stable version. Only one version can be `current` at a time.
- `supported`: older versions still receiving bug fixes but no new features.
- `deprecated`: version will be sunset; no new features or bug fixes. Deprecation notice period is minimum 6 months.
- `sunset`: no longer served; requests return `410`.

**Breaking vs non-breaking changes:**
- Non-breaking (additive): new optional fields, new endpoints, new enum values. These are added to the current version without a new version date.
- Breaking: removing fields, changing field types, changing endpoint behavior, removing enum values. These always require a new version date.

**Versioned routing:** Route handlers are organized under `src/modules/versioning/handlers/<version>/`. Shared logic lives in service modules. Version middleware selects the correct handler file for the resolved version. When a version is removed, its handler directory is deleted — do not leave dead code.

## API Surface

`GET /api/versions` — list all API versions with their status, release date, and sunset date.
`GET /api/versions/:version` — detail for a specific version including changelog.

Response headers on all versioned API responses:
- `Domainkit-Version: <resolvedVersion>` — always present; the version that was used to serve the response.
- `Deprecation: <date>` — present when resolved version is `deprecated`.
- `Sunset: <date>` — present when resolved version is `deprecated` (date of planned removal).

## Gotchas

- Defaulting to the latest version for unauthenticated or version-free requests sounds convenient but creates surprise breaking changes for existing integrations when a new version becomes current. Always default to the minimum supported version.
- The `Sunset` header date must be reliable — if you extend a sunset date, update the header. Clients may build automated monitors on this header.
- Version middleware must run before authentication middleware so that a `410 Gone` can be returned even for unauthenticated requests against sunsetted versions. Do not put version checks after auth.
- "Non-breaking" new enum values are actually breaking for clients using exhaustive switch statements. Document all enum additions in the changelog and list them as "potentially breaking".
- When adding a new field to a response, ensure it is present (with a null or empty value) in all older supported versions too, not just the current version. Missing fields in older versions break clients that pin to those versions.

## Testing Priorities

1. Version resolution priority: header overrides query param; no version param → minimum supported version.
2. `410 Gone` for sunset version with correct body including migration URL.
3. `Deprecation` and `Sunset` headers present on deprecated version responses.
4. New current version: exactly one version has `current` status at a time.
5. Handler routing: version 2023-01-01 handler invoked when that version is requested, not the current handler.
