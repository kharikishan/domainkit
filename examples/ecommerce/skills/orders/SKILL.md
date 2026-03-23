---
name: orders
description: Order lifecycle management, fulfillment tracking, and returns
domainkit-domain: orders
domainkit-dependencies: checkout
domainkit-code-paths: src/modules/orders/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Orders

## Data Models

`Order`: `id`, `userId`, `checkoutSessionId`, `status` (pending/confirmed/processing/shipped/delivered/cancelled/refunded/partially_refunded), `shippingAddress` (JSON snapshot), `billingAddress` (JSON snapshot), `subtotal`, `discountAmount`, `tax`, `shippingCost`, `total` (all in cents), `currency`, `trackingNumber` (nullable), `trackingCarrier` (nullable), `createdAt`, `updatedAt`.

`OrderItem`: `orderId`, `productId`, `productSnapshot` (JSON — name, sku, price at order time), `quantity`, `unitPrice`.

`productSnapshot` is critical: it preserves what the customer actually purchased, regardless of future product edits.

`Return`: `id`, `orderId`, `status` (requested/approved/received/refunded/rejected), `items` (JSON — which items and quantities), `reason`, `refundAmount` (cents), `createdAt`, `resolvedAt`.

## Business Rules

**Order creation:** Orders are created by the checkout domain during the confirm step. The order module provides `createFromCheckoutSession(sessionId)` — do not create orders from any other code path.

**Status transitions:**
- `pending` → `confirmed` (payment webhook received)
- `confirmed` → `processing` (warehouse picks up the order)
- `processing` → `shipped` (tracking number added)
- `shipped` → `delivered` (carrier webhook or manual update)
- `confirmed`/`processing` → `cancelled` (customer request or out-of-stock discovered post-confirmation)
- `delivered` → `refunded` or `partially_refunded` (after return approved)

**Cancellation:** Cancelling an order triggers a full refund via the payments domain. Inventory for cancelled items is restored (incremented back).

**Returns:** Customers can request a return within 30 days of delivery. Approved returns trigger a refund for the returned items only (`partially_refunded` if not all items returned, `refunded` if all). Restocking returned inventory is a manual warehouse step — the system records the return but does not auto-increment `Product.inventory`.

**Immutability:** Once an order is `shipped`, the order record is immutable except for `trackingNumber`, `trackingCarrier`, `status`, and `updatedAt`. Never modify prices or items after creation.

## API Surface

`GET /api/orders` — list orders for authenticated user; admin can list all with `?userId=`.
`GET /api/orders/:id` — order detail with items.
`POST /api/orders/:id/cancel` — cancel order (allowed in `confirmed` or `processing` status only).
`POST /api/orders/:id/returns` — create a return request.
`GET /api/orders/:id/returns` — list returns for an order.
`PUT /api/orders/:id/returns/:returnId` — update return status (admin only).
`PUT /api/orders/:id/tracking` — add or update tracking info (admin/warehouse role only).

## Gotchas

- `productSnapshot` is a JSON copy, not a FK join. When displaying order history, always use `productSnapshot.name` and `productSnapshot.sku`, not a live join to `Product`. Products may have been renamed or archived.
- The 30-day return window is calculated from `deliveredAt` (set when status transitions to `delivered`), not from order creation. If `deliveredAt` is null (status never reached `delivered`), returns are not allowed.
- Refund amounts for partial returns are computed as `SUM(returnedItem.quantity * OrderItem.unitPrice)`. Do not re-fetch current product price.
- Cancellation after `shipped` is not supported through the system — it requires manual intervention (customer service). The status machine enforces this.
- Inventory restoration on cancellation must be in the same transaction as the status update. A crash between the two leaves inventory under-counted.

## Testing Priorities

1. Full status machine coverage — valid and invalid transitions.
2. `productSnapshot` integrity: order display uses snapshot even when product is edited post-order.
3. Return window enforcement: return attempted 31 days after delivery is rejected.
4. Partial return refund calculation accuracy.
5. Cancellation transaction: order status update and inventory restoration atomicity.
