---
name: checkout
description: Order placement flow, inventory reservation, and payment initiation
domainkit-domain: checkout
domainkit-dependencies: cart catalog
domainkit-code-paths: src/modules/checkout/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Checkout

## Data Models

`CheckoutSession`: `id`, `cartId`, `userId`, `status` (initiated/payment_pending/completed/expired/failed), `shippingAddress` (JSON), `billingAddress` (JSON), `shippingMethod`, `shippingCost` (cents), `subtotal` (cents), `discountAmount` (cents), `tax` (cents), `total` (cents), `couponCode`, `paymentIntentId`, `createdAt`, `expiresAt`.

All monetary fields in `CheckoutSession` are computed and locked at session initiation. They do not change after initiation.

## Business Rules

**Session initiation (`POST /api/checkout/initiate`):**
1. Validate all cart items: product must be `active`, inventory must be >= requested quantity.
2. Reserve inventory: decrement `Product.inventory` atomically for each item. If any item fails, release all reservations and return a descriptive error.
3. Validate coupon code if present: check expiry, usage limits, minimum order value.
4. Compute totals: subtotal (sum of `unitPrice * quantity`), discount, tax (flat rate per shipping region), shipping cost.
5. Lock all totals into `CheckoutSession`. Create a Stripe PaymentIntent for `total`.
6. Return `CheckoutSession` with `paymentIntentId` for the front-end to confirm.

**Session expiry:** A `CheckoutSession` expires 30 minutes after creation if payment is not completed. On expiry, a job releases all reserved inventory (increments back).

**Price re-validation:** If `CartItem.unitPrice` diverges from current `Product.price` by more than 5%, return an error requiring the user to re-initiate checkout. This re-locks the price.

**Idempotency:** `POST /api/checkout/initiate` is idempotent per `cartId` — if an active session exists for the cart, return it rather than creating a second one. Creating two concurrent sessions for the same cart would double-decrement inventory.

## API Surface

`POST /api/checkout/initiate` — start checkout; validates cart and reserves inventory; returns `CheckoutSession`.
`GET /api/checkout/:sessionId` — retrieve session (for polling status).
`POST /api/checkout/:sessionId/confirm` — called after client-side Stripe confirmation; transitions session to `completed`, creates the order, marks cart as `converted`.
`POST /api/checkout/:sessionId/cancel` — cancel session; releases inventory.

## Gotchas

- Inventory reservation must be wrapped in a database transaction. If the transaction rolls back for any reason, inventory is not decremented. Do not reserve inventory outside a transaction.
- `paymentIntentId` is stored before payment is confirmed — this is intentional. The Stripe webhook (in the payments domain) uses it to link the payment event back to the session.
- Tax computation is region-based. The tax rate table lives in a config file (`src/config/tax-rates.yaml`), not the database. Reloading the config requires a restart; it is not hot-reloaded.
- Do not create the `Order` record during session initiation. Create it only in the `confirm` step, after payment intent is confirmed. This prevents ghost orders.
- Expired sessions must release inventory in a background job, not lazily on next request. Late release causes real stock discrepancies.

## Testing Priorities

1. Inventory reservation atomicity: one item fails stock check → all reservations rolled back.
2. Session idempotency: initiating checkout twice for the same cart returns the same session.
3. Session expiry + inventory release: mock clock to trigger expiry job.
4. Price divergence: initiating with a stale unit price > 5% off current price is rejected.
5. Confirm step: order created, cart marked converted, inventory remains decremented.
