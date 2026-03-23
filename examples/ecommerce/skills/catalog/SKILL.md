---
name: catalog
description: Product catalog management, categories, and search
domainkit-domain: catalog
domainkit-dependencies:
domainkit-code-paths: src/modules/catalog/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Product Catalog

## Data Models

`Product`: `id`, `name`, `sku`, `slug`, `description`, `price` (integer, cents), `compareAtPrice` (nullable, cents), `categoryId`, `inventory` (integer units), `status` (draft/active/archived), `images` (JSON array of URLs), `attributes` (JSON — size, color, etc.), `createdAt`, `updatedAt`. See `references/contract.yaml` for full schema.

`Category`: `id`, `name`, `slug`, `parentCategoryId` (nullable — supports one level of nesting), `displayOrder`, `active`.

Prices are always stored and transmitted as integers in the smallest currency unit (cents for USD). Never use floating point for money.

## Business Rules

**Product status:**
- `draft`: not visible to shoppers; editable.
- `active`: visible in catalog and searchable; can be added to cart.
- `archived`: hidden from catalog; orders containing this product still reference it by ID (referential integrity required).

**SKU uniqueness:** SKU must be unique across the entire catalog, including archived products. Re-using an archived product's SKU requires explicit admin override.

**Inventory:** `inventory` represents available stock. Zero inventory does not automatically change `status` — out-of-stock active products remain visible (front-end shows "out of stock"). Use inventory events to track stock movements rather than direct `inventory` updates.

**Slug generation:** Slugs are auto-generated from `name` on create (`"Blue Widget" → "blue-widget"`). If a slug collision occurs, append `-2`, `-3`, etc. Slug changes after publish are discouraged — redirect logic is outside this domain.

**Search:** Full-text search is backed by a Postgres `tsvector` index on `name || ' ' || description`. Queries use `plainto_tsquery`. Filtering supports category, price range (`?minPrice=`, `?maxPrice=`), and `?inStockOnly=true`.

## API Surface

`GET /api/products` — list/search products; filter by `?categoryId=`, `?status=`, `?q=` (search), `?minPrice=`, `?maxPrice=`, `?inStockOnly=`.
`POST /api/products` — create product; status defaults to `draft`.
`GET /api/products/:idOrSlug` — fetch by ID or slug.
`PUT /api/products/:id` — update product; status transitions enforced.
`DELETE /api/products/:id` — sets status to `archived`; never hard-deletes.
`GET /api/categories` — list all active categories.
`POST /api/categories` — create category.
`PUT /api/categories/:id` — update category.

## Gotchas

- `compareAtPrice` must be greater than `price` if set. If `compareAtPrice <= price`, the sale badge logic breaks silently on the front-end. Validate this server-side.
- The `attributes` JSON field is intentionally schema-free for flexibility. Do not add typed columns for every attribute (size, color, material) — the JSON approach handles the variety of product types.
- Search relevance uses default Postgres `ts_rank`. For more than ~50k products, add a rank tuning pass or move to a dedicated search service. Do not switch search implementations without testing existing queries.
- Category slugs are used in storefront URLs. Changing a category slug breaks URLs — add a redirect mapping before renaming.

## Testing Priorities

1. Price validation: `compareAtPrice <= price` must be rejected.
2. SKU uniqueness including archived products.
3. Slug collision resolution: two products with the same name get distinct slugs.
4. Search query: verify full-text search returns ranked results; verify `inStockOnly` filter.
5. Archival: archived product does not appear in default list but its ID remains valid for order references.
