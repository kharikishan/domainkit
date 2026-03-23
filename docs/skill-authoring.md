# Skill Authoring Guide

This guide covers how to write effective domain skills that help AI agents produce correct, consistent code.

## Quick Start with Personas

Instead of starting from a blank template, use a **persona** to generate skills with sections tailored to a specific perspective:

```bash
# Developer perspective (architecture, patterns, dependencies, API usage)
dk add payments --persona developer --domain payments --description "Payment processing"

# Domain-expert perspective (business rules, invariants, domain events, edge cases)
dk add payments --persona domain-expert --domain payments --description "Payment processing"

# See all available personas
dk persona list

# Create a custom persona for your team
dk persona create security-engineer
```

Personas generate different SKILL.md sections but follow the same frontmatter format. You can always edit the generated file to add or remove sections.

## Anatomy of a Skill

Every skill is a folder containing at minimum a `SKILL.md` file:

```
skills/
  payments/
    SKILL.md                  # Required: domain knowledge
    references/               # Optional
      contract.yaml           # Machine-parseable interface
```

### SKILL.md Structure

```markdown
---
name: payments
description: Stripe payment processing and refunds
domainkit-domain: payments
domainkit-dependencies: orders
domainkit-code-paths: src/modules/payments/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Payments

[Brief overview paragraph]

## Data Models
[Entity definitions with types and constraints]

## Business Rules
[Invariants, constraints, and domain logic]

## API Surface
[Endpoints, interfaces, or service methods]

## Gotchas
[Non-obvious behaviors, edge cases, common mistakes]

## Testing Priorities
[What must always be tested when this domain changes]
```

## Frontmatter Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique skill identifier. Use lowercase with hyphens: `user-auth`, `time-tracking` |
| `description` | string | One-line summary. Should clearly convey the domain's purpose |

### Optional DomainKit Fields

| Field | Type | Description |
|-------|------|-------------|
| `domainkit-domain` | string | Domain grouping. Multiple skills can share a domain. Defaults to `name` |
| `domainkit-dependencies` | string | Comma-separated list of skill names this depends on |
| `domainkit-code-paths` | string | Comma-separated glob patterns pointing to source files for this domain |
| `domainkit-version` | string | Schema version (currently `"1"`) |
| `domainkit-last-verified` | string | ISO date (YYYY-MM-DD) when this skill was last verified against the codebase |

### Examples

**Minimal:**
```yaml
---
name: notifications
description: Email and in-app notification delivery
---
```

**Full:**
```yaml
---
name: checkout
description: Cart-to-order conversion with inventory reservation and payment processing
domainkit-domain: checkout
domainkit-dependencies: cart,catalog,payments,inventory
domainkit-code-paths: src/modules/checkout/**,src/jobs/checkout-*.ts
domainkit-version: "1"
domainkit-last-verified: 2026-03-21
---
```

## Writing Each Section

### Data Models

Define the entities this domain **owns**. Be specific about types, constraints, and relationships. Agents need this to generate correct schemas, migrations, and types.

**Good — specific and constrained:**
```markdown
## Data Models

### Payment
| Field | Type | Constraints |
|-------|------|------------|
| id | uuid | PK, auto-generated |
| orderId | uuid | FK → Order, required, unique |
| stripePaymentIntentId | string | required, unique |
| amount | integer | cents, required, > 0 |
| currency | string | ISO 4217, 3 chars, default "usd" |
| status | enum | pending, succeeded, failed, cancelled, refunded, partially_refunded |
| stripeChargeId | string | nullable, populated after capture |
| createdAt | timestamp | immutable, auto-generated |
| updatedAt | timestamp | DB trigger, never set in code |

### Refund
| Field | Type | Constraints |
|-------|------|------------|
| id | uuid | PK |
| paymentId | uuid | FK → Payment, required |
| returnId | uuid | FK → Return, nullable |
| stripeRefundId | string | required |
| amount | integer | cents, > 0, <= remaining refundable amount |
| status | enum | pending, succeeded, failed |
| reason | string | required, max 500 chars |
```

**Bad — too vague:**
```markdown
## Data Models

We have a Payment model and a Refund model. Payments are linked to orders and track Stripe data.
```

### Business Rules

