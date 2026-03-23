# DomainKit v0.2 — Live Demo Script

> **Audience:** Engineering leads, AI platform teams, developer experience teams
> **Duration:** ~20 minutes
> **What you'll see:** Setup to production-ready domain skills in under 20 minutes — covering both greenfield and brownfield paths, persona-based generation, cross-platform sync, drift detection, and smart recommendations.

---

## Act 1: The Problem (2 min)

### What happens without DomainKit

```
You: "Hey Claude, add a refund endpoint to our payments module"

Claude: *Creates a refund endpoint that:*
  - Stores amounts as floats (your system uses integer cents)
  - Skips Stripe webhook verification
  - Allows refunds after 90 days (your policy is 30)
  - Doesn't check if total refunds exceed original amount
  - Creates a new payments table (one already exists)
```

**Why?** The agent has no domain context. It doesn't know your business rules, your data model conventions, or the gotchas your team learned the hard way.

**DomainKit fixes this.** It packages domain knowledge into structured skills that agents consume — the right context, at the right depth, for the right task.

---

## Act 2: Installation & Setup (2 min)

### Install DomainKit

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
./setup.sh        # macOS/Linux
# or: powershell -ExecutionPolicy Bypass -File setup.ps1  (Windows)
```

### Verify

```bash
dk --version
# 0.2.0

dk --help
# Commands:
#   init          Initialise a DomainKit project
#   add           Add a new skill to the project
#   list          List all skills in the project
#   validate      Validate skill files
#   context       Assemble domain context for a task
#   sync          Sync skills to agent platforms
#   drift         Check skills for drift
#   serve         Start the DomainKit MCP server
#   generate      Generate skill drafts from codebase analysis
#   persona       Manage persona definitions
#   recommend     Recommend relevant skills based on git changes
#   watch         Watch source files and detect drift in real-time
#   import        Import skills from API specifications
```

> **14 commands.** Everything from skill creation to drift detection to MCP serving.

---

## Act 3: Greenfield — Build It Right from Day One (5 min)

### Scenario: Starting an e-commerce platform

```bash
mkdir ecommerce && cd ecommerce
git init && pnpm init
```

### Step 1: Initialize DomainKit

```bash
dk init --platform claude --source-root src
```

```
Created .domainkit/config.yaml
Created .skills/ directory
```

### Step 2: See what personas are available

```bash
dk persona list
```

```
Available personas (2):

  developer            Developer (built-in)
                       Focuses on architecture, code patterns, dependencies, API usage, and development setup

  domain-expert        Domain Expert (built-in)
                       Focuses on business rules, invariants, domain events, edge cases, and bounded context boundaries
```

> **Key insight:** Different team members care about different things. A new developer needs architecture and setup. A product owner needs business rules and invariants. Personas generate the right sections for the right audience.

### Step 3: Create domain skills with personas

```bash
# Developer perspective — architecture, patterns, setup
dk add catalog --domain catalog \
  --description "Product catalog with full-text search and category management" \
  --code-paths "src/modules/catalog/**" \
  --contract --persona developer

# Domain expert perspective — business rules, invariants, events
dk add payments --domain payments \
  --description "Stripe payment processing, refunds, and webhook handling" \
  --code-paths "src/modules/payments/**" \
  --deps orders \
  --contract --persona domain-expert

# You can merge personas too
dk add checkout --domain checkout \
  --description "Cart-to-order conversion with inventory reservation" \
  --code-paths "src/modules/checkout/**" \
  --deps "cart,catalog,payments,inventory" \
  --contract --personas developer domain-expert
```

### What gets generated — Developer persona:

```markdown
---
name: catalog
description: Product catalog with full-text search and category management
domainkit-domain: catalog
domainkit-code-paths: src/modules/catalog/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-23
domainkit-persona: developer
---

# Catalog

## Architecture Overview
<!-- High-level components, layers, interactions -->

## Code Patterns
<!-- Design patterns: factories, repositories, middleware, event handlers -->

## Key Dependencies
<!-- Internal and external dependencies, why chosen -->

## API Usage
<!-- Public API surface: exported functions, classes, hooks, endpoints -->

## Setup & Development
<!-- Local dev environment: env vars, seeds, required services -->
```

### What gets generated — Domain Expert persona:

```markdown
---
name: payments
description: Stripe payment processing, refunds, and webhook handling
domainkit-domain: payments
domainkit-code-paths: src/modules/payments/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-23
domainkit-persona: domain-expert
---

# Payments

