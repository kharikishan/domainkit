# Getting Started with DomainKit

This guide walks you through installing DomainKit, creating your first domain skill, and understanding the core concepts.

## Prerequisites

- **Node.js** >= 18 — [Download](https://nodejs.org)
- **Git** — [Download](https://git-scm.com)
- **pnpm** — installed automatically by the setup script, or install manually: `npm install -g pnpm`
- A project directory with source code (or a new project you're starting)

## Installation

### macOS / Linux

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
./setup.sh
```

After the script completes, restart your terminal (or run `source ~/.zshrc` / `source ~/.bashrc`).

### Windows (PowerShell)

```powershell
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
powershell -ExecutionPolicy Bypass -File setup.ps1
```

After the script completes, close and re-open your terminal.

### Windows (Git Bash)

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
./setup.sh
```

After the script completes, close and re-open Git Bash.

### Manual Setup (Any Platform)

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
pnpm install        # install dependencies
pnpm run build      # compile TypeScript
pnpm link --global  # make 'dk' available globally
```

> If `pnpm link --global` fails with a "global bin directory" error, run `pnpm setup` first, restart your terminal, then retry.

### Verify Installation

```bash
dk --version
dk --help
```

### Update to Latest

```bash
cd domainkit
git pull
pnpm run build
```

### Uninstall

```bash
pnpm unlink --global domainkit
```

## Core Concepts

Before diving in, understand these key ideas:

### What is an Agent Skill?

An Agent Skill is a folder containing a `SKILL.md` file that teaches AI coding agents about a specific capability or domain. The format is an open standard adopted by 26+ platforms (Claude Code, Cursor, VS Code, Codex, GitHub Copilot, etc.).

### What DomainKit Adds

DomainKit is a **management layer** on top of Agent Skills. It doesn't change the format — it adds tooling for:

- **Organizing** skills by domain with dependency tracking
- **Assembling** only the relevant skills for a given task
- **Validating** skill metadata and contracts
- **Detecting drift** between skills and code
- **Generating** skills from existing code with persona-based perspectives
- **Recommending** relevant skills based on git diff analysis
- **Syncing** skills to 26+ platforms via the Agent Skills standard
- **Serving** skills via MCP to agents in real-time
- **Watching** source files for changes that affect skills
- **Importing** skills from OpenAPI/Swagger specifications

### The SKILL.md Format

Every skill has a `SKILL.md` file with YAML frontmatter and markdown body:

```markdown
---
name: payments
description: Payment processing via Stripe
domainkit-domain: payments
domainkit-dependencies: orders
domainkit-code-paths: src/modules/payments/**
domainkit-version: "1"
domainkit-last-verified: 2026-03-15
---

# Payments

Payment processing handles all monetary transactions through Stripe.

## Data Models

- **Payment**: id, orderId, amount (cents), status, stripePaymentIntentId
- **Refund**: id, paymentId, amount (cents), status, reason

## Business Rules

- All amounts stored as integers in smallest currency unit (cents for USD)
- Webhook idempotency via Stripe event.id deduplication
- No raw card data stored — Stripe handles all PCI concerns

## API Surface

- `POST /api/webhooks/stripe` — Stripe webhook handler
- `GET /api/orders/:orderId/payment` — Get payment for order
- `POST /api/payments/:paymentId/refund` — Initiate refund

## Gotchas

- PaymentIntent is created during checkout, not when payment is recorded
- Partial refunds are supported — total refund amount cannot exceed original
- Webhook events can arrive out of order; always check current state

## Testing Priorities

1. Webhook signature verification
2. Idempotent event processing
3. Partial refund edge cases
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique skill identifier (lowercase, hyphen-separated) |
| `description` | Yes | One-line description of the domain |
| `domainkit-domain` | No | Domain grouping (defaults to skill name) |
| `domainkit-dependencies` | No | Comma-separated list of skill names this depends on |
| `domainkit-code-paths` | No | Glob patterns pointing to source code for this domain |
| `domainkit-version` | No | Schema version (currently "1") |
| `domainkit-last-verified` | No | Date when skill was last verified against code (YYYY-MM-DD) |

### Contracts (Optional)

For machine-parseable interfaces, add a `references/contract.yaml`:

```yaml
models:
  - name: Payment
    fields:
      - name: id
        type: uuid
        required: true
      - name: amount
        type: integer
        required: true
      - name: status
        type: string
        enum: [pending, succeeded, failed, refunded]

api:
  routes:
    - method: POST
      path: /api/webhooks/stripe
      description: Handle Stripe webhook events
    - method: GET
      path: /api/orders/:orderId/payment
      description: Get payment for an order

events:
  - name: payment.succeeded
    description: Fired when a payment is confirmed by Stripe
  - name: payment.refunded
    description: Fired when a refund is processed
```

Contracts enable:
- **Drift detection** — DomainKit can compare contracts against actual TypeScript types
- **Multi-agent coordination** — Parallel agent sessions reference the same structured data
- **Validation** — `dk validate` checks contract schema correctness

## Initialize Your First Project

### Step 1: Navigate to Your Project

```bash
cd /path/to/your/project
```

### Step 2: Run Init

```bash
dk init
```

This launches an interactive wizard that asks:
- **Platform**: Which agent platform? (claude, codex, vscode, cursor, generic)
- **Source root**: Where is your source code? (default: `src`)
- **Skills directory**: Where should skills be stored? (auto-detected or default: `skills`)

Or skip the wizard:

```bash
dk init --platform claude --source-root src --skills-dir skills
```

This creates:
```
your-project/
  .domainkit/
    config.yaml       # DomainKit configuration
  skills/             # Where domain skills will live
```

### Step 3: Create Your First Skill

```bash
dk add user-auth --domain auth --description "User authentication and session management"
```

You can also use a **persona** to generate different skill templates:

```bash
# Developer-focused (architecture, patterns, dependencies)
dk add user-auth --domain auth --description "User authentication" --persona developer

# Domain-expert-focused (business rules, invariants, events)
dk add user-auth --domain auth --description "User authentication" --persona domain-expert
```

See available personas with `dk persona list`.

This scaffolds:
```
skills/
  user-auth/
    SKILL.md           # Skill template to fill in
```

Add `--contract` to also generate a contract template:

```bash
dk add user-auth --domain auth --description "User authentication" --contract
```

This creates:
```
skills/
  user-auth/
    SKILL.md
    references/
      contract.yaml    # Contract template
```

### Step 4: Fill In Your Skill

Open `skills/user-auth/SKILL.md` and replace the placeholder sections with your actual domain knowledge. Focus on:

1. **Data Models** — What are the key entities and their fields?
2. **Business Rules** — What invariants must hold? What are the constraints?
3. **API Surface** — What endpoints or interfaces does this domain expose?
4. **Gotchas** — What's non-obvious? What breaks when someone doesn't know this?
5. **Testing Priorities** — What must always be tested when changing this domain?

### Step 5: Validate

```bash
dk validate
```

This checks:
- All required frontmatter fields are present
- Dependencies reference existing skills
- Contract files (if present) match the JSON schema
- Code paths (if specified) match at least one file

Use `--strict` to treat warnings as errors:

```bash
dk validate --strict
```

### Step 6: Use Your Skills

**Assemble context for a task:**

```bash
dk context "add password reset flow" --format claude
```

**List all skills:**

```bash
dk list
dk list --domain auth --json
```

**Check for drift:**

```bash
dk drift
dk drift --skill user-auth
```

**Sync to agent platform:**

```bash
dk sync --all
```

## Project Structure

After setup, your project will look like:

```
your-project/
  .domainkit/
    config.yaml           # DomainKit configuration
  skills/
    user-auth/
      SKILL.md            # Authentication domain knowledge
      references/
        contract.yaml     # Formal interface definition
    billing/
      SKILL.md            # Billing domain knowledge
    notifications/
      SKILL.md            # Notification domain knowledge
  src/                    # Your source code
    ...
```

## Configuration

The `.domainkit/config.yaml` file controls DomainKit's behavior:

```yaml
version: "1"
skillsDir: skills
sourceRoot: src
platform: claude

# Optional: sync targets
sync:
  targets:
    - claude
    - cursor

# Optional: drift detection settings
drift:
  threshold: 30          # Days before a skill is considered stale
  strategies:
    - staleness
    - file-coverage

# Optional: context assembly defaults
context:
  defaultBudget: 8000    # Token budget
  defaultFormat: claude   # Output format (claude, system-prompt, markdown)
  defaultDepth: contract  # Default depth (index, contract, full)
```

## New in v0.2

- **Persona-based generation** — `dk add --persona developer` or `--persona domain-expert` generates different SKILL.md templates. Custom personas via `.domainkit/personas/*.yaml`.
- **Smart recommendations** — `dk recommend` analyzes git diffs to suggest which skills need attention.
- **Universal sync** — `dk sync` copies skills to 26+ platforms via the Agent Skills standard — one format, every platform.
- **Watch mode** — `dk watch` monitors source files and alerts when changes affect skills.
- **OpenAPI import** — `dk import openapi ./spec.yaml` generates skills from API specifications.
- **Full drift detection** — All four strategies (staleness, file-coverage, api-routes, model-diff) are now fully integrated.

## What's Next?

- **Starting a new project?** Read the [Greenfield Guide](greenfield-guide.md)
- **Adding to an existing codebase?** Read the [Brownfield Guide](brownfield-guide.md)
- **Want to write better skills?** Read the [Skill Authoring Guide](skill-authoring.md)
- **Need the full command reference?** Read the [CLI Reference](cli-reference.md)
- **Setting up MCP for Claude Desktop?** Read the [MCP Integration Guide](mcp-integration.md)
