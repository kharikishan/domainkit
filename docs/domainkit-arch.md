# DomainKit Architecture

## Overview

DomainKit is a CLI tool and library for managing **domain-focused Agent Skills** — structured knowledge documents that give AI coding agents deep understanding of specific domains in a codebase. It bridges the gap between raw source code and the contextual knowledge agents need.

Key capabilities:
- **Skill authoring** — structured SKILL.md files with metadata frontmatter and optional contract.yaml
- **Context assembly** — match tasks to domains, assemble context within token budgets
- **Code generation** — smart codebase scanning to auto-generate skill drafts
- **Drift detection** — detect when skills become stale relative to the codebase
- **Platform sync** — sync skills to Claude, Cursor, VS Code, Codex agent directories
- **MCP server** — expose skills as Model Context Protocol tools

---

## Project Structure

```
src/
├── cli/                          # Commander.js CLI
│   ├── commands/                 # 9 command implementations
│   │   ├── init.ts               # dk init
│   │   ├── add.ts                # dk add <name>
│   │   ├── list.ts               # dk list
│   │   ├── validate.ts           # dk validate
│   │   ├── context.ts            # dk context [task]
│   │   ├── sync.ts               # dk sync
│   │   ├── drift.ts              # dk drift
│   │   ├── generate.ts           # dk generate
│   │   └── serve.ts              # dk serve
│   ├── ui/                       # Terminal UI helpers
│   │   ├── prompts.ts            # Interactive prompts (inquirer)
│   │   ├── spinner.ts            # Loading spinners (ora)
│   │   └── table.ts              # Table rendering (cli-table3)
│   └── index.ts                  # Program setup, command registration
│
├── core/                         # Core domain logic
│   ├── types.ts                  # TypeScript interfaces (Skill, Contract, Manifest, etc.)
│   ├── config.ts                 # Load/save .domainkit/config.yaml
│   ├── skill-reader.ts           # Parse SKILL.md frontmatter + read contracts
│   ├── manifest.ts               # Build aggregated skill manifest by domain
│   ├── validator.ts              # Validate skills (required fields, dates, sections)
│   ├── dependency-graph.ts       # Build & traverse skill dependency DAG
│   ├── assembler.ts              # Assemble context (token budgeting, depth control)
│   ├── matcher.ts                # Match task text → domains (TF-IDF or keyword fallback)
│   └── token-counter.ts          # Token estimation (gpt-tokenizer)
│
├── generate/                     # Codebase → skill generation
│   ├── module-scanner.ts         # Orchestrator: multi-phase module discovery
│   ├── scanner/                  # Smart scanner pipeline
│   │   ├── project-classifier.ts # Phase 1: detect project type, language, spec-kit
│   │   ├── structure-analyzer.ts # Phase 3: language-aware heuristic module detection
│   │   └── import-analyzer.ts    # Phase 4: optional ts-morph import cohesion
│   ├── skill-writer.ts           # Generate SKILL.md from templates
│   ├── type-extractor.ts         # Extract TS types/interfaces (ts-morph)
│   ├── route-extractor.ts        # Extract Express/Next.js routes (ts-morph)
│   └── index.ts                  # Barrel exports
│
├── drift/                        # Drift detection
│   ├── staleness.ts              # Check domainkit-last-verified dates
│   ├── file-coverage.ts          # Check domainkit-code-paths against actual files
│   ├── api-routes.ts             # Extract and compare API routes (ts-morph)
│   ├── model-diff.ts             # (Placeholder for future model diffing)
│   ├── reporter.ts               # Format drift results (terminal, md, json)
│   └── index.ts                  # Barrel exports
│
├── formats/                      # Context output renderers
│   ├── claude.ts                 # CLAUDE.md format (domain index table + full skills)
│   ├── system-prompt.ts          # Compact system prompt format
│   ├── markdown.ts               # Standard markdown
│   └── index.ts                  # Format dispatcher
│
├── mcp/                          # Model Context Protocol server
│   ├── server.ts                 # MCP server setup (lazy-loads SDK)
│   └── tools/                    # 5 MCP tools
│       ├── list-domains.ts       # list_domains
│       ├── get-context.ts        # get_context
│       ├── get-skill.ts          # get_skill
│       ├── check-drift.ts        # check_drift
│       └── get-dependencies.ts   # get_dependencies
│
├── utils/                        # Shared utilities
│   ├── fs.ts                     # File/dir existence, read/write, ensureDir
│   ├── logger.ts                 # Colored console output (chalk)
│   ├── template.ts               # Handlebars template rendering
│   ├── yaml.ts                   # YAML/frontmatter parsing (js-yaml, gray-matter)
│   └── optional-import.ts        # Lazy require with install guidance
│
├── schemas/                      # JSON schemas
│   └── contract.schema.json      # contract.yaml validation schema (AJV)
│
└── index.ts                      # Public API exports
```

---

## Core Modules

### Config (`core/config.ts`)

Loads project configuration from `.domainkit/config.yaml`:

