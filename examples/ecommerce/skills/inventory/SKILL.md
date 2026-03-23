---
name: inventory
description: Stock level management, inventory events, and low-stock alerting
domainkit-domain: inventory
domainkit-dependencies: catalog orders
domainkit-code-paths: src/modules/inventory/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Inventory

## Data Models

`InventoryEvent`: `id`, `productId`, `type` (purchase/sale/return/adjustment/reservation/release), `delta` (positive or negative integer), `referenceType` (order/return/checkout_session/manual), `referenceId`, `note` (nullable), `createdBy`, `createdAt`.

`LowStockThreshold`: `productId`, `threshold` (units), `alertEnabled`, `lastAlertedAt`.

`Product.inventory` is the authoritative stock level. `InventoryEvent` is the audit log. Do not recompute `Product.inventory` from events — the two are kept in sync transactionally.

## Business Rules

**Inventory movements:**
- `sale`: created when a `CheckoutSession` is confirmed (delta = -quantity per item). Created by the checkout domain calling this module's service interface.
- `release`: created when a `CheckoutSession` expires or is cancelled (delta = +quantity). Restores reserved stock.
- `return`: created when an approved return is marked `received` (delta = +quantity per returned item). Only the inventory module increments stock on return.
- `purchase`: created when a purchase order is received (stock replenishment). Admin-only.
- `adjustment`: manual correction by admin; requires a `note` explaining the reason.

**Atomic updates:** Every inventory change must update `Product.inventory` and insert an `InventoryEvent` in a single database transaction. If either fails, both roll back.

**Low-stock alerts:** After each negative delta (sale, adjustment, reservation), if `Product.inventory <= LowStockThreshold.threshold` and `alertEnabled = true`, enqueue a low-stock alert notification. Rate-limit alerts per product to one per 4 hours using `lastAlertedAt`.

**Negative inventory:** `Product.inventory` must never go below zero. Any change that would result in negative inventory is rejected with a `409 Conflict`. This is enforced at the database level with a `CHECK (inventory >= 0)` constraint — application-level checks are secondary.

## API Surface

`GET /api/products/:productId/inventory` — current stock level and low-stock threshold.
`GET /api/products/:productId/inventory/events` — paginated event log for a product.
`POST /api/products/:productId/inventory/adjust` — manual adjustment; admin only; body: `{ delta, note }`.
`PUT /api/products/:productId/inventory/threshold` — set low-stock threshold and alert flag.
`GET /api/inventory/low-stock` — list products at or below their threshold; admin only.

## Gotchas

- The `sale` and `release` event types are created by the checkout module, not via the HTTP API. The inventory module exposes a service function `recordMovement(productId, type, delta, reference)` for internal use. Do not expose a generic movement endpoint on the public API.
- Low-stock checks after every write can become a hot path under load. The `lastAlertedAt` rate limit is essential — without it a flash sale could generate thousands of alert events per minute.
- The database `CHECK` constraint is the safety net; the application check should run first and return a clean `409` with a human-readable message, not let the DB constraint bubble up a raw error.
- Manual adjustments with a large negative delta are a common source of bugs. Always validate that `currentInventory + delta >= 0` before writing, even though the DB constraint would catch it.
- Stock replenishment (`purchase` events) must be ordered by warehouse staff, not generated automatically. The system records replenishment but does not predict or automate purchasing.

## Testing Priorities

1. Atomicity: force an insert failure on `InventoryEvent` and verify `Product.inventory` is unchanged.
2. Negative inventory guard: adjustment that would go below zero returns `409`.
3. Low-stock alert rate limiting: two events within 4 hours should produce only one alert.
4. Release event on checkout expiry: inventory is correctly restored.
5. Return event: approved return increments inventory; `InventoryEvent` has correct `referenceType` and `referenceId`.
