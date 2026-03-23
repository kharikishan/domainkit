# DomainKit

**CLI and MCP server for managing domain-focused Agent Skills**

DomainKit helps development teams package product domain knowledge as structured [Agent Skills](https://agentskills.io) and then manage, assemble, validate, and keep those skills synchronized with the codebase as it evolves.

## The Problem

AI coding agents are powerful, but they struggle with **domain context**. Teams typically dump entire specs or monolithic rules files into the agent's context window. The result:

- **Context pollution** — agents reason over irrelevant information, burning tokens and producing diluted output
- **Staleness and drift** — documentation diverges from code within days, leading agents to build on abandoned patterns
- **No progressive disclosure** — agents can't skim headers and drill into what matters; every section has equal weight
- **Coordination failures** — parallel agent sessions interpret prose differently, producing inconsistent code

## How DomainKit Solves This

DomainKit packages each product domain as its own Agent Skill and provides tooling to:

| Capability | What It Does |
|------------|-------------|
| **Context Assembly** | Assemble only the relevant domains — at the right depth — for each task |
| **Drift Detection** | Detect when skills have diverged from the actual codebase |
| **Code Generation** | Auto-scaffold skills from existing TypeScript codebases |
| **Dependency Resolution** | Resolve transitive dependencies between domains |
| **Token Budgeting** | Stay within token limits with three-tier progressive disclosure |
| **Universal Sync** | Sync skills to 26+ platforms via the Agent Skills standard — one format, every platform |
| **MCP Server** | Serve domain context to agents in real-time |
| **Persona-Based Generation** | Generate skills from developer or domain-expert perspectives |
| **Smart Recommendations** | Recommend relevant skills based on git diff analysis |


```
+--------------------------------------------------+
|         DomainKit (management layer · 14 commands)        |
|                                                   |
|   Manifest    Context     Drift      Code         |
|   Generation  Assembly    Detection  Generation   |
|                                                   |
|   Persona     Recommend   Multi-Agent   MCP       |
|   Engine      Engine      Sync          Server    |
|                                                   |
|   Watch       Import      Dependency  Token       |
|   Mode        Pipeline    Resolution  Budgets     |
+---------------------------------------------------+
|          Agent Skills Standard (foundation)        |
|                                                    |
|   SKILL.md  |  scripts/  |  references/  | assets  |
|   26+ platforms  |  Progressive disclosure          |
+----------------------------------------------------+
```

**No lock-in.** Every skill DomainKit creates is a valid Agent Skill. Every Agent Skill can be managed by DomainKit. No new format, no ecosystem fragmentation.

## Quick Start

### Installation

#### Prerequisites

- **Node.js >= 18** — [Download](https://nodejs.org)
- **Git** — [Download](https://git-scm.com)
- **pnpm** — installed automatically by the setup script if missing

#### macOS / Linux

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
./setup.sh
```

Restart your terminal (or `source ~/.zshrc` / `source ~/.bashrc`), then verify:

```bash
dk --help
```

#### Windows (PowerShell)

```powershell
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
powershell -ExecutionPolicy Bypass -File setup.ps1
```

Close and re-open your terminal, then verify:

```powershell
dk --help
```

#### Windows (Git Bash)

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
./setup.sh
```

Close and re-open Git Bash, then verify:

```bash
dk --help
```

#### Manual Setup (Any Platform)

If you prefer to run each step yourself:

```bash
git clone https://github.com/kharikishan/domainkit.git
cd domainkit
pnpm install        # install dependencies
pnpm run build      # compile TypeScript
pnpm link --global  # make 'dk' available globally
```

> If `pnpm link --global` fails, run `pnpm setup` first, restart your terminal, then retry.

#### Update

```bash
cd domainkit
git pull
pnpm run build
```

#### Uninstall

```bash
pnpm unlink --global domainkit
```

### For a New Project (Greenfield)

```bash
# 1. Initialize DomainKit in your project
dk init --platform claude --source-root src

# 2. Add domain skills
dk add payments --domain payments --description "Stripe payment processing" --persona developer
dk add orders --domain orders --deps payments --description "Order lifecycle management"

# 3. Fill in the generated SKILL.md files with your domain knowledge

# 4. Validate your skills
dk validate --strict

# 5. Sync to your agent platform
dk sync --all
```

### For an Existing Project (Brownfield)

```bash
# 1. Initialize DomainKit
dk init --platform claude --source-root src

# 2. Scan your codebase and auto-generate skill drafts
dk generate --scan
dk generate --bootstrap --with-contracts --persona domain-expert

# 3. See which skills are affected by recent changes
dk recommend

# 4. Review and enrich generated skills with business rules and gotchas

# 5. Check drift baseline
dk drift

# 6. Sync to your agent platform
dk sync --all
```

### Assemble Context for a Task

```bash
# Let DomainKit pick the right domains
dk context "fix the payment retry bug" --format claude

# Or specify domains manually
dk context --domains payments,orders --format system-prompt --budget 4000
```

### Start MCP Server

```bash
# For Claude Desktop or any MCP-compatible client
dk serve --transport stdio
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, first skill, and core concepts |
| [Greenfield Guide](docs/greenfield-guide.md) | Using DomainKit for new projects |
| [Brownfield Guide](docs/brownfield-guide.md) | Adopting DomainKit in existing codebases |
| [Skill Authoring Guide](docs/skill-authoring.md) | Writing effective domain skills |
| [CLI Reference](docs/cli-reference.md) | Complete command reference |
| [MCP Integration](docs/mcp-integration.md) | Setting up the MCP server |

## Examples

The `examples/` directory contains two complete reference projects:

- **[E-Commerce Platform](examples/ecommerce/)** — 6 domains: catalog, cart, checkout, orders, payments, inventory
- **[Project Management Tool](examples/project-management/)** — 8 domains: tasks, projects, sprints, time-tracking, notifications, reporting, permissions, integrations

## How It Works

### Skill Structure

Every domain skill is a folder containing a `SKILL.md` file with optional references:

```
skills/
  payments/
    SKILL.md              # Domain knowledge in markdown with YAML frontmatter
    references/
      contract.yaml       # Machine-parseable interface (models, routes, events)
```

### Progressive Disclosure (Three Tiers)

| Tier | What Loads | Token Cost | When Used |
|------|-----------|------------|-----------|
| **Index** | Name + one-line description | ~30-50 tokens | Background context for unrelated domains |
| **Contract** | Data models, API surface, business rules | ~200-500 tokens | Domains the agent needs to understand |
| **Full** | Complete skill body with all sections | ~500-2000 tokens | The domain the agent is actively working in |

A typical task loads 2-3 domains at contract level and the rest at index level. Total: ~1,200 tokens vs ~20,000 for a full spec dump — a **15x efficiency gain**.

### Token Budgeting

The context assembler respects a configurable token budget (default: 8,000 tokens):

1. Primary skills load at the requested depth
2. Transitive dependencies load at index depth
3. Lower-priority dependencies are dropped if the budget is exceeded

### Drift Detection

DomainKit detects when skills diverge from code through four strategies:

| Strategy | What It Checks |
|----------|---------------|
| **Staleness** | Is `domainkit-last-verified` older than the threshold? |
| **File Coverage** | Do `domainkit-code-paths` globs still match files? |
| **Route Extraction** | Have API routes changed since last verified? (fully integrated) |
| **Model Diff** | Do TypeScript types match contract models? (fully integrated) |

Each skill gets a drift score (0-100): **fresh** (>=80), **stale** (50-80), **drifted** (<50).

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run dev

# Run tests
pnpm run test

# Lint
pnpm run lint

# Type check
pnpm run typecheck
```

## Programmatic API

DomainKit can be used as a library:

```typescript
import {
  loadConfig,
  readAllSkills,
  buildManifest,
  assembleContext,
  // New in v0.2
  listPersonas,
  getPersona,
  recommendFromDiff,
} from 'domainkit';

// Load config and skills
const config = await loadConfig('.domainkit/config.yaml');
const skills = await readAllSkills(config.skillsDir);
const manifest = buildManifest(skills);

// Assemble context for a task
const context = await assembleContext({
  skills,
  domains: ['payments', 'orders'],
  depth: 'contract',
  budget: 4000,
});

// Recommend skills affected by recent changes
const recommendations = await recommendFromDiff({ skills, cwd: '.' });

```

## Requirements

- Node.js >= 18
- pnpm (recommended) or npm

### Optional Dependencies

| Package | Enables |
|---------|---------|
| `ts-morph` | Auto-generating skills from TypeScript code (`dk generate`) |
| `natural` | TF-IDF task-to-domain matching (falls back to keyword overlap) |
| `@modelcontextprotocol/sdk` | MCP server (`dk serve`) |

## License

MIT