Document the invariants that must hold. These are the rules that aren't obvious from reading the code. Each rule should be a clear, testable statement.

**Good — specific and actionable:**
```markdown
## Business Rules

- All monetary amounts stored as integers in smallest currency unit (cents for USD). Never use float.
- Payment flow: Checkout creates PaymentIntent → Frontend confirms → Stripe webhook fires → Payment.status = succeeded
- Webhook idempotency: deduplicate using Stripe `event.id` stored in `StripeEvent` table
- Refunds initiated by the orders domain, not directly by users
- Partial refunds supported: total refund amount must not exceed original payment amount
- `capture_method` is always `automatic` — no manual capture flow
- No raw card data stored anywhere — all PCI-sensitive data stays in Stripe
- A payment cannot be refunded if its status is `pending` or `failed`
```

**Bad — too general:**
```markdown
## Business Rules

We use Stripe for payments. Refunds work through Stripe too. Webhooks handle status updates.
```

### API Surface

List the endpoints or interfaces with their key behaviors. Focus on what's non-obvious about each endpoint.

**Good — includes behaviors, not just paths:**
```markdown
## API Surface

| Method | Path | Auth | Description |
|--------|------|------|------------|
| POST | /api/webhooks/stripe | Stripe signature | Handle webhook events. Verify using signing secret from env. No user auth. |
| GET | /api/orders/:orderId/payment | User (order owner) | Returns payment for an order. 404 if order not found or not owned by user. |
| POST | /api/payments/:paymentId/refund | Admin only | Initiate refund. Body: `{ amount, reason }`. Partial refund if amount < payment. |
| GET | /api/payments/:paymentId/refunds | Admin only | List all refunds for a payment. Ordered by createdAt desc. |

**Notes:**
- The webhook endpoint does NOT use the standard auth middleware — it uses Stripe signature verification
- Refund endpoints are admin-only because refunds are initiated through the order returns flow for regular users
```

### Gotchas

This is the **highest-value section**. Document what goes wrong when someone doesn't know the domain. Think: "What would I tell a new team member on day one?"

**Good — specific warnings with context:**
```markdown
## Gotchas

- **PaymentIntent timing**: The PaymentIntent is created during checkout initiation, NOT when the payment is recorded. The Payment record is created only after the Stripe webhook confirms success.

- **Webhook ordering**: Stripe webhook events can arrive out of order. A `payment_intent.succeeded` event might arrive before `payment_intent.created`. Always check current state before transitioning.

- **Amount is cents**: The `amount` field is stored in cents (integer). `$10.00` is stored as `1000`. Never convert to float for calculations — use integer math only.

- **Refund race condition**: Two concurrent refund requests could exceed the original payment amount. The refund endpoint uses a database-level check constraint and optimistic locking to prevent this.

- **Test mode gotcha**: Stripe test webhooks use a different signing secret than production. Both are in environment variables — don't hardcode either.

- **No payment without order**: There is no standalone payment creation endpoint. Payments are always created through the checkout flow. Direct payment creation is only possible via the Stripe dashboard.
```

**Bad — too obvious:**
```markdown
## Gotchas

- Make sure to handle errors
- Test in staging before production
- Use environment variables for secrets
```

### Testing Priorities

List what must always be tested when this domain changes. Order by importance.

**Good — specific and prioritized:**
```markdown
## Testing Priorities

1. **Webhook signature verification** — Must reject events with invalid signatures. Test with real Stripe test events.
2. **Idempotent event processing** — Replay the same webhook twice. Second call must be a no-op.
3. **Partial refund math** — Refund $5 from $10, then try to refund $6. Must reject.
4. **Refund after partial refund** — Refund $5 from $10, then refund remaining $5. Must succeed.
5. **Concurrent refund requests** — Two simultaneous refunds totaling more than the payment. One must fail.
6. **Failed payment cleanup** — When Stripe reports failure, ensure no order is created and any inventory reservation is released.
```

## Writing Contracts

Contracts (`references/contract.yaml`) provide machine-parseable interfaces that enable:

- **Drift detection** — DomainKit compares contracts against actual TypeScript types
- **Multi-agent coordination** — Parallel agent sessions reference the same structured definitions
- **Validation** — `dk validate` checks contract schema correctness

### Contract Structure

