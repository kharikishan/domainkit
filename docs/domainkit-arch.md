# DomainKit Architecture

> **Version:** 0.2.0 | **Runtime:** Node.js >= 18 | **Language:** TypeScript (ESM + CJS)

## Overview

DomainKit is a CLI tool and library for managing domain-focused Agent Skills. It bridges the gap between raw source code and the contextual knowledge AI coding agents need.

```
┌─────────────────────────────────────────────────────────┐
│                  DomainKit CLI (14 commands)             │
│                                                         │
│  init  add  list  validate  context  sync  drift  serve │
│  generate  persona  recommend  watch  import            │
├─────────────────────────────────────────────────────────┤
│                    Core Engine                           │
│                                                         │
│  Assembler ─── Matcher ─── Dependency Graph ─── Budget  │
│  Validator ─── Config ─── Manifest ─── Versioning       │
├──────────┬──────────┬───────────┬───────────┬───────────┤
│ Drift    │ Generate │ Personas  │ Recommend │ Formats   │
│ 4 strats │ Scanner  │ Registry  │ Git diff  │ 3 render  │
│          │ Writer   │ 2 builtin │ minimatch │           │
│          │ OpenAPI  │ Custom    │           │           │
├──────────┴──────────┴───────────┴───────────┴───────────┤
│  MCP Server (5 tools)  │  Utils  │  Templates  │ Schemas │
└─────────────────────────────────────────────────────────┘
│               Agent Skills Standard (SKILL.md)           │
└──────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── cli/                          # Commander.js CLI (14 commands)
│   ├── index.ts                  # Command registration (lazy-loaded)
│   ├── commands/
│   │   ├── init.ts               # dk init
│   │   ├── add.ts                # dk add <name> [--persona]
│   │   ├── list.ts               # dk list
│   │   ├── validate.ts           # dk validate
│   │   ├── context.ts            # dk context [task]
│   │   ├── sync.ts               # dk sync (Agent Skills standard)
│   │   ├── drift.ts              # dk drift
│   │   ├── generate.ts           # dk generate [--scan|--bootstrap]
│   │   ├── persona.ts            # dk persona [list|show|create]
│   │   ├── recommend.ts          # dk recommend
│   │   ├── watch.ts              # dk watch
│   │   ├── import.ts             # dk import openapi <spec>
│   │   └── serve.ts              # dk serve (MCP server)
│   └── ui/
│       ├── prompts.ts            # Interactive prompts (inquirer)
│       ├── spinner.ts            # Progress spinner (ora)
│       └── table.ts              # Table output (cli-table3)
│
├── core/                         # Core domain logic
│   ├── types.ts                  # All TypeScript interfaces
│   ├── config.ts                 # Config loading + AJV validation
│   ├── skill-reader.ts           # SKILL.md + contract.yaml I/O
│   ├── manifest.ts               # Manifest build/save/load
│   ├── validator.ts              # Skill + contract validation
│   ├── assembler.ts              # Context assembly pipeline
│   ├── dependency-graph.ts       # BFS resolution + DFS cycle detection
│   ├── token-counter.ts          # Token budgeting (gpt-tokenizer)
│   ├── matcher.ts                # TF-IDF + keyword fallback matching
│   └── versioning.ts             # SHA256 hash tracking (JSONL)
│
├── drift/                        # Drift detection (4 strategies)
│   ├── reporter.ts               # Orchestrator + 3 formatters
│   ├── staleness.ts              # Strategy: last-verified age
│   ├── file-coverage.ts          # Strategy: code-path glob matching
│   ├── api-routes.ts             # Strategy: Express/Next.js route diff
│   └── model-diff.ts             # Strategy: TypeScript type vs contract
│
├── generate/                     # Code-to-skill generation
│   ├── module-scanner.ts         # 5-phase module discovery
│   ├── skill-writer.ts           # SKILL.md generation (persona-aware)
│   ├── openapi-importer.ts       # OpenAPI spec → skills + contracts
│   ├── type-extractor.ts         # TypeScript type extraction
│   ├── route-extractor.ts        # Route signature extraction
│   └── scanner/
│       ├── project-classifier.ts # Language/framework detection
│       ├── structure-analyzer.ts # Heuristic module discovery
│       └── import-analyzer.ts    # Cohesion scoring via ts-morph
│
├── personas/                     # Persona system
│   ├── types.ts                  # PersonaDefinition, PersonaSection
│   ├── builtin.ts                # developer + domain-expert
│   └── registry.ts               # Load/merge/list (builtin + custom)
│
├── recommend/                    # Git-diff recommendations
│   └── index.ts                  # Match changed files → skills
│
├── formats/                      # Context output renderers
│   ├── index.ts                  # Format dispatcher
│   ├── claude.ts                 # CLAUDE.md style (domain index + bodies)
│   ├── markdown.ts               # Standard GFM
│   └── system-prompt.ts          # Compact system prompt format
│
├── mcp/                          # MCP server
│   ├── server.ts                 # Server setup + tool registration
│   └── tools/
│       ├── list-domains.ts       # list_domains
│       ├── get-context.ts        # get_context
│       ├── get-skill.ts          # get_skill
│       ├── check-drift.ts        # check_drift
│       └── get-dependencies.ts   # get_dependencies
│
├── utils/                        # Shared utilities
│   ├── fs.ts                     # File I/O + project root resolution
│   ├── yaml.ts                   # YAML parsing + frontmatter
│   ├── template.ts               # Handlebars template rendering
│   ├── logger.ts                 # Colored logging (chalk)
│   └── optional-import.ts        # Graceful optional dependency loading
│
├── schemas/                      # JSON Schemas
│   ├── config.schema.json        # DomainKitConfig validation
│   └── contract.schema.json      # Contract validation
│
└── index.ts                      # Public library API (17 exports)
```

