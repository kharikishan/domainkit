---
name: "payment-processing"
description: "Handles all payment processing workflows including checkout, refunds, and disputes."
domain: "commerce"
domainkit-version: "1"
domainkit-domain: "commerce"
domainkit-dependencies:
  - "user-auth"
  - "notifications"
domainkit-code-paths:
  - "src/payments"
  - "src/billing"
domainkit-last-verified: "2025-01-15"
domainkit-api-routes:
  - "POST /payments"
  - "GET /payments/:id"
---

## Data Models

### Payment

The core payment entity used across checkout flows.

## Business Rules

- Payments over $10,000 require additional verification.
- Refunds are only allowed within 30 days of purchase.
- All payment events must be logged for audit purposes.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /payments | Initiate a payment |
| GET | /payments/:id | Retrieve payment details |
| POST | /payments/:id/refund | Issue a refund |
