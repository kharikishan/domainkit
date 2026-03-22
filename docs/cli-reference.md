# CLI Reference

DomainKit provides two CLI executables: `domainkit` and `dk` (alias). All commands work identically with either.

## Global Options

```
dk --version    Show version number
dk --help       Show help
dk <cmd> --help Show help for a specific command
```

---

## dk init

Initialize a DomainKit project in the current directory.

### Usage

```bash
dk init [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--platform <platform>` | Target agent platform: `claude`, `codex`, `vscode`, `cursor`, `generic` | Interactive prompt |
| `--source-root <path>` | Path to source code directory | `src` |
| `--skills-dir <path>` | Path to skills directory | Auto-detected or `skills` |

### What It Creates

```
.domainkit/
  config.yaml       # Project configuration
skills/             # Skills directory (if it doesn't exist)
```

### Examples

```bash
# Interactive mode
dk init

# Non-interactive
dk init --platform claude --source-root src --skills-dir skills

# For a Cursor project
dk init --platform cursor --source-root app

# Auto-detect existing skills directory
dk init --platform generic
```

### Auto-Detection

If `--skills-dir` is not specified, DomainKit checks these locations in order:
1. `.claude/skills` (Claude Code/Desktop)
2. `.agents/skills` (Codex)
3. `.github/skills` (GitHub)
4. `.cursor/skills` (Cursor)
5. `.skills` (fallback)
6. `skills` (default)

---

## dk add

Scaffold a new domain skill.

### Usage

```bash
dk add <name> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `name` | Skill name (lowercase, hyphens allowed) |

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--description <text>` | One-line skill description | Interactive prompt |
| `--domain <name>` | Domain grouping | Same as skill name |
| `--deps <list>` | Comma-separated dependency names | None |
| `--code-paths <globs>` | Comma-separated glob patterns for source files | None |
| `--contract` | Also generate `references/contract.yaml` | `false` |

### What It Creates

```
skills/<name>/
  SKILL.md                    # Skill template
  references/                 # (only with --contract)
    contract.yaml             # Contract template
```

### Examples

```bash
# Minimal
dk add payments

# Full specification
dk add payments \
  --domain payments \
  --description "Stripe payment processing and refunds" \
  --deps orders \
  --code-paths "src/modules/payments/**" \
  --contract

# Multiple dependencies
dk add checkout \
  --deps "cart,catalog,payments,inventory"
```

---

## dk list

Display all skills in a formatted table.

### Usage

```bash
dk list [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--domain <name>` | Filter by domain | All domains |
| `--json` | Output as JSON | Table format |

### Examples

```bash
# Table view
dk list

# Filter by domain
dk list --domain payments

# JSON output (for scripting)
dk list --json

# Pipe to jq
dk list --json | jq '.[] | select(.domain == "auth")'
```

### Table Output

```
┌────────────┬──────────┬─────────────────────────────────────┬──────────┬──────────────┐
│ Name       │ Domain   │ Description                         │ Deps     │ Last Verified│
├────────────┼──────────┼─────────────────────────────────────┼──────────┼──────────────┤
│ catalog    │ catalog  │ Product and category management     │ 0        │ 2026-03-15   │
│ cart       │ cart     │ Shopping cart with price locking     │ 1        │ 2026-03-15   │
│ checkout   │ checkout │ Cart-to-order conversion            │ 4        │ 2026-03-10   │
│ orders     │ orders   │ Order lifecycle and returns          │ 1        │ 2026-03-15   │
│ payments   │ payments │ Stripe payment processing           │ 1        │ 2026-03-15   │
│ inventory  │ inventory│ Stock tracking and alerts            │ 1        │ 2026-03-12   │
└────────────┴──────────┴─────────────────────────────────────┴──────────┴──────────────┘
```

---

## dk validate

Validate skill metadata, contracts, and references.

### Usage

```bash
dk validate [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--skill <name>` | Validate a specific skill only | All skills |
| `--strict` | Exit with non-zero code on warnings | Errors only |

### What It Checks

| Check | Severity |
|-------|----------|
| Required frontmatter fields (name, description) present | Error |
| `domainkit-dependencies` reference existing skills | Error |
| `contract.yaml` matches JSON schema | Error |
| `domainkit-code-paths` match at least one file | Warning |
| `domainkit-last-verified` is a valid date | Warning |
| Skill body has recommended sections | Info |

### Examples

```bash
# Validate all
dk validate

# Validate one skill
dk validate --skill payments

# Strict mode (for CI)
dk validate --strict
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All valid (or warnings only in non-strict mode) |
| 1 | Validation errors found |

---

## dk context

Assemble domain context for a task or set of domains.

### Usage

```bash
dk context [task] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `task` | Natural language task description (triggers auto-matching) |

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --domains <list>` | Comma-separated domain names | Auto-matched from task |
| `-f, --format <format>` | Output format: `claude`, `system-prompt`, `markdown` | `claude` |
| `-o, --output <path>` | Write to file instead of stdout | stdout |
| `-b, --budget <tokens>` | Token budget | `8000` |
| `--depth <depth>` | Context depth: `index`, `contract`, `full` | `contract` |

### How It Works

1. If a `task` is provided, DomainKit matches it against all skills using TF-IDF (or keyword overlap as fallback)
2. Selected skills are loaded at the specified `depth`
3. Transitive dependencies are resolved and included at `index` depth
4. Content is rendered in the specified `format`
5. If over budget, lower-priority dependencies are dropped

### Output Formats

**claude** — CLAUDE.md-style markdown with domain index table, full primary skill bodies, and dependency summaries.

**system-prompt** — Compact format optimized for system prompt injection. Minimal formatting, maximum information density.

**markdown** — Standard GitHub-flavored markdown.

### Examples

```bash
# Auto-match task to domains
dk context "fix the payment retry bug"

