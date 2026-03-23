---
name: "order-management"
description: "Handles order lifecycle from creation to fulfillment."
domainkit-domain: "beta"
domainkit-dependencies:
  - "user-auth"
domainkit-code-paths:
  - "src/orders"
domainkit-last-verified: "2025-02-10"
---

## Data Models

Order management domain skill for the beta domain, depends on domain-a (user-auth).

## Business Rules

- Orders can only be placed by authenticated users.
- Orders cannot be modified after they are shipped.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /orders | Create a new order |
| GET | /orders/:id | Get order details |
