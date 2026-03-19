---
name: cart
description: Shopping cart management, line item operations, and price calculation
domainkit-domain: shopping
domainkit-dependencies: catalog
domainkit-code-paths: src/modules/cart/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Shopping Cart

## Data Models

`Cart`: `id`, `sessionId` (for guest carts), `userId` (nullable — null for guest), `status` (active/merged/converted/abandoned), `currency`, `couponCode` (nullable), `createdAt`, `updatedAt`, `expiresAt`.

`CartItem`: `cartId`, `productId`, `quantity`, `unitPrice` (snapshot at add time, in cents), `addedAt`.

`unitPrice` in `CartItem` is a snapshot of `Product.price` at the time the item was added. It does not update automatically when product prices change. The cart total is always computed from `CartItem.unitPrice`, not live `Product.price`.

## Business Rules

**Guest to authenticated merge:** When a guest (session-based) cart user logs in, their guest cart is merged into their user cart. If both carts have the same product, quantities are summed up to the inventory cap. The guest cart is set to `merged` status.

**Price lock:** `unitPrice` is locked at add time. If the product's price changes after an item is in the cart, the cart total does not change. The checkout step re-validates prices and presents a price-change warning if `unitPrice` diverges from current `Product.price` by more than 5%.

**Inventory reservation:** Adding to cart does NOT reserve inventory. Inventory is reserved at checkout initiation. As a result, items can be in a cart with zero inventory — show "low stock" or "out of stock" warnings but do not block add-to-cart.

**Coupon codes:** A cart can hold one coupon code at a time. Coupon validation (discount amount, expiry, usage limits) is the responsibility of the checkout domain. This domain stores and retrieves the code only.

**Cart expiry:** Guest carts expire after 30 days of inactivity. Authenticated user carts expire after 90 days. Expired carts are set to `abandoned` status by a nightly job. Items in abandoned carts are not deleted — they remain for analytics.

**Quantity limits:** Maximum quantity per line item is 99. Maximum distinct line items per cart is 100.

## API Surface

`GET /api/cart` — get the authenticated user's active cart (or session cart for guests).
`POST /api/cart/items` — add item; body: `{ productId, quantity }`. Creates cart if none exists.
`PUT /api/cart/items/:productId` — update quantity; set to 0 to remove.
`DELETE /api/cart/items/:productId` — remove item.
`POST /api/cart/coupon` — apply coupon code; body: `{ code }`. Stores code; does not validate discount yet.
`DELETE /api/cart/coupon` — remove applied coupon.
`POST /api/cart/merge` — merge guest cart into authenticated cart (called after login).

## Gotchas

- The cart total is computed at read time as `SUM(quantity * unitPrice)` over `CartItem` rows. Do not store a pre-computed total in the `Cart` record — it will become stale.
- Price divergence check at checkout uses a 5% threshold to avoid annoying users over minor price movements (e.g., rounding). Do not tighten this without front-end UX changes.
- `sessionId` for guest carts comes from an HttpOnly cookie set server-side. Do not accept a client-supplied cart ID — always resolve the cart from the session or auth token.
- Merging must be idempotent: calling merge twice should not double quantities. Use the `merged` status check to short-circuit.
- Deleting a product from the catalog (archiving) does not remove it from active carts. Checkout must handle the case where a cart item's product is now `archived`.

## Testing Priorities

1. Guest-to-auth merge: same product in both carts, quantities summed, capped at inventory.
2. Price lock: product price changes after add; cart total reflects locked price.
3. Quantity limits: 100th item addition and quantity > 99 both rejected.
4. Idempotent merge: merging twice does not corrupt quantities.
5. Cart total calculation with coupon code stored but discount not yet applied.
