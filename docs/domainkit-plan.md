# DomainKit

## A Management & Tooling Layer for Domain-Focused Agent Skills

**Version:** 1.0 — March 2026
**License:** MIT

---

# 1. What DomainKit Is

DomainKit is a CLI and MCP server that helps development teams package their product domain knowledge as Agent Skills and then manage, assemble, validate, and keep those skills synchronized with their codebase as it evolves.

Agent Skills (agentskills.io) is the open standard for giving AI coding agents reusable capabilities and expertise. It's adopted by 26+ platforms including Claude Code, OpenAI Codex, VS Code, GitHub Copilot, Cursor, Gemini CLI, and more. The format is simple — a folder with a SKILL.md file — and it supports progressive disclosure, scripts, references, and assets.

Agent Skills works beautifully for packaging capabilities: how to create a PowerPoint, how to run database migrations, how to process PDFs. But when teams try to use it for product domain knowledge — what the checkout module does, what business rules govern time tracking, what the API surface looks like for user authentication — they hit a wall. There's no way to:

- See all domain skills in a project at a glance with their relationships
- Give an agent the right domain context for a specific task without loading everything
- Detect when domain skills have drifted from the actual codebase
- Generate domain skills from an existing codebase
- Manage dependencies between domains
- Serve domain context to agents in real-time via MCP

DomainKit fills every one of these gaps while staying fully compatible with the Agent Skills standard. Every skill created by DomainKit is a valid Agent Skill. Every Agent Skill can be managed by DomainKit. There is no new format to learn, no ecosystem to fragment, no platform lock-in. DomainKit is a management layer — it makes Agent Skills dramatically more effective for domain knowledge without changing what they are.

```
┌──────────────────────────────────────────────────┐
│            DomainKit (management layer)           │
│                                                  │
│   Manifest    Context     Drift      Code        │
│   Generation  Assembly    Detection  Generation  │
│                                                  │
│   Multi-Agent   MCP       Dependency  Token      │
│   Sync          Server    Resolution  Budgets    │
├──────────────────────────────────────────────────┤
│          Agent Skills Standard (foundation)       │
│                                                  │
│   SKILL.md  │  scripts/  │  references/  │ assets│
│   26+ platforms  │  Progressive disclosure       │
└──────────────────────────────────────────────────┘
```

---

# 2. The Problem

## 2.1 Context Pollution

When a coding agent receives a task, it needs context about the relevant part of the system — not the entire system. But most teams provide context in one of two ways: a large specification document, or a single rules file (CLAUDE.md, .cursorrules). Both dump everything into the agent's context window regardless of relevance.

A team building a project management tool has documentation covering user authentication, project CRUD, task management, time tracking, reporting, team permissions, notifications, and billing. A developer asks the agent to fix a bug where logged hours aren't rounding correctly.

The agent receives everything. It now has context about billing's Stripe integration, the notification queue architecture, the team permission inheritance model — none of which matter for a rounding bug. The agent doesn't know what's relevant and what isn't. It reasons over all of it. It might reference billing's decimal handling when the time tracking module uses a different precision model. It might suggest changes to the reporting module "for consistency" when only the time entry service needs fixing. It burns 60% of its context window on information that actively dilutes its output.

This is context pollution. More information does not produce better results. The right information at the right depth produces better results.

**DomainKit solves this** by packaging each product domain as its own Agent Skill and then assembling only the relevant domains — at the right disclosure depth — for each task.

## 2.2 Staleness and Drift

A specification captures intent at a moment in time. Code captures reality continuously. They diverge within days.

A platform's architecture document specifies JWT authentication with 24-hour expiry stored in httpOnly cookies. Three weeks later, a security review prompts a switch to session-based auth with Redis-backed token storage. The code changes. The documentation doesn't. Nobody updates it because the sprint is moving and the docs live in a wiki nobody opens after planning.

Two months later, a new developer joins. They ask the coding agent to add a "remember me" feature. The agent reads the stale documentation, sees JWT + cookies, and builds the feature around a pattern the codebase abandoned weeks ago. The PR fails review. Trust in the agent drops.

This isn't carelessness. It's structural. Documentation doesn't have feedback loops with code. It can't detect its own staleness. Keeping it synchronized requires manual effort that competes with shipping features.

**DomainKit solves this** through automated drift detection that compares domain skills against the actual codebase — checking for staleness, uncovered files, API route changes, and type mismatches.

## 2.3 No Progressive Disclosure

Human reading is inherently progressive. You skim headers, drill into relevant sections, skip what doesn't apply. Agents don't get this when given a flat specification. Every section has equal weight — the authentication module's OAuth2 PKCE flow details sit alongside the notification module's email template structure.

A developer asks the agent to add email verification to the signup flow. The agent needs three domains: authentication (the signup endpoint), notifications (email sending), and user accounts (the verified status field). It does not need reporting, admin dashboards, payment processing, search indexing, file uploads, or API rate limiting. But it gets all of them. Each irrelevant section is a potential source of confusion.

**DomainKit solves this** through three-layer progressive disclosure that maps directly to the Agent Skills standard:

| Layer | Agent Skills Tier | What Loads | Token Cost |
|---|---|---|---|
| **Index** | Discovery (name + description) | Domain name and one-line purpose | ~30-50 per domain |
| **Contract** | Activation (full SKILL.md) | Data models, API surface, business rules, constraints | ~200-500 per domain |
| **Reference** | Execution (references/ files) | User stories, architecture decisions, technical debt | ~500-2000 per domain |

A typical task needs 2-3 domains at contract level and the rest at index level. Total context: ~1,200 tokens. Compare to a full specification dump: ~20,000 tokens. That's a 15x efficiency gain.

## 2.4 The Greenfield Challenge

Everything above assumes an existing codebase. But the problem is equally severe when building something new. When a team starts a project with a coding agent, they typically dump an entire PRD into the agent's context and say "build this." The agent tries to build everything at once — data models, API routes, business logic, UI components — because it has no structured way to decompose the work into domains.

The result is monolithic code that tangles concerns, inconsistent patterns across modules (because the agent's attention drifted mid-generation), and a codebase that's immediately hard to extend.

**DomainKit solves this** by letting teams define domain boundaries before code exists. You create Agent Skills for each domain — describing its interfaces, rules, and relationships — and then give the agent one domain at a time with the right dependency context. The agent builds focused, bounded code because it received focused, bounded context.

## 2.5 The Coordination Problem

Multiple agents or agent sessions working on different parts of a system need shared definitions. Without them, each session operates with its own interpretation. Two parallel sessions building related features might use different status enums, different field names, or different validation rules — because they each read the same prose and interpreted it differently.

**DomainKit solves this** with machine-parseable contracts that define exact models, enums, and rules in structured YAML. Both sessions reference the same contract. There's no ambiguity because the contract is data, not prose.

---

# 3. Principles

## 3.1 Domains Over Features

Features cross domain boundaries. "Add email verification to signup" touches authentication, user accounts, and notifications. If you organize context by feature, an agent gets a jumbled mix of concerns. If you organize by domain, an agent gets clean, bounded context for each area it needs to touch.

Domains are stable. Features are ephemeral. A "checkout" domain exists for the lifetime of the product. A "holiday discount campaign" feature exists for two sprints. Domain skills persist and accumulate knowledge. Feature specs get written, executed, and forgotten.

Every bounded context in your system becomes one Agent Skill. The skill describes that domain completely — its models, rules, API surface, constraints, and gotchas. When an agent needs to work in that domain, it activates the skill and gets exactly the context it needs.

## 3.2 Progressive Disclosure Over Flat Dumps

Not all context is created equal. An agent fixing a rounding bug needs different depth than an agent redesigning the time tracking architecture.

DomainKit uses the three-tier progressive disclosure model built into the Agent Skills standard:

**Index (always loaded, ~30-50 tokens per domain):** The skill's name and description. The agent knows what domains exist and roughly what each one covers. This is the Agent Skills "discovery" tier — every compatible agent loads this at startup.

**Contract (loaded on demand, ~200-500 tokens per domain):** The full SKILL.md body. Data models, API surface, business rules, constraints, gotchas, testing priorities. This is the Agent Skills "activation" tier — loaded when the agent determines a task matches the skill's description.

**Reference (loaded rarely, ~500-2000 tokens per domain):** Files in the references/ directory. Architecture decision records, user stories, technical debt documentation, detailed type schemas. This is the Agent Skills "execution" tier — loaded only when the agent needs deep context during task execution.

DomainKit's context assembly engine respects these tiers. Given a task, it identifies relevant domains, loads them at the appropriate tier, resolves dependencies, and assembles a context payload within a token budget.

## 3.3 Contracts Over Prose

Markdown is for humans. Structured data is for agents and tooling.

A prose description like "the maximum number of discount codes per order is 2, with percentage discounts applied before fixed-amount discounts" is readable but unparseable. An agent can't programmatically validate its output against this sentence. Drift detection tooling can't compare it against code.

DomainKit solves this in two complementary ways:

**In the SKILL.md body:** Write clear, structured markdown with explicit sections for data models, business rules, and API surface. This is what agents read. It's human-readable AND agent-consumable.

**In references/contract.yaml (optional):** Define models, API routes, and rules in structured YAML. This is what DomainKit tooling reads for drift detection, validation, and generation. Agents can also read it when they need precise structural detail.

The SKILL.md is always the primary artifact. contract.yaml is an enhancement for teams that want automated drift detection. DomainKit's core features work with just SKILL.md files.

## 3.4 Build on Standards, Don't Invent Them

DomainKit uses the Agent Skills standard exactly as specified. Every SKILL.md file created by DomainKit is a valid Agent Skill. DomainKit extends the standard through the `metadata` field — which the spec explicitly provides for "additional properties not defined by the Agent Skills spec" — using `domainkit-*` prefixed keys.

This means:
- Skills created by DomainKit work on all 26+ Agent Skills platforms immediately
- Teams already using Agent Skills can adopt DomainKit incrementally
- DomainKit evolves with the standard rather than competing with it
- If Anthropic extends Agent Skills with structured metadata, DomainKit adopts it

## 3.5 Generate, Don't Require Manual Authoring

Nobody wants to write 15 domain skills from scratch for an existing codebase. DomainKit scans your code, identifies module/domain boundaries, extracts types and routes, and generates draft SKILL.md files. A human reviews and refines them. The tool does the tedious extraction; the human provides the judgment.

For new projects, DomainKit provides interactive scaffolding that guides you through defining each domain — name, description, dependencies, code paths — and generates the SKILL.md template.

## 3.6 Detect Drift, Don't Prevent It

Drift between documentation and code is inevitable. The question is whether you detect it or discover it after a failed PR. DomainKit doesn't try to prevent drift (that would require coupling documentation updates to every code change, which kills velocity). Instead, it detects drift on demand and reports it clearly.

`domainkit drift` answers: which skills are stale? Which code files aren't covered by any skill? Which API routes exist in code but not in the skill? Which types have changed? The developer decides what to update and when.

## 3.7 Interactive by Default, Automatable When Needed

When DomainKit matches domains to a task, it shows the matches and lets the developer confirm or adjust before assembling context. This is more honest than pretending keyword matching is smart enough to always get it right. For CI/CD pipelines and scripts, the `--auto` flag skips confirmation.

---

# 4. Architecture

## 4.1 File Structure

DomainKit works with the standard Agent Skills directory locations used by each platform:

```
project/
├── .claude/skills/              # Skills location (Claude Code)
│   ├── authentication/
│   │   ├── SKILL.md             # Primary artifact (Agent Skills standard)
│   │   └── references/
│   │       ├── contract.yaml    # Optional: structured contract for tooling
│   │       ├── decisions.md     # Architecture decision records
│   │       └── debt.md          # Known technical debt
│   ├── checkout/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── contract.yaml
│   ├── cart/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── inventory/
│   │   └── SKILL.md
│   ├── notifications/
│   │   └── SKILL.md
│   └── user-accounts/
│       └── SKILL.md
│
├── .domainkit/                  # DomainKit management data
│   ├── config.yaml              # Configuration
│   └── .drift-cache/            # Last drift results (gitignored)
│
└── src/                         # Application source code
    └── modules/
        ├── auth/
        ├── checkout/
        ├── cart/
        ├── inventory/
        ├── notifications/
        └── users/
```

**Design decisions:**

**Skills live in the agent's standard location.** Not in a DomainKit-specific directory. `.claude/skills/` for Claude Code, `.agents/skills/` for Codex, `.github/skills/` for VS Code/Copilot. This means agents discover domain skills natively, using their built-in progressive disclosure, without any export or conversion step.

**The manifest is generated, not stored.** DomainKit scans all SKILL.md files, reads their frontmatter and `domainkit-*` metadata fields, and constructs a project-wide manifest in memory. There is no separate manifest.yaml file to maintain or keep in sync. The SKILL.md files ARE the manifest data.

**contract.yaml lives in references/.** Following the Agent Skills convention for additional documentation that agents load on demand. Agents don't read it by default. DomainKit tooling reads it for drift detection and validation. Teams that don't want drift detection can skip contract.yaml entirely.

**DomainKit's own footprint is minimal.** Just `config.yaml` (pointing to the skills directory and source root) and a gitignored drift cache. Everything important lives in the Agent Skills files themselves.

## 4.2 SKILL.md Convention for Domains

A domain-focused SKILL.md that follows both the Agent Skills specification and DomainKit conventions:

```markdown
---
name: time-tracking
description: >-
  Time entry logging, hour calculations, rounding rules, timer
  mode, manual entry, and timesheet generation. Use this skill
  when working on anything related to logging time, calculating
  hours, time reports, timers, or timesheet exports.
metadata:
  domainkit-domain: productivity
  domainkit-dependencies: tasks user-accounts
  domainkit-code-paths: src/modules/time-tracking/**
  domainkit-last-verified: "2026-03-15"
  domainkit-version: "1.0"
---

# Time Tracking

## Data Models

### TimeEntry
- id: uuid
- taskId: references tasks domain
- userId: references user-accounts domain
- startTime: datetime (required for timer mode)
- endTime: datetime (required for timer mode)
- duration: integer (minutes, required for manual mode)
- roundedDuration: integer (minutes, computed)
- description: string (optional, max 500 chars)
- billable: boolean (default true)
- createdAt: datetime

### Timesheet
- userId, dateRange
- entries: TimeEntry[]
- totalHours, billableHours, nonBillableHours (all computed)

## Business Rules

- Rounding: configurable per-project (15min, 30min, 1hr, none)
- Default rounding: nearest 15 minutes
- Rounding direction: standard (>=7.5 rounds up for 15min intervals)
- Maximum single entry: 24 hours
- Entries cannot overlap for the same user
- Retroactive entries allowed up to 14 days back
- Timer mode computes duration from start/end
- Manual mode accepts duration directly

## API Surface

- POST /api/time/entries — create time entry
- PUT  /api/time/entries/:id — update (only if within same day)
- DELETE /api/time/entries/:id — soft delete
- GET  /api/time/entries?userId=&dateFrom=&dateTo= — list entries
- GET  /api/time/timesheets?userId=&dateFrom=&dateTo= — get timesheet

## Gotchas

- The rounding config is per-project, NOT per-task. Don't look for
  task-level rounding overrides — they don't exist.
- Timer "pause" is implemented as ending the current entry and starting
  a new one. There's no pause field on TimeEntry.
- The duration field is ALWAYS in minutes internally, even though the
  UI shows hours:minutes. Convert at the API boundary.
- Soft-deleted entries are excluded from timesheets by default. The
  includeDeleted query param overrides this.

## Testing Priorities

- Rounding calculation across all modes (15min, 30min, 1hr)
- Overlap detection for same-user concurrent entries
- Timer lifecycle: start, pause (= stop + start), resume, stop
- Timesheet aggregation with mixed billable/non-billable entries
- Retroactive entry within and beyond 14-day window
- Manual entry with duration exceeding 24-hour limit

## References

For structured type definitions and API schemas:
[references/contract.yaml](references/contract.yaml)

For architecture decisions:
[references/decisions.md](references/decisions.md)
```

**What makes this a valid Agent Skill:**
- `name` and `description` in frontmatter (required by spec) ✓
- `metadata` uses arbitrary key-value pairs (allowed by spec) ✓
- Markdown body with no structural restrictions (allowed by spec) ✓
- references/ directory for additional documentation (spec convention) ✓
- Progressive disclosure: name + description loads first, full SKILL.md loads on activation, references/ loads on demand ✓

**What makes this a DomainKit-managed skill:**
- `domainkit-domain`: Groups skills by business area (productivity, commerce, identity, etc.)
- `domainkit-dependencies`: Lists other skills this domain depends on (space-separated names)
- `domainkit-code-paths`: Glob patterns mapping this skill to source code locations
- `domainkit-last-verified`: Date when a human last confirmed the skill matches the code
- `domainkit-version`: Semantic version of the skill content

## 4.3 The domainkit-* Metadata Fields

| Field | Required | Description | Example |
|---|---|---|---|
| `domainkit-domain` | No | Business area grouping | `commerce`, `identity`, `messaging` |
| `domainkit-dependencies` | No | Space-separated skill names this domain depends on | `cart user-accounts notifications` |
| `domainkit-code-paths` | No | Space-separated glob patterns mapping skill to source files | `src/modules/checkout/** src/services/payment/**` |
| `domainkit-last-verified` | No | ISO date when a human last confirmed accuracy | `2026-03-15` |
| `domainkit-version` | No | Version of the skill content | `1.2` |

All fields are optional. A skill with none of these fields is still a valid Agent Skill and can still be listed by `domainkit list`. The more metadata you provide, the more DomainKit features become available:

| Fields Present | Features Unlocked |
|---|---|
| None | List, validate, basic context assembly |
| `domainkit-dependencies` | Dependency resolution in context assembly |
| `domainkit-code-paths` | File coverage drift detection |
| `domainkit-last-verified` | Staleness detection |
| `domainkit-code-paths` + contract.yaml | API route and model drift detection |

## 4.4 references/contract.yaml

An optional structured contract file that DomainKit tooling uses for drift detection and validation. Agents can also read it when they need precise structural detail.

```yaml
# references/contract.yaml
# Read by DomainKit for drift detection
# Read by agents when structural precision is needed

domain: time-tracking

models:
  TimeEntry:
    id: { type: uuid, generated: true }
    taskId: { type: uuid, references: "tasks.Task.id" }
    userId: { type: uuid, references: "user-accounts.User.id" }
    startTime: { type: datetime, required_when: "mode=timer" }
    endTime: { type: datetime, required_when: "mode=timer" }
    duration: { type: integer, unit: minutes, required_when: "mode=manual" }
    roundedDuration: { type: integer, unit: minutes, computed: true }
    description: { type: string, max_length: 500, nullable: true }
    billable: { type: boolean, default: true }
    createdAt: { type: datetime, generated: true }

  Timesheet:
    userId: { type: uuid }
    dateRange: { type: date_range }
    entries: { type: "TimeEntry[]" }
    totalHours: { type: decimal, computed: true }
    billableHours: { type: decimal, computed: true }
    nonBillableHours: { type: decimal, computed: true }

api:
  - method: POST
    path: /api/time/entries
    auth: required
  - method: PUT
    path: /api/time/entries/:id
    auth: required
    constraint: same_day_only
  - method: DELETE
    path: /api/time/entries/:id
    auth: required
    behavior: soft_delete
  - method: GET
    path: /api/time/entries
    auth: required
    params: [userId, dateFrom, dateTo]
  - method: GET
    path: /api/time/timesheets
    auth: required
    params: [userId, dateFrom, dateTo]

rules:
  rounding:
    modes: [15min, 30min, 1hr, none]
    default: 15min
    scope: per_project
  overlap_prevention:
    enforcement: database_constraint + api_validation
  max_duration:
    value: 1440
    unit: minutes
  retroactive_window:
    value: 14
    unit: days
  same_day_edit:
    description: "Entries can only be updated on the same calendar day"
```

Teams that don't want drift detection can skip this file entirely. The SKILL.md works perfectly well without it.

## 4.5 Context Assembly

When a developer runs `domainkit context "fix the time rounding bug"`, the following happens:

```
Step 1: EXTRACT
  Parse task description → keywords: [time, rounding, bug, fix]

Step 2: SCORE
  Score each skill's description + SKILL.md body against keywords
  → time-tracking: 0.91 (direct hit: "time", "rounding")
  → reporting:     0.18 (weak: reports show time data)
  → tasks:         0.22 (weak: tasks have time entries)
  → others:        <0.10

Step 3: SELECT (interactive)
  Show developer the matches:
    ● time-tracking (0.91) — primary match
    ○ tasks (0.22) — weak match
  Developer confirms or adjusts

Step 4: RESOLVE DEPENDENCIES
  time-tracking depends on: tasks, user-accounts
  → tasks: load at index level (dependency, not primary)
  → user-accounts: load at index level (dependency)

Step 5: COMPOSE
  All skills at index level (name + description):  ~280 tokens
  time-tracking at contract level (full SKILL.md):  ~420 tokens
  Total:                                            ~700 tokens

Step 6: FORMAT
  Render into target format:
  - CLAUDE.md for Claude Code
  - System prompt XML for generic agents
  - Plain markdown for manual use

Step 7: OUTPUT
  Write to stdout, file, or clipboard
```

**Token budget comparison for this task:**

| Approach | Tokens | Signal Quality |
|---|---|---|
| Full project PRD (35 pages) | ~20,000 | ~8% relevant |
| Split specs (SPEC_backend.md) | ~8,000 | ~25% relevant |
| DomainKit (1 domain contract + 7 domain index) | ~700 | ~90% relevant |

## 4.6 Drift Detection

DomainKit detects drift through four strategies, each progressively more sophisticated:

### Strategy 1: Staleness

The simplest check. Reads `domainkit-last-verified` from SKILL.md metadata and flags skills not verified within a configurable threshold (default: 30 days).

```
checkout:
  ⚠ STALE: Last verified 45 days ago (threshold: 30 days)
```

When the developer reviews and confirms the skill is still accurate, they update the date: `domainkit-last-verified: "2026-03-19"`. This takes seconds and is the cheapest way to maintain skill freshness.

### Strategy 2: File Coverage

Reads `domainkit-code-paths` glob patterns and scans the actual filesystem. Detects two types of gaps:

**Uncovered files:** New source files exist in the code paths that weren't there when the skill was last verified. The skill might not describe the new functionality.

```
checkout:
  ⚠ NEW FILES: src/modules/checkout/refund-v2.ts not in skill
```

**Missing paths:** The skill references code paths that no longer exist. The code was removed or restructured but the skill wasn't updated.

```
inventory:
  ✗ MISSING: src/modules/inventory/ does not exist
```

### Strategy 3: API Route Diff

Parses route definitions in the codebase (Express and Next.js App Router in v1) and compares them against the API Surface section in SKILL.md and/or the `api` entries in contract.yaml.

```
checkout:
  ⚠ ROUTE ADDED: POST /api/checkout/:id/partial-refund exists in code
    but not in skill
  ⚠ ROUTE REMOVED: GET /api/checkout/history defined in skill
    but not found in code
```

### Strategy 4: Model Schema Diff

For teams with contract.yaml, compares model definitions against TypeScript interfaces/types in the codebase using AST analysis. Limited to simple interfaces in v1 (no generics, utility types, or Zod schema resolution).

```
checkout:
  ⚠ MODEL DRIFT: Order.refundReason field exists in code
    but not in contract.yaml
  ⚠ TYPE CHANGE: Order.status is string in code
    but enum in contract.yaml
```

## 4.7 Skill Generation

For existing codebases, DomainKit scans the source tree and generates draft domain skills.

**Module discovery heuristics:**
- Top-level directories under `src/modules/`, `src/features/`, `src/domains/`
- Barrel exports (index.ts files that re-export from subdirectories)
- Route file groupings (files under `routes/`, `api/`, or Next.js `app/` directories)
- Import clustering (files that import heavily from each other likely belong to the same domain)

**Type extraction:**
- Exported TypeScript interfaces and type aliases
- Zod schema definitions (extracted as type shapes)
- Prisma model definitions (when schema.prisma is present)

**Route extraction:**
- Express: `app.get()`, `router.post()`, etc.
- Next.js App Router: file-system routing from `app/` directory structure

**Output:** Draft SKILL.md files following both the Agent Skills spec and DomainKit conventions. Always marked as drafts that need human review and refinement. The tool extracts structure; the human provides judgment, business context, and gotchas.

## 4.8 Multi-Agent Sync

Different coding agents expect skills in different directories:
- Claude Code: `.claude/skills/`
- OpenAI Codex: `.agents/skills/`
- VS Code / GitHub Copilot: `.github/skills/`
- Cursor: `.cursor/skills/`

DomainKit stores skills in one canonical location (configured during `domainkit init`) and provides `domainkit sync` to distribute them to other agents' expected directories. This means a team using multiple agents maintains one set of domain skills, not three or four copies.

## 4.9 MCP Server

DomainKit runs as an MCP (Model Context Protocol) server, exposing domain context management as tools that any MCP-compatible agent can call during a session.

**Tools:**

| Tool | Description |
|---|---|
| `list_domains` | Returns all domain skills with metadata (name, description, domain group, dependencies, last-verified date) |
| `get_context` | Given a task description, runs the matching + assembly engine and returns composed context |
| `get_skill` | Returns a specific skill at a specified depth (index, contract, or full with references) |
| `check_drift` | Runs drift detection and returns results |
| `get_dependencies` | Returns the dependency graph for a domain |

This eliminates the need for any export step. The agent asks for context, DomainKit assembles it, the agent receives exactly what it needs — all within the active session.

---

# 5. Using DomainKit

## 5.1 Getting Started with a New Project

```bash
# Install DomainKit
npm install -g domainkit

# Initialize in your project
cd my-project
domainkit init

# DomainKit detects your agent's skills directory
# and creates .domainkit/config.yaml

# Create your first domain skill
dk add authentication

# DomainKit walks you through:
#   ? Domain description: User registration, login, sessions, OAuth, MFA
#   ? Dependencies (other domains): user-accounts notifications
#   ? Code paths (glob patterns): src/modules/auth/** src/middleware/auth*
#
# Creates .claude/skills/authentication/SKILL.md with domainkit-* metadata
# Open the SKILL.md and fill in:
#   - Data models
#   - Business rules
#   - API surface
#   - Gotchas
#   - Testing priorities

# Repeat for each domain
dk add user-accounts
dk add projects
dk add tasks
dk add notifications

# View all domains
dk list

# ┌─────────────────┬────────────┬─────────────────┬──────────────┐
# │ Name            │ Domain     │ Dependencies    │ Last Verified│
# ├─────────────────┼────────────┼─────────────────┼──────────────┤
# │ authentication  │ identity   │ user-accounts,  │ 2026-03-19   │
# │                 │            │ notifications   │              │
# │ user-accounts   │ identity   │ —               │ 2026-03-19   │
# │ projects        │ workspace  │ user-accounts,  │ 2026-03-19   │
# │                 │            │ team-permissions│              │
# │ tasks           │ workspace  │ projects,       │ 2026-03-19   │
# │                 │            │ user-accounts   │              │
# │ notifications   │ messaging  │ —               │ 2026-03-19   │
# └─────────────────┴────────────┴─────────────────┴──────────────┘
```

## 5.2 Getting Started with an Existing Codebase

```bash
# Install and initialize
npm install -g domainkit
cd existing-project
domainkit init

# Scan codebase for domain boundaries
dk generate --scan

# DomainKit discovers modules:
#   src/modules/auth/          → authentication
#   src/modules/cart/          → cart
#   src/modules/checkout/      → checkout
#   src/modules/inventory/     → inventory
#   src/modules/users/         → user-accounts
#   src/modules/notifications/ → notifications
#
#   Also found:
#     src/services/payment/    → checkout?
#     src/services/email/      → notifications?

# Generate draft skills
dk generate --bootstrap

# Creates SKILL.md drafts for each discovered domain
# with extracted types, routes, and code path mappings

# Review and refine each SKILL.md
# Add business rules, gotchas, and testing priorities
# The tool extracts structure; you provide judgment

# Validate everything
dk validate
```

## 5.3 Assembling Context for a Task

```bash
# Interactive mode (default) — shows matches, lets you adjust
dk context "fix the discount stacking bug where 3 codes can be applied"

# Output:
#   Matched domains:
#     ● checkout    (0.89) — Order creation, payment, discounts, tax
#     ○ cart        (0.31) — Shopping cart, item operations
#
#   Dependencies (index level):
#     ○ user-accounts
#     ○ notifications
#
#   ? Adjust selection? (enter to accept)
#
#   Assembled context (923 tokens) → [stdout]

# Explicit domain selection (skip matching)
dk context "fix the discount stacking bug" --domains checkout,cart

# Write to CLAUDE.md for Claude Code
dk context "fix the discount stacking bug" --format claude --output .claude/CLAUDE.md

# Automatic mode for CI/scripts
dk context "fix the discount stacking bug" --auto --format system > context.txt

# Custom token budget
dk context "redesign the checkout flow" --budget 8000
```

## 5.4 Detecting Drift

```bash
# Check all domain skills
dk drift

# Output:
#   checkout:
#     ⚠ STALE: Last verified 45 days ago
#     ⚠ NEW FILES: src/modules/checkout/refund-v2.ts
#     ✓ API routes: 4/4 found
#
#   cart:
#     ✓ Fresh (5 days ago)
#     ✓ All code paths covered
#
#   authentication:
#     ⚠ NEW FILES: src/middleware/auth-rate-limit.ts
#     ✓ Fresh (12 days ago)
#
#   Summary: 1 stale, 2 coverage gaps, 3 clean

# Check a specific skill
dk drift --skill checkout

# Generate a markdown report
dk drift --report md > drift-report.md

# Generate JSON for CI/CD
dk drift --report json
```

## 5.5 Syncing to Multiple Agents

```bash
# Skills live in .claude/skills/ (canonical location)
# Sync to Codex
dk sync --target codex
# → Copies skills to .agents/skills/

# Sync to VS Code / Copilot
dk sync --target vscode
# → Copies skills to .github/skills/

# Sync to all configured targets
dk sync --all
```

## 5.6 Running the MCP Server

```bash
# Start MCP server
dk serve

# Agents can now call:
#   list_domains → all skills with metadata
#   get_context("fix the rounding bug") → assembled context
#   get_skill("checkout", "contract") → full SKILL.md
#   check_drift() → drift detection results

# With custom port
dk serve --port 3001
```

---

# 6. Context Assembly Output Formats

## 6.1 CLAUDE.md Format

```markdown
# DomainKit Context — taskflow

## All Domains (Index)
| Domain | Area | Purpose |
|---|---|---|
| authentication | identity | User registration, login, sessions, OAuth, MFA |
| user-accounts | identity | User profiles, preferences, avatar, settings |
| projects | workspace | Project CRUD, settings, member management |
| tasks | workspace | Task CRUD, assignment, status transitions |
| time-tracking | productivity | Time entries, hour logging, rounding rules |
| team-permissions | access-control | Roles, permissions, access policies |
| notifications | messaging | Email, in-app, push dispatch and templates |
| reporting | analytics | Dashboards, time reports, project progress |

## Active Context

### time-tracking (FULL CONTEXT)

[Full SKILL.md content rendered here]

### tasks (INDEX ONLY — dependency)

Task CRUD, assignment, status transitions, dependencies between tasks.
For full context: .claude/skills/tasks/SKILL.md

### user-accounts (INDEX ONLY — dependency)

User profiles, preferences, avatar management, account settings.
For full context: .claude/skills/user-accounts/SKILL.md
```

## 6.2 System Prompt Format (Generic Agents)

```xml
<project name="taskflow" stack="typescript, nextjs, postgresql, redis">

<domain_index>
authentication: User registration, login, sessions, OAuth, MFA
user-accounts: User profiles, preferences, avatar, settings
projects: Project CRUD, settings, member management
tasks: Task CRUD, assignment, status transitions
time-tracking: Time entries, hour logging, rounding rules
team-permissions: Roles, permissions, access policies
notifications: Email, in-app, push dispatch and templates
reporting: Dashboards, time reports, project progress
</domain_index>

<active_domain name="time-tracking" depth="contract">
[Full SKILL.md content]
</active_domain>

<dependency name="tasks" depth="index">
Task CRUD, assignment, status transitions, dependencies between tasks.
</dependency>

<dependency name="user-accounts" depth="index">
User profiles, preferences, avatar management, account settings.
</dependency>

</project>
```

---

# 7. Example Projects

DomainKit ships with three complete example projects demonstrating the convention across different application types.

## 7.1 Project Management App (8 domains)

| Domain | Area | Key Concepts |
|---|---|---|
| authentication | identity | Registration, login, OAuth, MFA, sessions |
| user-accounts | identity | Profiles, preferences, avatars, settings |
| projects | workspace | Project CRUD, settings, member management |
| tasks | workspace | Task CRUD, assignment, status transitions, dependencies |
| time-tracking | productivity | Time entries, rounding, timers, timesheets |
| team-permissions | access-control | Roles, permissions, inheritance, policies |
| notifications | messaging | Email, in-app, push, templates |
| reporting | analytics | Dashboards, time reports, progress tracking, exports |

## 7.2 E-Commerce Store (6 domains)

| Domain | Area | Key Concepts |
|---|---|---|
| authentication | identity | Registration, login, password reset, OAuth |
| products | catalog | Product CRUD, categories, search, variants |
| cart | commerce | Cart management, item operations, price calculation |
| checkout | commerce | Orders, payments, discounts, tax, refunds |
| inventory | operations | Stock tracking, availability, warehouse management |
| notifications | messaging | Order confirmations, shipping updates, marketing |

## 7.3 Developer API Platform (5 domains)

| Domain | Area | Key Concepts |
|---|---|---|
| authentication | identity | API key auth, OAuth client credentials, JWT |
| api-keys | access-control | Key generation, rotation, scoping, revocation |
| rate-limiting | infrastructure | Rate policies, throttling, quota management |
| endpoints | core | API route registration, versioning, documentation |
| webhooks | integration | Webhook registration, delivery, retry, signing |

Each example includes complete SKILL.md files per domain, domainkit-* metadata, references/contract.yaml for domains with complex models, and references/decisions.md for architecture decisions.

---

# 8. Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Runtime | TypeScript / Node.js | Target audience ecosystem |
| CLI Framework | Commander.js + Inquirer.js | Commands + interactive prompts |
| YAML Parser | js-yaml | Parse SKILL.md frontmatter + contract.yaml |
| File Matching | fast-glob / minimatch | Glob pattern matching for code paths |
| AST Parsing | ts-morph | TypeScript analysis for drift + generation |
| Text Matching | natural (TF-IDF) | Task → domain keyword matching |
| Schema Validation | ajv | JSON Schema for contract.yaml validation |
| Token Counting | gpt-tokenizer | Context budget management |
| Templates | Handlebars | Output format rendering |
| MCP Server | @modelcontextprotocol/sdk | Real-time context serving |
| Testing | Vitest | Unit + integration tests |
| Build | tsup | ESM/CJS bundling |
| Terminal UI | chalk + ora | Colors + progress spinners |

---

# 9. Build Plan

## Phase 1: Convention + Scaffolding (Week 1-2)

**Deliverables:**
- `domainkit init` — detect skills dir, create config
- `domainkit add <n>` — create domain skill interactively
- `domainkit list` — scan and display all domain skills
- `domainkit validate` — check format compliance
- Three complete example projects
- JSON schemas for contract.yaml
- Documentation: principles, getting-started, domain-authoring guide

## Phase 2: Context Assembly + Sync (Week 2-4)

**Deliverables:**
- `domainkit context "<task>"` — interactive matching + assembly
- TF-IDF matching engine
- Dependency graph resolution
- Token budget management
- Output formats: CLAUDE.md, system prompt XML, plain markdown
- `domainkit sync --target <agent>` — multi-agent distribution

## Phase 3: Drift Detection + MCP Server (Week 4-6)

**Deliverables:**
- `domainkit drift` — staleness, file coverage, API route diff (Express + Next.js)
- Drift reports: terminal, markdown, JSON
- Basic MCP server: list_domains, get_context, get_skill, check_drift tools

## Phase 4: Code Generation + Advanced Drift (Week 6-8)

**Deliverables:**
- `domainkit generate --scan` — module discovery from codebase
- `domainkit generate --bootstrap` — SKILL.md draft generation
- TypeScript type extraction (simple interfaces)
- Route extraction (Express, Next.js)
- Model schema drift detection (basic interfaces)

## Phase 5: Polish + Launch (Week 8-10)

**Deliverables:**
- Comprehensive README
- npm publish with provenance
- GitHub Actions CI (lint, test, build, publish)
- SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md
- Issue templates
- Changelog, semantic versioning

---

# 10. Project Structure

```
domainkit/
├── src/
│   ├── cli/
│   │   ├── index.ts                 # Entry point + commander setup
│   │   ├── init.ts                  # domainkit init
│   │   ├── add.ts                   # domainkit add
│   │   ├── list.ts                  # domainkit list
│   │   ├── context.ts               # domainkit context
│   │   ├── drift.ts                 # domainkit drift
│   │   ├── generate.ts              # domainkit generate
│   │   ├── validate.ts              # domainkit validate
│   │   ├── sync.ts                  # domainkit sync
│   │   └── serve.ts                 # domainkit serve (MCP)
│   ├── core/
│   │   ├── skill-reader.ts          # Read + parse SKILL.md files
│   │   ├── manifest.ts              # Generate manifest from skills
│   │   ├── matcher.ts               # Task → domain matching
│   │   ├── assembler.ts             # Context assembly engine
│   │   ├── dependency-graph.ts      # Dependency resolution
│   │   ├── token-counter.ts         # Token budget management
│   │   └── config.ts                # Configuration management
│   ├── drift/
│   │   ├── staleness.ts             # Age-based staleness checks
│   │   ├── file-coverage.ts         # Code path coverage analysis
│   │   ├── api-routes.ts            # Route extraction + comparison
│   │   ├── model-diff.ts            # Type/interface comparison
│   │   └── reporter.ts              # Drift report generation
│   ├── generate/
│   │   ├── module-scanner.ts        # Codebase module discovery
│   │   ├── type-extractor.ts        # TypeScript type extraction
│   │   ├── route-extractor.ts       # API route extraction
│   │   └── skill-writer.ts          # SKILL.md generation
│   ├── formats/
│   │   ├── claude.ts                # CLAUDE.md output
│   │   ├── system-prompt.ts         # XML system prompt output
│   │   ├── markdown.ts              # Plain markdown output
│   │   └── templates/               # Handlebars templates
│   ├── schemas/
│   │   ├── contract.schema.json     # JSON Schema for contract.yaml
│   │   └── config.schema.json       # JSON Schema for config.yaml
│   └── utils/
│       ├── logger.ts
│       ├── fs.ts
│       └── yaml.ts
├── templates/                       # Scaffolding templates
│   ├── config.yaml.hbs
│   ├── skill.md.hbs
│   └── contract.yaml.hbs
├── examples/
│   ├── project-management/
│   ├── ecommerce/
│   └── api-platform/
├── docs/
│   ├── getting-started.md
│   ├── principles.md
│   ├── domain-authoring.md
│   ├── greenfield-guide.md
│   ├── brownfield-guide.md
│   ├── drift-detection.md
│   ├── context-assembly.md
│   ├── mcp-server.md
│   └── cli-reference.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── LICENSE
└── CHANGELOG.md
```

---

*DomainKit makes Agent Skills work for product domain knowledge. It doesn't replace Agent Skills — it makes them dramatically more effective by adding the management, intelligence, and drift detection layer that the standard intentionally leaves to tooling. Every skill DomainKit creates is a valid Agent Skill. Every Agent Skill can be managed by DomainKit.*