```yaml
# Models define the data entities
models:
  - name: Payment
    fields:
      - name: id
        type: uuid
        required: true
      - name: orderId
        type: uuid
        required: true
      - name: amount
        type: integer
        required: true
      - name: status
        type: string
        enum: [pending, succeeded, failed, cancelled, refunded, partially_refunded]
        required: true
      - name: stripePaymentIntentId
        type: string
        required: true

# API routes define the HTTP interface
api:
  routes:
    - method: POST
      path: /api/webhooks/stripe
      description: Handle Stripe webhook events
    - method: GET
      path: /api/orders/:orderId/payment
      description: Get payment for an order
    - method: POST
      path: /api/payments/:paymentId/refund
      description: Initiate a refund

# Events define the domain events emitted
events:
  - name: payment.succeeded
    description: Fired when Stripe confirms payment
  - name: payment.refunded
    description: Fired when a refund is processed
  - name: payment.failed
    description: Fired when a payment attempt fails

# Dependencies on other domains
dependencies:
  - orders
```

### Field Types

Use these standard types in contract model fields:

| Type | Maps To | Notes |
|------|---------|-------|
| `string` | `string` | General text |
| `integer` | `number` | Whole numbers (use for monetary amounts in cents) |
| `float` | `number` | Decimal numbers |
| `boolean` | `boolean` | True/false |
| `uuid` | `string` | UUID format |
| `timestamp` | `string` or `Date` | ISO 8601 datetime |
| `json` | `object` | Arbitrary JSON |
| `array` | `any[]` | Specify element type in description |

## Skill Quality Checklist

Use this checklist when reviewing skills:

### Completeness
- [ ] All key entities documented with field types and constraints
- [ ] All business rules are specific and testable
- [ ] All public API endpoints listed with auth requirements
- [ ] Gotchas section has at least 3 non-obvious items
- [ ] Testing priorities ordered by importance

### Accuracy
- [ ] `domainkit-last-verified` is within 30 days
- [ ] `domainkit-code-paths` match existing files
- [ ] Dependencies list is complete and correct
- [ ] Contract models match actual TypeScript types
- [ ] Contract routes match actual API endpoints

### Usefulness
- [ ] An agent reading only this skill could implement a feature correctly
- [ ] Business rules explain the "why", not just the "what"
- [ ] Gotchas describe real failure modes, not generic advice
- [ ] Data model constraints are specific (max lengths, valid ranges, enums)

## Anti-Patterns to Avoid

### 1. Replicating the Code

**Don't** paste your entire source file into the skill. The agent can read the code — it needs the reasoning behind it.

```markdown
<!-- BAD: just pasting code -->
## Implementation
```typescript
export async function createPayment(orderId: string, amount: number) {
  const paymentIntent = await stripe.paymentIntents.create({...})
  ...
}
```

```markdown
<!-- GOOD: explaining what matters -->
## Business Rules
- PaymentIntent created during checkout, not at payment record creation
- Amount must be in cents (integer) — the Stripe SDK requires this
```

### 2. Being Too Vague

```markdown
<!-- BAD -->
## Business Rules
- Payments are handled by Stripe
- We support refunds

<!-- GOOD -->
## Business Rules
- capture_method is always automatic — no manual capture
- Partial refunds supported: sum of all refunds must not exceed original amount
- Refund to original payment method only — no store credit
```

### 3. Skipping Gotchas

The Gotchas section prevents the most bugs. If your skill has no gotchas, you haven't thought hard enough about what confuses newcomers.

### 4. Stale Dependencies

If your checkout skill says `domainkit-dependencies: cart,payments` but it also imports from the inventory module, the dependency is incomplete. Agents won't get inventory context when working on checkout.

### 5. Missing Code Paths

Without `domainkit-code-paths`, drift detection can't check file coverage. Always include glob patterns:

```yaml
domainkit-code-paths: src/modules/payments/**,src/jobs/payment-*.ts,src/webhooks/stripe.ts
```

## Real-World Examples

See the `examples/` directory for complete reference implementations:

- **[E-Commerce](../examples/ecommerce/)** — 6 domains covering a full online store
- **[Project Management](../examples/project-management/)** — 8 domains covering a PM tool

These examples demonstrate proper skill structure, business rule documentation, contract definitions, and inter-domain dependencies.
