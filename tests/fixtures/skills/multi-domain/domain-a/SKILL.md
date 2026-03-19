---
name: "user-auth"
description: "Handles user authentication and authorization workflows."
domainkit-domain: "alpha"
domainkit-code-paths:
  - "src/auth"
domainkit-last-verified: "2025-02-01"
---

## Data Models

User authentication domain skill for the alpha domain.

## Business Rules

- Users must be authenticated before accessing protected resources.
- Tokens expire after 24 hours.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Authenticate user |
| POST | /auth/logout | Invalidate user session |