## Business Rules
<!-- Core business rules, validations, state transitions, formulas -->

## Invariants
<!-- Data consistency rules, referential integrity, constraints -->

## Domain Events
<!-- Events emitted/consumed, triggers, data payload, downstream effects -->

## Edge Cases & Gotchas
<!-- Non-obvious edge cases, race conditions, gotchas -->

## Bounded Context
<!-- What domain owns, delegates, communication with adjacent domains -->
```

> **Same domain, different lenses.** Developers get architecture. Domain experts get business logic.

### Step 4: Fill in domain knowledge

After filling in the payments skill, it looks like this:

```markdown
## Business Rules

- All amounts stored as integers in smallest currency unit (cents for USD)
- Refunds allowed within 30 days of original payment only
- Total refund amount must never exceed original payment amount
- Partial refunds supported — multiple refunds per payment allowed
- Webhook idempotency via Stripe event.id deduplication

## Invariants

- No raw card data stored anywhere — Stripe handles all PCI concerns
- PaymentIntent is created during checkout, NOT when payment is recorded
- stripeChargeId only arrives on `charge.succeeded` event, not on PaymentIntent events

## Domain Events

- `payment.succeeded` — Triggers order confirmation + inventory commit
- `payment.failed` — Triggers checkout session expiry + inventory release
- `payment.refunded` — Triggers order status update + inventory restoration

## Edge Cases & Gotchas

- Webhook events can arrive out of order; always check current payment state
- Stripe test/live mode misconfiguration sends real charges — verify env config
- Refund failures don't auto-retry; need alerting + manual intervention queue
- stripePaymentIntentId vs stripeChargeId — they are NOT interchangeable
```

> **This is the knowledge that prevents costly bugs.** No agent would know these rules from reading the code alone.

### Step 5: Validate

```bash
dk validate --strict
```

```
Validating 3 skill(s)...
  ✓ catalog        valid (2 warnings)
  ✓ payments       valid
  ✓ checkout       valid (1 warning)

All skills valid. 3 warnings (use --strict to fail on warnings)
```

### Step 6: List all skills

```bash
dk list
```

```
┌────────────┬──────────┬──────────────────────────────────────────┬──────┬──────────────┐
│ Name       │ Domain   │ Description                              │ Deps │ Last Verified│
├────────────┼──────────┼──────────────────────────────────────────┼──────┼──────────────┤
│ catalog    │ catalog  │ Product catalog with full-text search     │ 0    │ 2026-03-23   │
│ checkout   │ checkout │ Cart-to-order conversion                  │ 4    │ 2026-03-23   │
│ payments   │ payments │ Stripe payment processing and refunds     │ 1    │ 2026-03-23   │
└────────────┴──────────┴──────────────────────────────────────────┴──────┴──────────────┘
```

---

## Act 4: Brownfield — Adopt in an Existing Codebase (5 min)

### Scenario: You have a TypeScript Express app with 50k lines of code

### Step 1: Initialize

```bash
cd /path/to/existing-project
dk init --platform claude --source-root src
```

### Step 2: Scan your codebase

```bash
dk generate --scan
```

```
Found 6 module(s):
  payments    (confidence: 98%, via: convention) [barrel export, high cohesion (92%), has routes, 12 source files]
  orders      (confidence: 95%, via: convention) [barrel export, high cohesion (88%), has routes, 8 source files]
  catalog     (confidence: 87%, via: heuristic)  [barrel export, 6 source files, depth 1]
  users       (confidence: 76%, via: heuristic)  [has routes, 4 source files]
  analytics   (confidence: 64%, via: framework)  [3 source files, 1 subdirectory]
  utils       (confidence: 35%, via: heuristic)  [9 source files, low cohesion]

Project type: express, language: typescript
```

> **DomainKit found 6 modules automatically** — with confidence scores. `payments` and `orders` scored highest because they have barrel exports, routes, and high internal cohesion. `utils` scored low because it's not a real domain.

### Step 3: Auto-generate skill drafts with a persona

```bash
# Generate for the top modules with domain-expert persona
dk generate --bootstrap --with-contracts --persona domain-expert \
  --modules payments,orders,catalog,users

