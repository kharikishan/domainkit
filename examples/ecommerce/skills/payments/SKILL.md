---
name: payments
description: Payment processing via Stripe, refund handling, and webhook reconciliation
domainkit-domain: payments
domainkit-dependencies: orders
domainkit-code-paths: src/modules/payments/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Payments

## Data Models

`Payment`: `id`, `orderId`, `stripePaymentIntentId`, `amount` (cents), `currency`, `status` (pending/succeeded/failed/cancelled/refunded/partially_refunded), `stripeChargeId` (nullable), `createdAt`, `updatedAt`.

`Refund`: `id`, `paymentId`, `returnId` (nullable — null for full order cancellation refunds), `stripeRefundId`, `amount` (cents), `status` (pending/succeeded/failed), `reason`, `createdAt`.

Do not store raw card data. All sensitive payment data lives in Stripe. This domain stores only IDs and statuses.

## Business Rules

**Payment flow:**
1. Checkout domain creates a Stripe PaymentIntent and stores `paymentIntentId` on `CheckoutSession`.
2. Frontend confirms the PaymentIntent using Stripe.js.
3. Stripe sends a `payment_intent.succeeded` webhook to `POST /api/webhooks/stripe`.
4. Webhook handler transitions `Payment.status` to `succeeded`, transitions `Order.status` to `confirmed`, and fires a `payment.succeeded` event.

**Webhook idempotency:** Stripe may deliver the same webhook event multiple times. Use Stripe's `event.id` to deduplicate — store processed event IDs in a `StripeEvent` table with `(stripeEventId, processedAt)`. Skip processing if the event ID already exists.

**Refunds:** Refunds are initiated by the orders domain (cancellation or approved return). The payment domain calls `stripe.refunds.create({ charge: chargeId, amount })`. Partial refunds are supported. On Stripe webhook `charge.refund.updated` with status `succeeded`, update `Refund.status` and trigger `Payment.status` update (`partially_refunded` or `refunded`).

**Currency:** All amounts are stored in the base currency unit for the currency (cents for USD, pence for GBP). The `currency` field is ISO 4217 (e.g., "USD"). Multi-currency is supported; do not assume USD.

**Capture delay:** PaymentIntents use `capture_method: automatic`. If this ever changes to `manual` for any reason, the capture must be executed within 7 days or the authorization expires.

## API Surface

`POST /api/webhooks/stripe` — Stripe webhook endpoint; verified with `stripe.webhooks.constructEvent` using the webhook signing secret.
`GET /api/orders/:orderId/payment` — get payment status for an order.
`POST /api/payments/:paymentId/refund` — initiate a refund; body: `{ amount, reason, returnId? }` (called by orders domain, not directly by users).
`GET /api/payments/:paymentId/refunds` — list refunds for a payment.

## Gotchas

- Always verify Stripe webhook signatures with the signing secret, not just the API key. An unverified webhook endpoint is a security vulnerability.
- The `stripeChargeId` is not available on `payment_intent.succeeded` — it arrives on `charge.succeeded`. The webhook handler must handle both events and join on `paymentIntentId` to link them.
- Never initiate a refund if `Payment.stripeChargeId` is null. The charge has not been captured yet; cancel the PaymentIntent instead.
- Stripe test mode and live mode use different API keys and different webhook signing secrets. The application must use the correct set based on environment. A misconfiguration sends real webhooks to a test handler silently.
- Refund failures from Stripe (e.g., funds already refunded, charge disputed) must transition `Refund.status` to `failed` and alert the operations team — do not silently swallow them.

## Testing Priorities

1. Webhook signature verification: unsigned request → 400; tampered payload → 400.
2. Idempotency: replaying the same Stripe event ID is a no-op (no duplicate order confirmations).
3. Partial refund: amount reduces payment balance correctly; status becomes `partially_refunded` not `refunded`.
4. Refund failure from Stripe: `Refund.status` set to `failed`, alert triggered.
5. Full refund after partial refund: cumulative refund amount = original charge; status becomes `refunded`.