```yaml
version: "1"
skillsDir: ".skills"
sourceRoot: "src"
platform: "claude"      # claude | codex | vscode | cursor | generic
sync:
  targets: [claude, cursor]
drift:
  threshold: 30         # days
  strategies: [staleness, file-coverage]
context:
  defaultBudget: 8000
  defaultFormat: claude
  defaultDepth: contract
```

### Skill Reader (`core/skill-reader.ts`)

Parses SKILL.md files with YAML frontmatter:

```yaml
---
name: payments
description: Stripe payment processing
domainkit-domain: billing
domainkit-version: "1"
domainkit-last-verified: 2026-03-22
domainkit-dependencies: [orders, logging]
domainkit-code-paths: [src/modules/payments/**]
domainkit-api-routes: [POST /api/payments, GET /api/payments/:id]
---
```

The body contains markdown sections: Data Models, Business Rules, API Surface, Gotchas, Testing Priorities.

### Manifest (`core/manifest.ts`)

Builds an aggregated index of all skills organized by domain. Used by `dk list`, context assembly, and the MCP server.

### Dependency Graph (`core/dependency-graph.ts`)

Builds a DAG from `domainkit-dependencies` fields. Supports transitive resolution and cycle detection.

### Assembler (`core/assembler.ts`)

Assembles context for a set of skills:
1. Resolve transitive dependencies
2. Separate primary skills from dependency skills
3. Allocate token budget — primaries first at requested depth, dependencies at `index` depth
4. Drop excess dependencies that don't fit the budget

### Matcher (`core/matcher.ts`)

Matches free-text task descriptions to domains. Uses TF-IDF (via `natural` package) when available, falls back to keyword matching.

---

## Smart Scanner Pipeline

The `generate/` module implements a multi-phase scanning pipeline that works across languages and frameworks.

### Project Classifier (`scanner/project-classifier.ts`)

Detects three things about the project:

**Language** — determined by root config files:

| Indicator | Language |
|-----------|----------|
| `tsconfig.json` | `typescript` |
| `package.json` (no tsconfig) | `javascript` |
| `pyproject.toml`, `requirements.txt`, `setup.py` | `python` |
| `pom.xml`, `build.gradle`, `build.gradle.kts` | `java` |
| Multiple of the above | `mixed` |

**Project Type** — detected via framework-specific markers:

| Type | Key Indicators |
|------|---------------|
| `monorepo` | `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `workspaces` in package.json |
| `nextjs` | `next.config.*`, `app/` or `pages/` directory |
| `nestjs` | `nest-cli.json`, `*.module.ts` files, `@nestjs/core` dep |
| `express` | `express`/`fastify`/`hono`/`koa` deps, `server.ts`, `routes/` dir |
| `django` | `manage.py`, `models.py`, `views.py`, `urls.py`, django dep |
| `fastapi` | `fastapi` dep, `routers/` or `api/` directory |
| `flask` | `flask` dep, `app.py` or `wsgi.py` entry point |
| `spring` | `*Application.java`, `application.properties/yml`, spring-boot deps |
| `maven` | `pom.xml`, `src/main/java` layout |
| `gradle` | `build.gradle`, `settings.gradle` |
| `library` | `src/index.ts`, package exports, no framework deps |
| `generic` | Fallback |

**Spec-Kit** — detects GitHub's [spec-kit](https://github.com/github/spec-kit) (`.specify/` directory):
- Checks for `constitution.md`
- Finds feature spec directories (`NNN-feature-name/` pattern)
- Reports findings in scan output

Also exports shared utilities used by all scanner files:
- `sourceFileGlob(language)` — returns the right glob pattern (`**/*.py`, `**/*.java`, etc.)
- `entryPointFiles(language)` — returns barrel export filenames (`__init__.py`, `index.ts`, etc.)

### Structure Analyzer (`scanner/structure-analyzer.ts`)

Dispatches to language/framework-specific strategies:

**Generic strategy** — walks directory tree up to `maxDepth`, scores each directory:

| Heuristic | Weight |
|-----------|--------|
| Base score (non-empty directory) | +0.15 |
| Barrel export (`index.ts`, `__init__.py`) | +0.25 |
| Convention file names (controller, service, model, views, serializers, dto, etc.) | +0.05 each, max +0.20 |
| 3+ source files | +0.10 |
| Own build config (`package.json`, `pyproject.toml`, `pom.xml`, `build.gradle`) | +0.25 |
| Depth 1-2 from scan root | +0.10 |
| Has subdirectories | +0.10 |
| Utility name penalty (`utils/`, `helpers/`, `shared/`, `common/`) | -0.15 |
| Single file penalty | -0.10 |

**Django strategy** — finds Django apps by detecting `models.py` + `views.py` + `apps.py` + `__init__.py` combinations.

**Python app strategy** (FastAPI/Flask) — scans `routers/`, `api/`, `modules/`, `services/` then falls back to generic.

**Java strategy** — scans `src/main/java` at deeper depth (up to 6), scores by controller/service/repository/entity file patterns.

**NestJS strategy** — finds `*.module.ts` files; each containing directory is a module.

**Next.js strategy** — `app/` route directories + `lib/`, `components/`, `hooks/`, `services/` modules.

### Import Analyzer (`scanner/import-analyzer.ts`)

Optional phase (TypeScript/JavaScript only, requires `ts-morph`). For each candidate module:
1. Parses source files (up to 50 per module)
2. Extracts relative import declarations
3. Computes **cohesion score** = intra-module imports / total imports
4. High cohesion (>50%) adds +0.15 to confidence

### Module Scanner (`module-scanner.ts`)

Orchestrates the full pipeline:
1. Classify project (type + language + spec-kit)
2. Convention scan (`modules/`, `features/`, `domains/`, `services/`)
3. Structure analysis (language-aware)
4. Import analysis (TS/JS only, optional)
5. Merge, deduplicate, filter by `minConfidence`, sort by confidence

Backward-compatible: accepts either `scanForModules(sourceRoot)` or `scanForModules(options)`.

---

## Key Data Flows

### Context Assembly

```
Task text → Matcher → Matched domains
                         ↓
                    Skill Reader → Skills
                         ↓
                  Dependency Graph → Transitive deps
                         ↓
                    Assembler → Token-budgeted context
                         ↓
                  Format Renderer → claude | system-prompt | markdown