---

## Core Data Types

### Skill

```typescript
interface Skill {
  metadata: SkillMetadata;  // YAML frontmatter
  body: string;             // Markdown content
  filePath: string;         // Absolute path to SKILL.md
  dir: string;              // Skill directory
  hasContract: boolean;     // references/contract.yaml exists?
}

interface SkillMetadata {
  name: string;                        // required
  description: string;                 // required
  domain?: string;
  'domainkit-domain'?: string;
  'domainkit-dependencies'?: string[];
  'domainkit-code-paths'?: string[];   // glob patterns
  'domainkit-last-verified'?: string;  // YYYY-MM-DD
  'domainkit-api-routes'?: string[];   // "METHOD /path"
  'domainkit-version'?: string;
}
```

### Contract

```typescript
interface Contract {
  models?: ContractModel[];   // { name, fields[] }
  api?: { routes: ContractRoute[] };  // { method, path, description? }
  events?: ContractEvent[];   // { name, payload?, description? }
  dependencies?: string[];
}
```

### Context Assembly

```typescript
interface AssembledContext {
  primary: Skill[];           // Skills at requested depth
  dependencies: Skill[];      // Transitive deps at index depth
  format: string;             // claude | system-prompt | markdown
  budget: TokenBudget;        // { total, used, remaining }
  rendered: string;           // Final rendered output
}
```

### Drift

```typescript
interface DriftIssue {
  type: 'staleness' | 'missing-file' | 'new-file' | 'route-mismatch' | 'model-mismatch';
  severity: 'error' | 'warning' | 'info';  // -30 / -15 / -5 points
  message: string;
}

interface DriftResult {
  skill: string;
  issues: DriftIssue[];
  score: number;              // 0-100
  status: 'fresh' | 'stale' | 'drifted';  // >=80 / >=50 / <50
}
```

### Persona

```typescript
interface PersonaDefinition {
  id: string;                 // "developer"
  name: string;               // "Developer"
  description: string;
  focusAreas: string[];
  sections: PersonaSection[]; // { heading, prompt, required }
  promptContext: string;       // How this persona sees code
  priority: 'primary' | 'supplementary';
}
```

---

## Data Flow

### Context Assembly Pipeline

```
Task description ("fix payment retry bug")
    │
    ▼
matchTaskToDomains()           ← TF-IDF (natural) or keyword fallback
    │ Returns: MatchResult[] sorted by score
    ▼
assembleContext()
    │
    ├─ buildDependencyGraph()   ← Maps skill → dependencies
    ├─ resolveDependencies()    ← BFS transitive closure
    ├─ createBudget(8000)       ← gpt-tokenizer estimates
    ├─ Load primary skills      ← at requested depth (index|contract|full)
    ├─ Load dependency skills   ← always at index depth
    └─ Drop overflow skills     ← if over budget
    │
    ▼
renderContext()                ← claude | system-prompt | markdown
    │
    ▼
Output (stdout | file | clipboard)
```

### Drift Detection Pipeline

```
runDriftCheck(skills, sourceRoot)
    │
    For each skill:
    │
    ├─ staleness          ← Is last-verified > threshold days?
    ├─ file-coverage      ← Do code-path globs match files? New files since verified?
    ├─ api-routes         ← Express/Next.js routes match contract? (ts-morph)
    └─ model-diff         ← TypeScript interfaces match contract models? (ts-morph)
    │
    ├─ Score: 100 - (errors×30 + warnings×15 + info×5)
    └─ Status: fresh(≥80) | stale(≥50) | drifted(<50)
    │
    ▼
formatDriftTerminal() | formatDriftMarkdown() | formatDriftJson()
```

### Module Discovery Pipeline (dk generate --scan)