# Or preview first
dk generate --bootstrap --dry-run
```

```
Generated skill draft: payments (persona: domain-expert)
Generated skill draft: orders (persona: domain-expert)
Generated skill draft: catalog (persona: domain-expert)
Generated skill draft: users (persona: domain-expert)
```

### Step 4: Enrich with tribal knowledge

**What auto-generation captures:** Types, routes, file structure, dependencies.

**What YOU add:** Business rules, gotchas, edge cases, invariants — the stuff that lives in people's heads.

### Step 5: Check drift baseline

```bash
dk drift
```

```
✓  payments                      score= 95  [fresh]
✓  orders                        score=100  [fresh]
⚠  catalog                       score= 70  [stale]
    ⚠ warning  File "src/modules/catalog/search.ts" was modified after last-verified date.
    ℹ info     Route "GET /api/products/featured" exists in code but is not documented.
✓  users                         score= 85  [fresh]
```

> **Catalog is stale** — someone added a `featured` endpoint and modified the search module, but the skill hasn't been updated. DomainKit caught it.

### Step 6: Import from OpenAPI (if you have a spec)

```bash
dk import openapi ./api/openapi.yaml
```

```
Imported 4 skill(s) from OpenAPI spec:
  - users
  - products
  - orders
  - webhooks
```

> **Instant skills from your API spec** — routes and models extracted automatically. Just add business rules.

---

## Act 5: Context Assembly — The Core Value (3 min)

### Smart task matching

```bash
dk context "fix the payment retry bug after webhook timeout"
```

DomainKit automatically:
1. Matches "payment" and "webhook" to the `payments` domain via TF-IDF
2. Resolves `payments` depends on `orders` — loads it too
3. Renders at contract depth within token budget

### Explicit domain selection

```bash
dk context --domains payments,orders --depth full --budget 4000
```

### Three output formats

```bash
# For Claude system prompt
dk context "add refund feature" --format claude

# For any LLM system prompt
dk context "add refund feature" --format system-prompt

# Standard markdown
dk context "add refund feature" --format markdown

# Copy to clipboard (macOS)
dk context "add refund feature" | pbcopy
```

### Progressive disclosure — 15x efficiency

| Tier | What Loads | Tokens |
|------|-----------|--------|
| **Index** | Name + description | ~30-50 |
| **Contract** | Models, routes, rules | ~200-500 |
| **Full** | Complete skill body | ~500-2000 |

> A typical task: 2-3 domains at contract level + rest at index = **~1,200 tokens** vs **~20,000** for a full spec dump. That's a **15x efficiency gain**.

---

## Act 6: Smart Recommendations (1 min)

### Based on your git changes

```bash
# What skills are affected by my current changes?
dk recommend
```

```
Recommended skills (2):

  ★ payments                 80% match  [payments]
  ○ orders                   30% match  [orders]

Suggested command:
  dk context -d payments,orders
```

```bash
# Just staged changes
dk recommend --staged

# For a specific commit
dk recommend --commit abc123

# JSON for CI integration
dk recommend --json
```

> **Before every PR:** run `dk recommend` to see which skills you should verify are still accurate.

---

## Act 7: Universal Sync — One Format, Every Platform (1 min)

### The Agent Skills standard

26+ platforms now natively support SKILL.md files. DomainKit copies your skills to each platform's standard directory — no format conversion needed.

```bash
dk sync --all
```

```
Synced 4 skill(s) to .claude/skills/
Synced 4 skill(s) to .cursor/skills/
Synced 4 skill(s) to .agents/skills/
Synced 4 skill(s) to .github/skills/
```

### Supported platforms

| Platform | Skills Directory |
|----------|-----------------|
| Claude | `.claude/skills/` |
| Cursor | `.cursor/skills/` |
| Codex | `.agents/skills/` |
| GitHub/Copilot | `.github/skills/` |
| Windsurf | `.agents/skills/` |
| VS Code | `.github/skills/` |
| + 20 more | [agentskills.io](https://agentskills.io) |

> **One format. Every platform.** Write SKILL.md once — every AI coding agent reads it natively.

```bash
# Target specific platforms
dk sync --target claude cursor

# Preview without writing
dk sync --all --dry-run

# Clean sync
dk sync --all --clean
```

---

## Act 8: Watch Mode & Continuous Monitoring (1 min)

### Real-time drift detection

```bash
dk watch
```

```
Watching src/ for changes...
Tracking 4 skill(s)

File changed: src/modules/payments/stripe-webhooks.ts
  Affected skill(s): payments
  Run: dk drift --skill payments

File changed: src/modules/orders/returns.ts
  Affected skill(s): orders
  Run: dk drift --skill orders