```

### Code Generation (Smart Scanner)

```
Project root → Phase 1: Project Classifier + Language Detection + Spec-Kit Detection
                 ↓ (type: monorepo | nextjs | nestjs | express | django | flask | fastapi | spring | maven | gradle | library | generic)
                 ↓ (language: typescript | javascript | python | java | mixed)
               Phase 2: Convention Scan
                 ↓ (modules/ | features/ | domains/ | services/)
               Phase 3: Structure Analyzer (language-aware)
                 ↓ (heuristic scoring: barrel exports, file conventions, depth)
               Phase 4: Import Analyzer (optional, ts-morph, TS/JS only)
                 ↓ (cohesion scoring)
               Phase 5: Merge, filter, sort
                 ↓
               DiscoveredModule[] → Skill Writer → SKILL.md drafts
```

The smart scanner detects project type, language, and uses appropriate strategies:

**JavaScript/TypeScript:**
- **Monorepo**: each workspace package is a module
- **Next.js**: app router directories + lib/components modules
- **NestJS**: directories containing `*.module.ts` files
- **Express**: route/controller file groupings
- **Library/Generic**: heuristic scoring on all directories

**Python:**
- **Django**: detects apps via `models.py`, `views.py`, `apps.py`, `urls.py` markers
- **FastAPI**: scans `routers/`, `api/`, `modules/` directories
- **Flask**: entry point detection + generic Python module scanning

**Java:**
- **Spring Boot**: detects `*Application.java`, `application.properties/yml`, Spring deps
- **Maven/Gradle**: standard `src/main/java` layout, controller/service/repository patterns

**Spec-Kit Integration:**
- Detects `.specify/` directory (GitHub's spec-kit tool)
- Reports constitution, feature specs, and task counts
- Enriches scan output with specification context

### Drift Detection

```
Skills → Staleness check (last-verified vs threshold)
       → File coverage check (code-paths vs actual files)
       → Route mismatch check (api-routes vs extracted routes)
       → Reporter → terminal | md | json
```

---

## MCP Integration

The MCP server (`src/mcp/server.ts`) exposes 5 tools via stdio or SSE transport:

| Tool | Parameters | Returns |
|------|-----------|---------|
| `list_domains` | — | All domains with skill counts |
| `get_context` | `task?`, `domains?`, `budget?`, `format?` | Assembled context |
| `get_skill` | `name`, `depth?` | Skill content at index/contract/full depth |
| `check_drift` | `skill?` | Drift results for all or single skill |
| `get_dependencies` | `skill` | Direct and transitive dependencies |

The SDK (`@modelcontextprotocol/sdk`) is lazy-loaded — the MCP server only works when the package is installed.

---

## Build & Dependencies

**Build tool:** tsup — bundles to ESM + CJS, targeting Node 18+. Code splitting enabled for lazy-loaded modules.

**Entry points:**
- `dist/cli.js` — CLI with shebang (`#!/usr/bin/env node`)
- `dist/index.js` / `dist/index.cjs` — Library API
- `dist/index.d.ts` — TypeScript declarations

**Required dependencies:**
- `commander` — CLI framework
- `inquirer` — Interactive prompts
- `js-yaml` / `gray-matter` — YAML and frontmatter parsing
- `fast-glob` — File pattern matching
- `handlebars` — Template rendering
- `gpt-tokenizer` — Token estimation
- `ajv` — JSON schema validation
- `chalk` — Colored output
- `ora` — Spinners
- `cli-table3` — Table rendering

**Optional dependencies (graceful fallback):**
- `ts-morph` — TypeScript AST parsing (for type/route extraction, import analysis, drift detection)
- `natural` — NLP/TF-IDF (for intelligent task-to-domain matching)
- `@modelcontextprotocol/sdk` — MCP server implementation

**Test framework:** vitest (node environment, v8 coverage)

**Scripts:**
- `pnpm run build` — Compile via tsup
- `pnpm run dev` — Watch mode
- `pnpm run test` — Run tests
- `pnpm run lint` — ESLint
- `pnpm run typecheck` — TypeScript strict check