```
scanForModules(projectRoot, sourceRoot)
    │
    Phase 1: classifyProject()
    │         → language, framework, monorepo detection
    │
    Phase 2: conventionScan()
    │         → modules/ features/ domains/ services/ directories
    │
    Phase 3: analyzeStructure()
    │         → heuristic scoring (file count, barrel exports, routes)
    │
    Phase 4: analyzeImports()   [optional, needs ts-morph]
    │         → cohesion scoring (internal vs external imports)
    │
    Phase 5: Filter & sort by confidence
    │
    ▼
DiscoveredModule[] { name, path, confidence, indicators }
```

### Recommendation Pipeline (dk recommend)

```
git diff --name-only (unstaged | staged | commit)
    │
    ▼
For each changed file:
    Match against skill.metadata['domainkit-code-paths'] via minimatch
    │
    ▼
Score = matchedFiles / totalChangedFiles
    │
    ▼
Ranked MatchResult[] → suggested dk context command
```

---

## Sync Architecture

DomainKit syncs skills using the **Agent Skills standard** — SKILL.md files are copied to each platform's standard discovery directory:

```
dk sync --all
    │
    ├─ .claude/skills/{name}/SKILL.md     ← Claude Code / Desktop
    ├─ .cursor/skills/{name}/SKILL.md     ← Cursor
    ├─ .agents/skills/{name}/SKILL.md     ← Codex / Windsurf
    └─ .github/skills/{name}/SKILL.md     ← GitHub Copilot / VS Code
```

No format conversion needed — 26+ platforms read SKILL.md natively.

---

## MCP Server

The MCP server exposes 5 tools via stdio transport:

| Tool | Input | Output |
|------|-------|--------|
| `list_domains` | — | All domains with skill counts |
| `get_context` | task or domains, budget, format | Assembled + rendered context |
| `get_skill` | name, depth | Skill at requested depth |
| `check_drift` | skill (optional) | Drift results for one/all skills |
| `get_dependencies` | skill | Direct + transitive dependencies |

The MCP SDK is loaded lazily via `requireOptional()` — if not installed, only `dk serve` fails; all other commands work fine.

---

## Persona System

```
Built-in (src/personas/builtin.ts)
    ├─ developer         → Architecture, Code Patterns, Dependencies, API, Setup
    └─ domain-expert     → Business Rules, Invariants, Domain Events, Edge Cases, Boundaries

Custom (.domainkit/personas/*.yaml)
    └─ Loaded by registry.ts → merged with builtins

Template Selection (skill-writer.ts)
    ├─ Single persona  → templates/personas/{id}.skill.md.hbs
    ├─ Merged personas → templates/personas/composite.skill.md.hbs
    └─ No persona      → templates/skill.md.hbs
```

---

## Dependencies

### Required (14 packages)

| Package | Purpose |
|---------|---------|
| commander | CLI framework |
| inquirer | Interactive prompts |
| js-yaml | YAML parsing |
| gray-matter | Frontmatter parsing |
| fast-glob | File globbing |
| minimatch | Glob pattern matching |
| ajv | JSON schema validation |
| gpt-tokenizer | Token counting |
| handlebars | Template rendering |
| chalk | Terminal colors |
| ora | Spinner animations |
| cli-table3 | Table output |

### Optional (3 packages — gracefully degrade if missing)

| Package | Enables | Fallback |
|---------|---------|----------|
| ts-morph | Route extraction, type extraction, cohesion scoring | Skipped |
| natural | TF-IDF task matching | Keyword overlap |
| @modelcontextprotocol/sdk | MCP server | `dk serve` fails; all else works |

---

## Build & Test

```
Build:    tsup → ESM + CJS + DTS (code splitting, Node 18 target)
Test:     vitest (16 test files, 214 tests)
Lint:     eslint
Types:    tsc --noEmit

Entry Points:
  cli   → src/cli/index.ts  → dist/cli.js  (binary: dk / domainkit)
  index → src/index.ts       → dist/index.js (library API)
```

---

## Key Design Decisions

1. **Agent Skills standard compliance** — Every skill DomainKit creates is a valid SKILL.md. No proprietary format.

2. **Lazy-loaded optional dependencies** — `ts-morph`, `natural`, and MCP SDK are loaded via `requireOptional()`. Missing packages degrade gracefully instead of crashing.

3. **Dual metadata fallback** — Every field checks both `domainkit-*` and standard variants: `skill.metadata['domainkit-domain'] ?? skill.metadata.domain`.

4. **Progressive disclosure** — Three depth tiers (index ~40 tokens, contract ~300 tokens, full ~1000 tokens) enable 15x efficiency over monolithic context dumps.

5. **Persona extensibility** — Adding a persona = one definition in `builtin.ts` + one template in `templates/personas/`. No structural changes needed.

6. **Config validation at load time** — AJV validates config.yaml against the JSON schema on every `loadConfig()` call. Invalid configs fail fast with descriptive errors.

7. **Manifest persistence** — `.domainkit/manifest.json` is written after `dk add` and `dk generate --bootstrap` for faster lookups without re-scanning all SKILL.md files.
