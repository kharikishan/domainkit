# Greenfield Guide: Using DomainKit for New Projects

This guide covers how to use DomainKit when starting a project from scratch. The key insight: **define your domain boundaries before writing code**, so AI agents build focused, bounded implementations from day one.

## Why DomainKit for Greenfield?

When teams start a project with a coding agent, they typically dump an entire PRD into the context and say "build this." The agent tries to build everything at once — data models, API routes, business logic, UI — because it has no structured way to decompose the work.

The result: monolithic code that tangles concerns, inconsistent patterns across modules, and a codebase that's immediately hard to extend.

DomainKit solves this by letting you define domain boundaries upfront, then feed the agent one domain at a time with the right dependency context.

## Phase 1: Project Setup

### Initialize DomainKit

```bash
mkdir my-project && cd my-project
git init
pnpm init

# Initialize DomainKit
dk init --platform claude --source-root src
```

### Plan Your Domains

Before creating skills, identify your bounded contexts. Ask:

- What are the distinct business areas? (e.g., auth, billing, notifications)
- Which areas need to know about each other?
- What data does each area own?

**Example: E-Commerce Platform**

```
catalog     — Products and categories
cart        — Shopping cart management
checkout    — Cart-to-order conversion
orders      — Order lifecycle
payments    — Stripe payment processing
inventory   — Stock tracking
```

**Dependencies:**
```
checkout → cart, catalog, payments, inventory
orders → payments
payments → orders
inventory → catalog
```

## Phase 2: Define Domain Skills

### Create Skills for Each Domain

```bash
dk add catalog --domain catalog \
  --description "Product and category management with full-text search" \
  --code-paths "src/modules/catalog/**" \
  --contract

dk add cart --domain cart \
  --description "Shopping cart with guest-to-auth merge and price locking" \
  --code-paths "src/modules/cart/**" \
  --deps catalog \
  --contract

dk add checkout --domain checkout \
  --description "Cart-to-order conversion with inventory reservation" \
  --code-paths "src/modules/checkout/**" \
  --deps "cart,catalog,payments,inventory" \
  --contract

dk add orders --domain orders \
  --description "Order lifecycle, fulfillment, and returns" \
  --code-paths "src/modules/orders/**" \
  --deps payments \
  --persona domain-expert \
  --contract

dk add payments --domain payments \
  --description "Stripe payment processing and refunds" \
  --code-paths "src/modules/payments/**" \
  --deps orders \
  --persona developer \
  --contract

dk add inventory --domain inventory \
  --description "Stock tracking, reservations, and low-stock alerts" \
  --code-paths "src/modules/inventory/**" \
  --deps catalog \
  --contract
```

### Choose a Persona

DomainKit includes built-in personas that generate different SKILL.md sections based on perspective:

- **developer** — Architecture, code patterns, dependencies, API usage, setup
- **domain-expert** — Business rules, invariants, domain events, edge cases

```bash
# See available personas
dk persona list
```

### Fill In Each Skill

For each generated `SKILL.md`, replace placeholders with your domain design. Focus on these sections:

#### Data Models

Define the entities this domain owns. Be specific about types, constraints, and relationships:

```markdown
## Data Models

### Product
| Field | Type | Constraints |
|-------|------|------------|
| id | uuid | PK |
| name | string | max 255, required |
| sku | string | unique (including archived) |
| price | integer | cents, required |
| status | enum | draft, active, archived |
| categoryId | uuid | FK → Category |
```

#### Business Rules

Document the invariants that must hold. These are the rules agents get wrong without explicit guidance:

```markdown
## Business Rules

- Prices stored as integers in smallest currency unit (cents for USD)
- SKU uniqueness includes archived products — prevents recycling
- Product status controls visibility: draft=hidden, active=visible, archived=soft-deleted
- Slugs auto-generated from name with collision handling (-2, -3, etc.)
- compareAtPrice must be strictly greater than price when set
```

#### API Surface

List endpoints with their key behaviors:

```markdown
## API Surface

| Method | Path | Description |
|--------|------|------------|
| GET | /api/products | List with filters: categoryId, status, q, minPrice, maxPrice |
| POST | /api/products | Create product (defaults to draft status) |
| GET | /api/products/:idOrSlug | Lookup by ID or slug |
| DELETE | /api/products/:id | Archives, does not hard-delete |
```

#### Gotchas

This is the most valuable section for agents. Document what goes wrong when someone doesn't know the domain:

```markdown
## Gotchas

- DELETE doesn't delete — it sets status to archived
- Full-text search uses Postgres tsvector, not LIKE queries
- Price comparisons must use integer math — never convert to float
- Archived products remain visible in existing orders and carts
```

### Define Contracts

For each domain with a `references/contract.yaml`, define the formal interface:

