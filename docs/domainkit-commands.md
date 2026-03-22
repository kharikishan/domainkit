# DomainKit CLI Commands

DomainKit CLI (`dk` / `domainkit`) provides 9 commands for managing domain-focused Agent Skills.

---

## dk init

Initialize a DomainKit project in the current directory.

```bash
dk init [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--non-interactive` | boolean | `false` | Skip prompts, use flag values |
| `--platform <platform>` | string | `generic` | AI platform: `claude`, `codex`, `vscode`, `cursor`, `generic` |
| `--source-root <path>` | string | `src` | Source root directory |
| `--skills-dir <path>` | string | — | Skills directory path |

Creates `.domainkit/config.yaml` and the skills directory. In interactive mode, prompts for configuration and auto-detects existing skills directories.

```bash
dk init --platform claude --source-root src
```

---

## dk add

Add a new skill to the project.

```bash
dk add <name> [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--non-interactive` | boolean | `false` | Skip prompts |
| `--description <text>` | string | — | Short description |
| `--domain <domain>` | string | — | Domain name (e.g., `auth`, `payments`) |
| `--deps <list>` | string | — | Comma-separated dependency skill names |
| `--code-paths <list>` | string | — | Comma-separated code paths |
| `--contract` | boolean | `false` | Also scaffold a `contract.yaml` |

Creates a skill directory with `SKILL.md` (frontmatter + body). Sets `domainkit-last-verified` to today's date.

```bash
dk add payments --domain billing --description "Stripe payment processing" --contract
```

---

## dk list

List all skills in the project.

```bash
dk list [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output as JSON |
| `--domain <domain>` | string | — | Filter by domain (case-insensitive) |

Displays a table with columns: Name, Domain, Description, Dependencies, Last Verified.

```bash
dk list --domain payments
dk list --json
```

---

## dk validate

Validate skill files for correctness and completeness.

```bash
dk validate [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--skill <name>` | string | — | Validate a single skill |
| `--strict` | boolean | `false` | Treat warnings as errors |

**Checks performed:**
- **Errors:** Missing required fields (`name`, `description`)
- **Warnings:** Missing recommended fields (`domainkit-domain`, `domainkit-last-verified`, `domainkit-version`), empty body

Exits with code 1 if errors exist, or if `--strict` and warnings exist.

```bash
dk validate --strict
dk validate --skill payments
```

---

## dk context

Assemble domain context for a task.

```bash
dk context [task] [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-d, --domains <domains...>` | array | — | Specify domains directly |
| `-f, --format <format>` | string | `claude` | Output format: `claude`, `system-prompt`, `markdown` |
| `-o, --output <file>` | string | — | Write output to file |
| `-b, --budget <tokens>` | string | `8000` | Token budget for context |
| `--auto` | boolean | `false` | Skip confirmation prompts |
| `--depth <depth>` | string | `contract` | Depth: `index`, `contract`, `full` |
| `--clipboard` | boolean | `false` | Copy to clipboard (macOS) |

Matches a task description to domains using TF-IDF (or keyword fallback), assembles context within the token budget, and renders in the specified format.

```bash
dk context "add refund support" --format claude --budget 4000
dk context --domains payments orders --depth full --output context.md
```

---

## dk sync

Sync skills to agent platform directories.

```bash
dk sync [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t, --target <targets...>` | array | — | Platforms: `claude`, `codex`, `vscode`, `cursor` |
| `-a, --all` | boolean | `false` | Sync to all platforms |
| `--dry-run` | boolean | `false` | Preview without writing |
| `--clean` | boolean | `false` | Remove target dirs before syncing |

**Platform directory mapping:**

| Platform | Target Directory |
|----------|-----------------|
| `claude` | `.claude/skills` |
| `codex` | `.agents/skills` |
| `vscode` | `.github/skills` |
| `cursor` | `.cursor/skills` |

```bash
dk sync --all
dk sync --target claude cursor --clean
dk sync --dry-run
```

---

## dk drift

Check skills for drift from the codebase.

```bash
dk drift [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-s, --skill <name>` | string | — | Check a specific skill |
| `-r, --report <format>` | string | `terminal` | Report format: `terminal`, `md`, `json` |
| `-o, --output <file>` | string | — | Write report to file |
| `--threshold <days>` | string | `30` | Staleness threshold in days |

Detects staleness (old `domainkit-last-verified` dates), file coverage mismatches (`domainkit-code-paths`), and route mismatches. Exits with code 1 if drift is detected.

```bash
dk drift --threshold 14
dk drift --skill payments --report json --output drift-report.json
```

---

## dk generate

Generate skill drafts from codebase analysis.

```bash
dk generate [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scan` | boolean | `false` | Scan and list discovered modules |
| `--bootstrap` | boolean | `false` | Generate draft skills for discovered modules |
| `-m, --modules <modules...>` | array | — | Specific modules to generate for |
| `--auto` | boolean | `false` | Skip confirmation prompts |
| `--with-contracts` | boolean | `false` | Also generate `contract.yaml` files |
| `--dry-run` | boolean | `false` | Preview without writing |

**Smart Scanner:** Automatically detects project type, language, and discovers module boundaries using heuristics.

**Supported languages:** TypeScript, JavaScript, Python, Java

**Supported project types:**
- JS/TS: monorepo, Next.js, NestJS, Express/Fastify/Hono/Koa, library
- Python: Django, FastAPI, Flask
- Java: Spring Boot, Maven, Gradle

**Spec-Kit integration:** Detects `.specify/` directory (GitHub's [spec-kit](https://github.com/github/spec-kit)) and reports constitution, feature specs, and tasks.

```bash
dk generate --scan                    # discover modules
dk generate --bootstrap               # generate skill drafts
dk generate --bootstrap --modules payments orders --with-contracts
dk generate --dry-run
```

---

## dk serve

Start the DomainKit MCP server.

```bash
dk serve [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-p, --port <port>` | string | — | Port for SSE transport |
| `--transport <type>` | string | `stdio` | Transport: `stdio`, `sse` |

Exposes skills as MCP tools for integration with Claude Desktop, Cursor, or other MCP-compatible clients. Available tools: `list_domains`, `get_context`, `get_skill`, `check_drift`, `get_dependencies`.

```bash
dk serve                              # stdio transport (default)
dk serve --transport sse --port 3001  # SSE transport
```