# Explicit domains
dk context --domains payments,orders

# Full depth, high budget
dk context --domains checkout --depth full --budget 12000

# Compact format for system prompt
dk context "add user search" --format system-prompt

# Write to file
dk context --domains auth --format claude -o context.md

# Pipe to clipboard (macOS)
dk context "fix login flow" | pbcopy
```

---

## dk drift

Check skills for codebase drift.

### Usage

```bash
dk drift [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --skill <name>` | Check a specific skill only | All skills |
| `-r, --report <format>` | Report format: `terminal`, `md`, `json` | `terminal` |
| `--threshold <days>` | Staleness threshold in days | `30` |

### Drift Strategies

| Strategy | What It Checks | Severity |
|----------|---------------|----------|
| **staleness** | `domainkit-last-verified` age vs threshold | error (>2x threshold), warning |
| **file-coverage** | `domainkit-code-paths` globs match existing files | warning (missing), info (new) |
| **api-routes** | Extracted routes vs contract routes | warning (optional, requires ts-morph) |
| **model-diff** | TypeScript types vs contract models | warning (optional, requires ts-morph) |

### Scoring

Each issue has a score penalty:
- **Error**: -30 points
- **Warning**: -15 points
- **Info**: -5 points

Final score = max(0, 100 - total penalties)

| Score | Status | Meaning |
|-------|--------|---------|
| >= 80 | **fresh** | Skill is up to date |
| 50-79 | **stale** | Skill needs review |
| < 50 | **drifted** | Skill needs immediate update |

### Examples

```bash
# Check all skills
dk drift

# Check one skill
dk drift --skill payments

# Custom staleness threshold
dk drift --threshold 14

# Markdown report (for documentation)
dk drift --report md > drift-report.md

# JSON report (for CI)
dk drift --report json

# CI integration (fail if any skill is drifted)
dk drift --report json --threshold 30
```

---

## dk sync

Copy skills to agent platform directories.

### Usage

```bash
dk sync [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --target <platform>` | Target platform: `claude`, `codex`, `vscode`, `cursor`, `github` | From config |
| `-a, --all` | Sync to all configured targets | `false` |
| `--dry-run` | Preview without writing files | `false` |
| `--clean` | Remove existing skills in target before syncing | `false` |

### Target Directories

| Platform | Directory |
|----------|-----------|
| claude | `.claude/skills/` |
| codex | `.agents/skills/` |
| vscode | `.vscode/skills/` |
| cursor | `.cursor/skills/` |
| github | `.github/skills/` |

### Examples

```bash
# Sync to Claude
dk sync --target claude

# Sync to all configured platforms
dk sync --all

# Preview first
dk sync --all --dry-run

# Clean sync (remove old, copy new)
dk sync --target claude --clean
```

---

## dk generate

Auto-scaffold skills from existing source code.

### Usage

```bash
dk generate [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--scan` | Discover modules without generating files | `false` |
| `--bootstrap` | Generate skill drafts from discovered modules | `false` |
| `-m, --modules <list>` | Comma-separated module names to generate | All discovered |
| `--with-contracts` | Also generate `contract.yaml` files | `false` |
| `--dry-run` | Preview without writing files | `false` |

### Requirements

- **ts-morph** must be installed for TypeScript analysis: `pnpm add -D ts-morph`

### What It Extracts

| Source | Extracted Into |
|--------|---------------|
| TypeScript interfaces and types | Data Models section + contract models |
| Express/Next.js route definitions | API Surface section + contract routes |
| Import statements | Dependency suggestions |
| Directory structure | Domain grouping |

### Examples

```bash
# Step 1: Scan to see what's available
dk generate --scan

# Step 2: Preview generation
dk generate --bootstrap --dry-run

# Step 3: Generate everything
dk generate --bootstrap --with-contracts

# Generate specific modules only
dk generate --bootstrap --modules auth,billing --with-contracts
```

---

## dk serve

Start the MCP (Model Context Protocol) server.

### Usage

```bash
dk serve [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port <number>` | Port for SSE transport | `3000` |
| `--transport <type>` | Transport protocol: `stdio`, `sse` | `stdio` |

### Requirements

- **@modelcontextprotocol/sdk** must be installed: `pnpm add @modelcontextprotocol/sdk`

### MCP Tools Exposed

| Tool | Input | Description |
|------|-------|-------------|
| `list_domains` | — | List all domains with their skills |
| `get_context` | `task` or `domains`, `budget`, `format` | Assemble context on-demand |
| `get_skill` | `name`, `depth` | Fetch individual skill content |
| `check_drift` | `skill` (optional) | Run drift detection |
| `get_dependencies` | `skill` | Resolve transitive dependency graph |

### Examples

```bash
# stdio transport (for Claude Desktop)
dk serve --transport stdio

# SSE transport (for web clients)
dk serve --transport sse --port 8080
```

### Claude Desktop Integration

Add to your Claude Desktop `config.json`:

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

### Cursor Integration

Add to your Cursor MCP settings:

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