```

> **Leave it running while you code.** Instant feedback when your changes affect a documented domain.

---

## Act 9: MCP Server — Agents Pull What They Need (1 min)

### Start the server

```bash
dk serve --transport stdio
```

### Add to Claude Desktop config

```json
{
  "mcpServers": {
    "domainkit": {
      "command": "dk",
      "args": ["serve", "--transport", "stdio"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### What agents can do

| MCP Tool | What It Does |
|----------|-------------|
| `list_domains` | "What domains exist in this project?" |
| `get_context` | "Give me context for fixing the payment retry bug" |
| `get_skill` | "Show me the payments skill at full depth" |
| `check_drift` | "Is the payments skill still accurate?" |
| `get_dependencies` | "What does checkout depend on?" |

> **Agents pull context on-demand** — no pre-loading, no guessing, no token waste.

---

## Act 10: Custom Personas (1 min)

### Create your own persona

```bash
dk persona create security-engineer --name "Security Engineer"
```

This creates `.domainkit/personas/security-engineer.yaml`:

```yaml
id: security-engineer
name: Security Engineer
description: Custom persona: security-engineer
focusAreas:
  - area-1
  - area-2
sections:
  - heading: '## Section Title'
    prompt: Describe what content should go in this section.
    required: true
promptContext: Describe how this persona should approach examining code.
priority: supplementary
```

### Customize it

```yaml
id: security-engineer
name: Security Engineer
description: Focuses on auth flows, input validation, and OWASP concerns
focusAreas:
  - authentication flows
  - input validation
  - OWASP top 10
  - secrets management
sections:
  - heading: "## Security Concerns"
    prompt: "Document authentication, authorization, and data protection patterns."
    required: true
  - heading: "## Input Validation"
    prompt: "What inputs are validated? What attack vectors exist?"
    required: true
  - heading: "## Secrets & Credentials"
    prompt: "How are secrets managed? What must never be logged or stored?"
    required: false
promptContext: >
  You are a security engineer auditing this module. Focus on attack surface,
  data protection, auth flows, and OWASP compliance.
priority: supplementary
```

### Use it

```bash
dk add auth --persona security-engineer --domain auth \
  --description "JWT authentication with OAuth2 and API keys"
```

> **Extensible by design.** Your team's unique perspectives become reusable skill templates.

---

## Act 11: CI/CD Integration (1 min)

### Add to your GitHub Actions

```yaml
# .github/workflows/domainkit.yml
name: DomainKit Checks
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install DomainKit
        run: npm install -g domainkit

      - name: Validate skills
        run: dk validate --strict

      - name: Check drift
        run: dk drift --report json --threshold 30

      - name: Recommend affected skills
        run: dk recommend --json
```

> **Every PR gets checked.** No more stale documentation slipping through.

---

## Recap: The Full Command Set

| Command | Purpose | Key Flags |
|---------|---------|-----------|
| `dk init` | Initialize project | `--platform`, `--source-root` |
| `dk add` | Create a skill | `--persona`, `--contract`, `--deps` |
| `dk list` | View all skills | `--json`, `--domain` |
| `dk validate` | Check skill quality | `--strict` |
| `dk context` | Assemble context | `--domains`, `--format`, `--budget`, `--depth` |
| `dk generate` | Auto-scaffold skills | `--scan`, `--bootstrap`, `--persona` |
| `dk drift` | Detect staleness | `--report`, `--threshold` |
| `dk sync` | Sync to platforms | `--all`, `--target`, `--clean` |
| `dk serve` | Start MCP server | `--transport` |
| `dk persona` | Manage personas | `list`, `show`, `create` |
| `dk recommend` | Smart recommendations | `--staged`, `--commit`, `--json` |
| `dk watch` | Real-time monitoring | — |
| `dk import` | Import from specs | `openapi <file>` |

---

## Key Takeaways

1. **Domain knowledge is the missing ingredient** — AI agents write better code when they understand your business rules, not just your syntax.

2. **Personas match perspectives** — Developers need architecture. Domain experts need business rules. Security engineers need threat models. One tool, many lenses.

3. **Write once, sync everywhere** — All 26+ platforms natively support the Agent Skills standard (SKILL.md). One format, every platform.

4. **Drift detection is your safety net** — Skills that diverge from code are worse than no skills. DomainKit catches drift before agents build on stale knowledge.

5. **Progressive disclosure saves tokens** — 15x efficiency gain over monolithic context dumps. Load what you need, at the depth you need.

6. **Open standard, no lock-in** — Every skill DomainKit creates is a valid Agent Skill. No proprietary format. No ecosystem fragmentation.

---

*Built with DomainKit v0.2.0 — [github.com/kharikishan/domainkit](https://github.com/kharikishan/domainkit)*