```yaml
# skills/catalog/references/contract.yaml
models:
  - name: Product
    fields:
      - name: id
        type: uuid
        required: true
      - name: name
        type: string
        required: true
      - name: sku
        type: string
        required: true
      - name: price
        type: integer
        required: true
      - name: status
        type: string
        enum: [draft, active, archived]

api:
  routes:
    - method: GET
      path: /api/products
      description: List products with filtering
    - method: POST
      path: /api/products
      description: Create a new product

events:
  - name: product.created
    description: Fired when a new product is created
  - name: product.archived
    description: Fired when a product is archived

dependencies:
  - inventory
```

## Phase 3: Validate and Test Context Assembly

### Validate All Skills

```bash
dk validate --strict
```

Fix any errors or warnings before proceeding.

### Test Context Assembly

Verify that the right domains get assembled for typical tasks:

```bash
# Should select: catalog
dk context "add product search filters" --format claude

# Should select: checkout, cart, payments, inventory
dk context "fix checkout total calculation" --format claude

# Should select: payments, orders
dk context "handle failed Stripe webhooks" --format system-prompt

# Check with explicit budget
dk context --domains checkout --budget 2000 --depth full
```

### View the Domain Manifest

```bash
dk list
```

This shows all skills organized by domain, with dependency counts and last-verified dates.

## Phase 4: Build with Agents

### Approach: One Domain at a Time

Instead of giving the agent your entire spec, build domain by domain:

**Step 1: Start with leaf domains (no dependencies)**

```bash
# Give the agent the catalog context
dk context --domains catalog --depth full --format claude > .claude/context.md

# Agent builds: Product model, Category model, API routes, search
```

**Step 2: Build domains that depend on completed ones**

```bash
# Give the agent cart context (depends on catalog)
dk context --domains cart --depth full --format claude > .claude/context.md

# Agent builds: Cart model, CartItem model, merge logic, price locking
```

**Step 3: Build integration domains last**

```bash
# Checkout depends on cart, catalog, payments, inventory
dk context --domains checkout --depth full --format claude > .claude/context.md
```

### Using the MCP Server

For agents that support MCP (like Claude Desktop), start the server:

```bash
dk serve --transport stdio
```

The agent can then request context on-demand using these tools:

| MCP Tool | Purpose |
|----------|---------|
| `list_domains` | See all available domains |
| `get_context` | Assemble context for a task or domains |
| `get_skill` | Fetch a single skill at any depth |
| `get_dependencies` | See a skill's dependency graph |

### Sync to Agent Platforms

To make skills available without MCP:

```bash
# Sync to all configured platforms
dk sync --all

# Or target specific platforms
dk sync --target claude
dk sync --target cursor
```

This copies skills to platform-specific directories:
- `.claude/skills/` for Claude Code/Desktop
- `.cursor/skills/` for Cursor
- `.agents/skills/` for Codex
- `.github/skills/` for GitHub

## Phase 5: Maintain as You Build

### Update Skills After Implementation

Once code is written, update the `domainkit-last-verified` date:

```yaml
---
name: catalog
domainkit-last-verified: 2026-03-21
---
```

### Run Drift Checks

```bash
# Check all skills
dk drift

# Check a specific skill
dk drift --skill catalog

# Output as JSON for CI
dk drift --report json
```

### Add Drift Checks to CI

```yaml
# .github/workflows/drift.yml
name: Domain Drift Check
on: [pull_request]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: npx dk drift --report json --threshold 50
```

## Greenfield Checklist

- [ ] Identify bounded contexts / domains
- [ ] `dk init` with your target platform
- [ ] `dk add` for each domain with dependencies and code paths
- [ ] Write `SKILL.md` content: data models, business rules, API surface, gotchas
- [ ] Define `contract.yaml` for domains that need machine-parseable interfaces
- [ ] `dk validate --strict` — all clean
- [ ] `dk context` — test that task-to-domain matching works
- [ ] Build leaf domains first, then integration domains
- [ ] `dk drift` — establish baseline
- [ ] Add drift checks to CI

## Tips for Greenfield Success

1. **Write skills before code.** This forces you to think through domain boundaries, data ownership, and interface contracts before implementation.

2. **Keep skills focused.** One skill per bounded context. If a skill covers too many concerns, split it.

3. **Dependencies should form a DAG.** Circular dependencies indicate domain boundaries need rethinking.

4. **Contracts are for agents, not humans.** The `contract.yaml` is what enables multi-agent coordination. Keep it precise and up to date.

5. **Gotchas prevent bugs.** The "Gotchas" section is the highest-ROI content. Write what you'd tell a new team member on their first day in this domain.

6. **Verify early, verify often.** Run `dk drift` after each sprint to catch divergence while it's cheap to fix.
