# DomainKit Architecture & Strategy Guide

This document explains every layer, module, strategy, and algorithm in DomainKit end-to-end. It is designed so you can confidently answer any question about how the system works.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)
3. [Type System](#3-type-system)
4. [Utils Layer](#4-utils-layer)
5. [Core Layer](#5-core-layer)
6. [Drift Detection Layer](#6-drift-detection-layer)
7. [MCP Server Layer](#7-mcp-server-layer)
8. [Format Renderers](#8-format-renderers)
9. [End-to-End Data Flows](#9-end-to-end-data-flows)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. System Overview

DomainKit is a TypeScript CLI and MCP (Model Context Protocol) server for managing **domain-focused Agent Skills**. It helps AI coding agents access well-organized, up-to-date domain knowledge without context pollution.

### What It Does

```
Developer writes skills       DomainKit manages them         AI agent consumes them
 ┌──────────────────┐         ┌──────────────────────┐       ┌──────────────────┐
 │  .skills/         │         │  Validate, Index,    │       │  Claude / Codex  │
 │    auth/          │ ──────► │  Assemble, Budget,   │ ────► │  receives only   │
 │      SKILL.md     │         │  Detect Drift,       │       │  relevant domain │
 │      contract.yaml│         │  Match Tasks         │       │  context          │
 └──────────────────┘         └──────────────────────┘       └──────────────────┘
```

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Commands (13)                         │
│   init, add, list, validate, context, sync, drift,              │
│   serve, generate, persona, recommend, watch, import            │
├─────────────────────────────────────────────────────────────────┤
│                     MCP Server (5 tools)                         │
│   list_domains, get_context, get_skill, check_drift,            │
│   get_dependencies                                               │
├────────────────┬──────────────┬──────────────┬──────────────────┤
│    Core Layer  │  Drift Layer │ Format Layer │  Generate Layer  │
│                │              │              │                  │
│  config        │  staleness   │  claude      │  module-scanner  │
│  skill-reader  │  file-cov    │  markdown    │  type-extractor  │
│  manifest      │  api-routes  │  system-prom │  route-extractor │
│  validator     │  model-diff  │              │  skill-writer    │
│  assembler     │  strategy    │              │                  │
│  matcher       │  formatters  │              │                  │
│  dep-graph     │  reporter    │              │                  │
│  token-counter │              │              │                  │
│  versioning    │              │              │                  │
│  constants     │              │              │                  │
│  project-ctx   │              │              │                  │
├────────────────┴──────────────┴──────────────┴──────────────────┤
│                       Utils Layer                                │
│   fs, yaml, logger, template, optional-import, json, ajv         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
src/
├── core/                   # Core data model and operations
│   ├── types.ts            # All TypeScript interfaces (single source of truth)
│   ├── constants.ts        # Shared metadata field names, thresholds, helpers
│   ├── config.ts           # Load/save/validate .domainkit/config.yaml
│   ├── skill-reader.ts     # Read SKILL.md files and contract.yaml
│   ├── manifest.ts         # Build/save/load skill manifests indexed by domain
│   ├── validator.ts        # Validate skills + contracts against schemas
│   ├── assembler.ts        # Assemble context with token budgeting + dep resolution
│   ├── matcher.ts          # Match natural-language tasks to skills (TF-IDF / keyword)
│   ├── dependency-graph.ts # Build dep graph, BFS resolution, DFS cycle detection
│   ├── token-counter.ts    # Count tokens using gpt-tokenizer
│   ├── versioning.ts       # Track skill changes via SHA-256 hashing
│   └── project-context.ts  # Single bootstrap for project root + config + skills
│
├── drift/                  # Drift detection system
│   ├── strategy.ts         # Strategy interface + registry + 4 built-in adapters
│   ├── reporter.ts         # Orchestrator: runs strategies, scores, classifies
│   ├── formatters.ts       # Terminal, Markdown, JSON output formatters
│   ├── staleness.ts        # Staleness detection (date comparison)
│   ├── file-coverage.ts    # File coverage detection (glob + git log)
│   ├── api-routes.ts       # API route mismatch detection (ts-morph + Next.js scan)
│   ├── model-diff.ts       # Data model mismatch detection (ts-morph)
│   └── index.ts            # Barrel exports
│
├── mcp/                    # Model Context Protocol server
│   ├── server.ts           # Lazy-loads MCP SDK, registers 5 tools
│   ├── types.ts            # Shared McpContent/McpResult types
│   ├── handler.ts          # Error-wrapping higher-order function
│   └── tools/              # Individual tool handlers
│       ├── list-domains.ts
│       ├── get-context.ts
│       ├── get-skill.ts
│       ├── check-drift.ts
│       └── get-dependencies.ts
│
├── formats/                # Context rendering engines
│   ├── index.ts            # Dispatcher (routes to correct renderer)
│   ├── claude.ts           # CLAUDE.md style with domain index table
│   ├── markdown.ts         # Plain Markdown with metadata lists
│   └── system-prompt.ts    # XML-style <project>/<active_domain> blocks
│
├── utils/                  # Cross-cutting utilities
│   ├── fs.ts               # File I/O, resolveProjectRoot
│   ├── yaml.ts             # YAML parse/stringify, frontmatter
│   ├── logger.ts           # Colored console output (info/warn/error/debug)
│   ├── template.ts         # Handlebars template rendering
│   ├── optional-import.ts  # Lazy-load optional dependencies (ts-morph, natural, MCP SDK)
│   ├── json.ts             # Safe JSON parsing with fallback
│   └── ajv.ts              # Shared Ajv factory for ESM/CJS compatibility
│
├── cli/                    # CLI command layer
│   ├── index.ts            # Commander program setup, registers 13 commands
│   ├── commands/           # One file per CLI command
│   └── ui/                 # spinner.ts, table.ts, prompts.ts
│
├── index.ts                # Public programmatic API (exports for library consumers)
└── schemas/                # JSON schemas for config and contract validation
    ├── config.schema.json
    └── contract.schema.json
```

---

## 3. Type System

All types live in `src/core/types.ts`. Here are the key ones:

### Skill Types

```typescript
// The frontmatter metadata parsed from a SKILL.md file
interface SkillMetadata {
  name: string;                          // Required: skill name
  description: string;                   // Required: what this skill covers
  domain?: string;                       // Standard domain field
  dependencies?: string[];               // Standard dependencies
  "domainkit-version"?: string;          // DomainKit version
  "domainkit-domain"?: string;           // Overrides `domain`
  "domainkit-dependencies"?: string[];   // Overrides `dependencies`
  "domainkit-code-paths"?: string[];     // Glob patterns for source files
  "domainkit-last-verified"?: string;    // ISO date — when skill was last reviewed
  "domainkit-api-routes"?: string[];     // Documented API routes ("GET /users")
  [key: string]: unknown;               // Extensible for custom fields
}

// A fully parsed skill
interface Skill {
  metadata: SkillMetadata;
  body: string;           // Markdown content after frontmatter
  filePath: string;       // Absolute path to SKILL.md
  dir: string;            // Absolute path to skill directory
  hasContract: boolean;   // Whether references/contract.yaml exists
}
```

### Contract Types

```typescript
// Structure of references/contract.yaml
interface Contract {
  models?: ContractModel[];   // Data model definitions
  api?: ContractApi;          // API route definitions
  events?: ContractEvent[];   // Event definitions
  dependencies?: string[];    // Skill dependencies
}

interface ContractModel {
  name: string;
  fields: ContractModelField[];  // { name, type, required?, description? }
}

interface ContractRoute {
  method: string;    // GET, POST, PUT, DELETE, etc.
  path: string;      // /users, /auth/login, etc.
  description?: string;
}
```

### Drift Types

```typescript
type DriftStrategyName = 'staleness' | 'file-coverage' | 'api-routes' | 'model-diff';

interface DriftIssue {
  type: 'staleness' | 'missing-file' | 'new-file' | 'route-mismatch' | 'model-mismatch';
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: Record<string, unknown>;
}

interface DriftResult {
  skill: string;
  issues: DriftIssue[];
  score: number;           // 0-100, starts at 100
  status: 'fresh' | 'stale' | 'drifted';
}
```

### Context Assembly Types

```typescript
interface AssembledContext {
  primary: Skill[];       // Explicitly requested skills
  dependencies: Skill[];  // Transitive dependency skills
  format: string;         // Output format name
  budget: TokenBudget;    // Token consumption tracking
  rendered: string;       // Final rendered output
}

interface TokenBudget {
  total: number;      // Max tokens allowed
  used: number;       // Tokens consumed so far
  remaining: number;  // total - used
}

interface MatchResult {
  skill: string;
  domain: string;
  score: number;                       // 0.0 - 1.0
  strength: 'strong' | 'weak' | 'none';
}
```

### Configuration

```typescript
interface DomainKitConfig {
  version: string;
  skillsDir: string;         // Default: '.skills'
  sourceRoot: string;        // Default: 'src'
  platform: 'claude' | 'codex' | 'vscode' | 'cursor' | 'generic';
  sync?: { targets: string[] };
  drift?: {
    threshold: number;                // Days before staleness (default: 30)
    strategies: DriftStrategyName[];  // Which drift checks to run
  };
  context?: {
    defaultBudget: number;     // Token budget (default: 8000)
    defaultFormat: string;     // Output format
    defaultDepth: string;      // Context depth level
  };
}
```

---

## 4. Utils Layer

### 4.1 Ajv Factory (`src/utils/ajv.ts`)

**What Ajv is:** Ajv (Another JSON Schema Validator) is the library we use to validate configuration files and contract YAML against predefined JSON schemas. It ensures that `.domainkit/config.yaml` and `references/contract.yaml` have the correct structure, types, and required fields.

**Why we need a factory:** Ajv v8 has a bundling quirk — depending on whether the code runs in ESM or CJS mode, its constructor is exported differently (as `default` or directly). Our factory handles both:

```typescript
// The bundler may give us Ajv as:
//   { default: AjvClass }   (ESM)
//   AjvClass                (CJS)
// So we resolve the correct constructor once:
const AjvConstructor = (AjvModule.default ?? AjvModule) as any;

export function createAjv(options?) {
  return new AjvConstructor(options);
}
```

**Where it's used:**
- `config.ts` — validates `config.yaml` against `config.schema.json`
- `validator.ts` — validates `contract.yaml` against `contract.schema.json`

**How JSON Schema validation works:**

```
1. Load JSON schema file (config.schema.json or contract.schema.json)
2. createAjv() → Ajv instance
3. ajv.compile(schema) → validate function
4. validate(data) → true/false
5. If false: validate.errors contains detailed error objects
   Each error has: instancePath (which field), message (what's wrong)
```

### 4.2 Safe JSON Parse (`src/utils/json.ts`)

**What it does:** Wraps `JSON.parse()` to prevent uncaught exceptions when parsing untrusted or potentially malformed JSON.

```typescript
export function safeJsonParse<T>(text: string, fallback?: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    // Throw a descriptive error (truncates long text to 100 chars)
    throw new Error(`Failed to parse JSON: ${text.substring(0, 100)}...`);
  }
}
```

**Three modes of operation:**
1. **Valid JSON** → returns parsed value, typed as `T`
2. **Invalid JSON + fallback provided** → returns fallback silently
3. **Invalid JSON + no fallback** → throws descriptive error with preview of the text

**Where it's used:** `manifest.ts` when loading `manifest.json` from disk.

### 4.3 Logger (`src/utils/logger.ts`)

Provides colored terminal output with quiet mode support:

| Function | Color | Behavior in Quiet Mode |
|----------|-------|----------------------|
| `info(msg)` | Blue | Suppressed |
| `warn(msg)` | Yellow | Suppressed |
| `error(msg)` | Red | Always shown |
| `success(msg)` | Green | Suppressed |
| `debug(msg)` | Gray | Suppressed + requires `DOMAINKIT_DEBUG` env var |

### 4.4 Optional Import (`src/utils/optional-import.ts`)

Lazy-loads dependencies that may not be installed:

```typescript
export async function requireOptional<T>(moduleName: string, feature: string): Promise<T> {
  try {
    return await import(moduleName);
  } catch {
    throw new Error(
      `The "${moduleName}" package is required for ${feature}. Install it: npm install ${moduleName}`
    );
  }
}
```

**Used for 3 optional packages:**
- `natural` — TF-IDF matching (only needed if you use task-to-domain matching)
- `ts-morph` — TypeScript AST parsing (only needed for api-routes and model-diff drift detection)
- `@modelcontextprotocol/sdk` — MCP server (only needed if you run `dk serve`)

This keeps the base installation lightweight — these packages are only loaded when their features are actually used.

---

## 5. Core Layer

### 5.1 Constants & Helpers (`src/core/constants.ts`)

Centralizes all "magic strings" and thresholds used across the codebase:

```typescript
// Metadata field names — used in 15+ files
METADATA_DOMAIN         = 'domainkit-domain'
METADATA_VERSION        = 'domainkit-version'
METADATA_DEPENDENCIES   = 'domainkit-dependencies'
METADATA_CODE_PATHS     = 'domainkit-code-paths'
METADATA_LAST_VERIFIED  = 'domainkit-last-verified'
METADATA_API_ROUTES     = 'domainkit-api-routes'

// Scoring thresholds
SCORE_THRESHOLD_FRESH   = 80    // score >= 80 → "fresh"
SCORE_THRESHOLD_STALE   = 50    // score >= 50 → "stale", below → "drifted"
DEFAULT_STALENESS_THRESHOLD = 30  // days before a skill is considered stale
DEFAULT_TOKEN_BUDGET    = 8000  // default token limit for context assembly

// Match strength thresholds
MATCH_STRONG_THRESHOLD  = 0.3   // score > 0.3 → "strong" match
MATCH_WEAK_THRESHOLD    = 0.1   // score > 0.1 → "weak" match
```

**Helper functions:**

```typescript
// Resolves the effective domain, checking domainkit-domain first
getSkillDomain(skill, fallback = '') → string

// Resolves effective dependencies, checking domainkit-dependencies first
getSkillDependencies(skill) → string[]

// Gets code-path globs from metadata
getSkillCodePaths(skill) → string[]
```

**Why this matters:** Before constants.ts, the string `'domainkit-domain'` appeared in 15+ files. A typo in any one of them would silently break functionality. Now there's a single source of truth.

### 5.2 Project Context (`src/core/project-context.ts`)

**Problem:** Every MCP tool and many CLI commands need the same 5-line bootstrap sequence:

```typescript
// This was repeated in every handler:
const projectRoot = await resolveProjectRoot();
const config = await loadConfig(projectRoot);
const skillsRoot = join(projectRoot, config.skillsDir);
const sourceRoot = join(projectRoot, config.sourceRoot);
const skills = await readAllSkills(skillsRoot);
```

**Solution:** One function that returns everything:

```typescript
interface ProjectContext {
  projectRoot: string;    // Absolute path to project root
  config: DomainKitConfig;
  skillsRoot: string;     // projectRoot + config.skillsDir
  sourceRoot: string;     // projectRoot + config.sourceRoot
  skills: Skill[];        // All parsed skills
}

async function resolveProjectContext(): Promise<ProjectContext>
```

Now every handler just calls `const { skills, config, sourceRoot } = await resolveProjectContext()`.

### 5.3 Config Loading (`src/core/config.ts`)

**Flow:**

```
.domainkit/config.yaml
        │
        ▼
  Read file from disk (utils/fs.ts)
        │
        ▼
  Parse YAML to object (utils/yaml.ts)
        │
        ▼
  Validate against config.schema.json (utils/ajv.ts)
        │
        ├─ Valid → return typed DomainKitConfig
        └─ Invalid → throw Error with all field-level messages
```

**Auto-detection:** `detectSkillsDir()` looks for skill directories in this priority order:
1. `.claude/skills`
2. `.agents/skills`
3. `.github/skills`
4. `.cursor/skills`
5. `.skills` (default fallback)

### 5.4 Skill Reader (`src/core/skill-reader.ts`)

**How a skill is parsed:**

```
.skills/auth/SKILL.md
        │
        ▼
  Read file content
        │
        ▼
  parseFrontmatter() → split YAML header from Markdown body
        │
        ▼
  parseDomainkitMetadata(data) → normalize fields:
    - Extract name, description (required)
    - Extract domain, dependencies (standard)
    - Extract domainkit-* overrides with type coercion:
        typeof data['domainkit-version'] === 'string' ? value : undefined
        toStringArray(data['domainkit-dependencies'])  // ensures string[]
    - Spread remaining custom fields from frontmatter
        │
        ▼
  Check if references/contract.yaml exists → set hasContract flag
        │
        ▼
  Return: Skill { metadata, body, filePath, dir, hasContract }
```

**Batch reading:** `readAllSkills(skillsRoot)` uses `fast-glob` to find all `*/SKILL.md` patterns, then calls `readSkill()` for each.

### 5.5 Manifest Building (`src/core/manifest.ts`)

**What a manifest is:** An aggregated index of all skills, organized by domain for fast lookup.

```typescript
function buildManifest(skills: Skill[], defaultDomain = ''): Manifest {
  // 1. Convert each Skill → ManifestEntry (extract key fields)
  const entries = skills.map(skill => ({
    name: skill.metadata.name,
    domain: getSkillDomain(skill, defaultDomain),
    description: skill.metadata.description,
    dependencies: getSkillDependencies(skill),
    codePaths: getSkillCodePaths(skill),
    lastVerified: skill.metadata['domainkit-last-verified'] ?? null,
    filePath: skill.filePath,
    hasContract: skill.hasContract,
  }));

  // 2. Group by domain into a Map
  const domains = new Map<string, ManifestEntry[]>();
  for (const entry of entries) {
    const existing = domains.get(entry.domain) ?? [];
    existing.push(entry);
    domains.set(entry.domain, existing);
  }

  return { skills: entries, domains, timestamp: new Date().toISOString() };
}
```

### 5.6 Validation (`src/core/validator.ts`)

**Two types of validation:**

**Skill validation** (`validateSkill`):

| Check | Type | Condition |
|-------|------|-----------|
| Name required | Error | Empty or missing name |
| Description required | Error | Empty or missing description |
| Valid ISO date | Error | `domainkit-last-verified` present but not valid ISO 8601 |
| Domain present | Warning | Neither `domain` nor `domainkit-domain` set |
| Last-verified present | Warning | No `domainkit-last-verified` |
| Version present | Warning | No `domainkit-version` |
| Body non-empty | Warning | Empty body |
| Recommended sections | Warning | Missing "Data Models", "Business Rules", or "API Surface" headings |

**Contract validation** (`validateContract`):
- Runs the contract data through Ajv against `contract.schema.json`
- Reports each schema violation as a ValidationError

### 5.7 Dependency Graph (`src/core/dependency-graph.ts`)

**Three algorithms:**

**1. Graph Building:**
```
For each skill:
  graph[skill.name] = getSkillDependencies(skill)

Result: Map<skillName, dependencyNames[]>
```

**2. BFS Traversal (resolve all transitive dependencies):**
```
function resolveDependencies(graph, seedSkills):
  queue = [...seedSkills]
  visited = Set()

  while queue not empty:
    current = queue.shift()
    if current in visited: skip
    visited.add(current)
    for each dep in graph[current]:
      if dep not in visited:
        queue.push(dep)

  return Array.from(visited)  // includes seeds + all transitive deps
```

**3. DFS Cycle Detection:**
```
function detectCycles(graph):
  cycles = []
  visited = Set()      // globally visited
  stack = Set()        // currently on recursion stack
  path = []            // current DFS path

  function dfs(node):
    if node in stack:
      // CYCLE FOUND — extract cycle from path
      cycleStart = path.indexOf(node)
      cycle = path[cycleStart..] + [node]  // close the loop
      cycles.push(cycle)
      return

    if node in visited: return

    visited.add(node)
    stack.add(node)
    path.push(node)

    for each dep in graph[node]:
      dfs(dep)

    path.pop()
    stack.delete(node)

  for each node in graph:
    dfs(node)

  return cycles  // e.g., [["A", "B", "C", "A"]]
```

### 5.8 Task-to-Domain Matching (`src/core/matcher.ts`)

**Two-tier approach with graceful fallback:**

```
matchTaskToDomains(task, skills)
        │
        ├─ Try: TF-IDF matching (requires `natural` package)
        │      │
        │      ├─ For each skill, build corpus: name + description + body
        │      ├─ Add all corpora to TF-IDF engine
        │      ├─ Query with task text → raw scores per skill
        │      ├─ Normalize: divide all scores by max score → 0.0 to 1.0
        │      ├─ Classify: > 0.3 = strong, > 0.1 = weak, else = none
        │      └─ Return sorted by score (descending), exclude "none"
        │
        └─ Catch: Keyword overlap fallback (no dependencies needed)
               │
               ├─ Tokenize task: lowercase → remove punctuation → split → remove stop words
               ├─ For each skill: tokenize corpus text the same way
               ├─ Compute Jaccard similarity: |intersection| / |union|
               ├─ Classify same thresholds
               └─ Return sorted by score (descending), exclude "none"
```

**Stop words filtered:** a, an, the, and, or, but, in, on, at, to, for, of, with, by, from, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, could, should, may, might, shall, can, this, that, these, those, it, its, as, if, so, up, out, not

### 5.9 Context Assembly (`src/core/assembler.ts`)

**The algorithm that decides what context an AI agent receives:**

```
assembleContext({ skills, selectedSkills, budget = 8000, depth = 'contract', format })
        │
        ▼
  1. Build dependency graph from ALL skills
        │
        ▼
  2. Resolve transitive dependencies for selectedSkills (BFS)
     Result: all skill names reachable from selection
        │
        ▼
  3. Separate into:
     - primary[] = skills that were explicitly selected
     - dependencies[] = skills pulled in transitively (not in selectedSkills)
        │
        ▼
  4. Create token budget: { total: 8000, used: 0, remaining: 8000 }
        │
        ▼
  5. Consume tokens for PRIMARY skills (at requested depth):
     for each primary skill:
       tokens = estimateSkillTokens(skill, depth)
       if fitsInBudget(budget, tokens):
         budget = consumeBudget(budget, tokens)
         include skill
       else:
         drop skill (doesn't fit)
        │
        ▼
  6. Consume tokens for DEPENDENCY skills (at 'index' depth — minimal):
     Same loop, but at lowest detail level to save tokens
        │
        ▼
  7. Return: { primary[], dependencies[], format, budget, rendered: '' }
```

**Token estimation by depth:**

| Depth | Estimation Formula |
|-------|--------------------|
| `index` | BASE(50) + countTokens(name) + countTokens(description) |
| `contract` | index estimate + 200 (assumed contract overhead) |
| `full` | index estimate + countTokens(body) |

### 5.10 Token Counter (`src/core/token-counter.ts`)

Uses the `gpt-tokenizer` library (OpenAI's tokenizer, compatible with Claude token counting) to count actual tokens in text. This is not a character-based estimate — it uses the real BPE tokenizer.

```typescript
countTokens("Hello, world!") → 4  // actual token count
```

### 5.11 Versioning (`src/core/versioning.ts`)

Tracks skill changes over time using content hashing:

```
computeSkillHash(skill)
  → SHA-256 of skill.body
  → truncate to first 12 hex characters
  → e.g., "a3f8c9e12b45"

trackVersion(skill, historyDir)
  → Compute current hash
  → Read last entry from .domainkit/versions/<skillName>.jsonl
  → If hash differs from previous:
      Append new entry: { hash, timestamp, previousHash }
  → If same: do nothing (no change detected)
```

**File format:** JSONL (one JSON object per line), one file per skill:
```jsonl
{"hash":"a3f8c9e12b45","timestamp":"2025-03-15T10:00:00Z","previousHash":null}
{"hash":"b7d2e1f34c89","timestamp":"2025-03-20T14:30:00Z","previousHash":"a3f8c9e12b45"}
```

---

## 6. Drift Detection Layer

Drift detection answers: **"Are my skills still accurate representations of the actual code?"**

### 6.1 Strategy Pattern (`src/drift/strategy.ts`)

The drift system uses a **Strategy Pattern** — a pluggable architecture where each type of drift check is an independent strategy:

```typescript
// Every strategy implements this interface
interface DriftStrategyPlugin {
  name: DriftStrategyName;  // 'staleness' | 'file-coverage' | 'api-routes' | 'model-diff'
  execute(skill: Skill, context: DriftStrategyContext): Promise<DriftIssue[]>;
}

interface DriftStrategyContext {
  sourceRoot: string;    // Absolute path to project source
  threshold: number;     // Days threshold for staleness
}
```

**Strategy Registry:**

```typescript
// Built-in strategies registered at module load time
const BUILTIN_STRATEGIES = new Map([
  ['staleness',      stalenessStrategy],
  ['file-coverage',  fileCoverageStrategy],
  ['api-routes',     apiRoutesStrategy],
  ['model-diff',     modelDiffStrategy],
]);

// Public API
registerStrategy(strategy)  // Add or override a strategy
getStrategy(name)           // Look up by name
listStrategies()            // Get all registered names
```

**Why a strategy pattern?** It makes the drift system extensible. You can:
- Add a custom strategy without modifying any existing code
- Disable strategies via config (`drift.strategies: ['staleness']`)
- Override built-in strategies for testing

### 6.2 Orchestrator (`src/drift/reporter.ts`)

**The main loop:**

```
runDriftCheck({ skills, sourceRoot, threshold = 30, strategies = ['staleness', 'file-coverage'] })
        │
        ▼
  For each skill:
    issues = []
    │
    For each strategy name in enabled strategies:
      │
      strategy = getStrategy(name)  // look up from registry
      │
      if strategy not found:
        logger.warn("Unknown strategy: ...")
        continue
      │
      try:
        strategyIssues = await strategy.execute(skill, { sourceRoot, threshold })
        issues.push(...strategyIssues)
      catch (err):
        logger.warn("Strategy failed for skill: ...")  // graceful degradation
      │
    score = computeScore(issues)
    status = classifyStatus(score)
    │
    results.push({ skill: skill.name, issues, score, status })
        │
        ▼
  Return DriftResult[]
```

**Scoring algorithm:**

```
Start: score = 100

For each issue:
  if severity == 'error':   score -= 30
  if severity == 'warning': score -= 15
  if severity == 'info':    score -= 5

score = max(0, score)  // floor at 0
```

**Classification:**

| Score Range | Status | Meaning |
|-------------|--------|---------|
| 80 - 100 | `fresh` | Skill is up to date |
| 50 - 79 | `stale` | Skill may need review |
| 0 - 49 | `drifted` | Skill is significantly out of date |

### 6.3 Strategy: Staleness (`src/drift/staleness.ts`)

**What it checks:** Is the skill's `domainkit-last-verified` date older than the threshold?

```
checkStaleness(skill, thresholdDays = 30)
        │
        ├─ No date recorded?
        │   → Warning: "Skill has no domainkit-last-verified date recorded."
        │
        ├─ Unparseable date?
        │   → Warning: "Skill has an unparseable domainkit-last-verified date: ..."
        │
        ├─ Date > thresholdDays old?
        │   → Error: "Skill was last verified 45 day(s) ago (threshold: 30 days)."
        │
        └─ Date within threshold?
            → null (no issue)
```

### 6.4 Strategy: File Coverage (`src/drift/file-coverage.ts`)

**What it checks:** Do the code-path glob patterns still match files? Have those files been modified after the skill was last verified?

```
checkFileCoverage(skill, sourceRoot)
        │
        ▼
  Get code-path patterns from skill metadata
  (e.g., ["src/auth/**/*.ts", "src/middleware/auth.ts"])
        │
        ▼
  For each pattern:
    │
    Expand using fast-glob → matchedFiles[]
    │
    ├─ No files matched?
    │   → Warning: 'Code-path glob "src/auth/**/*.ts" matched no files.'
    │
    └─ Files matched AND skill has last-verified date?
        │
        Run: git log --after="2025-01-15" --name-only -- <files>
        │
        For each file that changed after last-verified:
          → Info: 'File "auth.service.ts" was modified after the skill's
                   last-verified date (2025-01-15).'
```

**Why `git log`?** It tells us precisely which files were modified after a certain date, which is the most reliable way to detect if code has changed since the skill was reviewed.

### 6.5 Strategy: API Routes (`src/drift/api-routes.ts`)

**What it checks:** Do the API routes documented in the skill match the actual routes in the code?

```
api-routes strategy execution:
        │
        ▼
  1. Gather DOCUMENTED routes:
     ├─ From skill metadata: skill.metadata['domainkit-api-routes']
     │   e.g., ["GET /users", "POST /auth/login"]
     └─ From contract.yaml: contract.api.routes
         e.g., [{ method: "GET", path: "/users" }] → "GET /users"
        │
        ▼
  2. Gather ACTUAL routes from code:
     ├─ Express routes: Parse .ts files using ts-morph
     │   Find calls like: router.get('/users', ...) → "GET /users"
     │   Detects: app.get, app.post, router.get, router.post, etc.
     │
     └─ Next.js routes: Scan app/ directory for route.ts files
         e.g., app/users/route.ts → "GET /users"
              app/auth/login/route.ts → "GET /auth/login"
        │
        ▼
  3. Diff routes:
     undocumented = actual - documented  → Info issues
     missing      = documented - actual  → Warning issues
```

**How Express route extraction works (using ts-morph):**

```
1. Create ts-morph Project, add source file
2. Find all CallExpression nodes
3. Filter: expression must be PropertyAccessExpression
4. Check: the property name is one of [get, post, put, patch, delete, all, use]
5. Get first argument: must be a StringLiteral (the route path)
6. Emit: "METHOD /path"
```

### 6.6 Strategy: Model Diff (`src/drift/model-diff.ts`)

**What it checks:** Do the data models defined in contract.yaml still match the TypeScript interfaces in code?

```
model-diff strategy execution:
        │
        ▼
  1. Read contract models from contract.yaml
     e.g., models: [{ name: "User", fields: [{ name: "id", type: "string" }, ...] }]
        │
        ▼
  2. Parse TypeScript source files using ts-morph
     Find matching interfaces by name (e.g., interface User { ... })
     Extract fields: { fieldName: fieldType }
        │
        ▼
  3. For each contract model:
     Find matching interface in code
     │
     Compare fields:
     ├─ addedFields:   in code but NOT in contract  → Info
     ├─ removedFields: in contract but NOT in code   → Warning
     └─ changedFields: same name, different type     → Warning
        │
        ▼
  4. Convert diffs to DriftIssues:
     "Model 'User': field 'email' exists in code but not in contract"  (info)
     "Model 'User': field 'role' exists in contract but not in code"   (warning)
     "Model 'User': field 'age' type changed from 'number' to 'string'" (warning)
```

### 6.7 Formatters (`src/drift/formatters.ts`)

Three output formats for drift results:

**Terminal** (colored):
```
✓  auth-service                  score= 95  [fresh]
⚠  payments                     score= 60  [stale]
    warning  Skill was last verified 35 day(s) ago (threshold: 30 days).
✗  user-profiles                score= 25  [drifted]
    error    Skill was last verified 90 day(s) ago (threshold: 30 days).
    warning  Code-path glob "src/profiles/**" matched no files.
```

**Markdown** (table):
```markdown
| Skill | Score | Status | Issues |
| --- | --- | --- | --- |
| auth-service | 95 | fresh | none |
| payments | 60 | stale | **warning**: Skill was last verified 35 day(s) ago |
```

**JSON** (structured):
```json
[
  {
    "skill": "auth-service",
    "issues": [],
    "score": 95,
    "status": "fresh"
  }
]
```

---

## 7. MCP Server Layer

### 7.1 What is MCP?

MCP (Model Context Protocol) is a standard for AI agents to discover and call tools. DomainKit runs as an MCP server, letting AI agents (Claude, etc.) query domain knowledge programmatically.

### 7.2 Server Architecture (`src/mcp/server.ts`)

```
startMcpServer({ transport: 'stdio' })
        │
        ▼
  1. Lazy-load MCP SDK: requireOptional('@modelcontextprotocol/sdk')
     Lazy-load zod: requireOptional('zod')  // for schema definition
        │
        ▼
  2. Create McpServer instance: new McpServer({ name: 'domainkit', version: '0.1.0' })
        │
        ▼
  3. Register 5 tools with zod schemas:
     ┌─────────────────┬───────────────────────────────────────┐
     │ Tool            │ Parameters (zod schema)               │
     ├─────────────────┼───────────────────────────────────────┤
     │ list_domains    │ {} (no params)                        │
     │ get_context     │ task?, domains?, budget?, format?     │
     │ get_skill       │ name (required), depth?               │
     │ check_drift     │ skill? (optional filter)              │
     │ get_dependencies│ skill (required)                      │
     └─────────────────┴───────────────────────────────────────┘
        │
        ▼
  4. Connect StdioServerTransport
     (communicates over stdin/stdout with the AI agent)
```

**Lazy loading:** The MCP SDK and zod are not bundled — they're imported at runtime only when `dk serve` is called. This means the CLI works without these packages installed.

### 7.3 Shared Handler Wrapper (`src/mcp/handler.ts`)

Every tool handler is wrapped with `mcpHandler()`:

```typescript
export function mcpHandler<T>(fn: (args: T) => Promise<McpResult>) {
  return async (args: T) => {
    try {
      return await fn(args);          // Call the actual business logic
    } catch (err) {
      return {                         // Catch ANY error → return as MCP response
        content: [{ type: 'text', text: `Error: ${err.message}` }]
      };
    }
  };
}
```

**Why?** Without this, an uncaught exception in a tool handler would crash the MCP server. With it, errors are always returned gracefully to the AI agent as text.

### 7.4 Shared Types (`src/mcp/types.ts`)

```typescript
type McpContent = { type: 'text'; text: string };
type McpResult  = { content: McpContent[] };
```

Previously these two types were copy-pasted into all 5 tool files. Now they're defined once.

### 7.5 Tool: `list_domains`

**Purpose:** Overview of all domains and their skills.

**Response:**
```json
{
  "totalSkills": 8,
  "totalDomains": 3,
  "domains": {
    "auth": { "skillCount": 3, "skills": ["auth-core", "oauth", "sessions"] },
    "payments": { "skillCount": 2, "skills": ["stripe", "invoicing"] },
    "users": { "skillCount": 3, "skills": ["profiles", "roles", "preferences"] }
  },
  "timestamp": "2025-03-23T10:00:00.000Z"
}
```

### 7.6 Tool: `get_context`

**Purpose:** The main tool — assembles context for an AI agent's task.

**Input options:**
- `task: "implement user login"` — natural language, matched using TF-IDF
- `domains: ["auth", "users"]` — explicit domain selection
- `budget: 4000` — token limit
- `format: "claude"` — output format

**Logic flow:**
1. If `task` provided: run `matchTaskToDomains()`, take strong matches or top 3
2. If `domains` provided: add all skills in those domains
3. If neither: include all skills
4. Assemble with token budgeting
5. Render in requested format
6. Return rendered string

### 7.7 Tool: `get_skill`

**Purpose:** Read a specific skill at a chosen detail level.

**Progressive disclosure:**

| Depth | What's Included |
|-------|----------------|
| `index` | name, domain, description, filePath, hasContract |
| `contract` | Everything above + full metadata object |
| `full` | Everything above + body text + parsed contract.yaml |

### 7.8 Tool: `check_drift`

**Purpose:** Run drift detection and return health status.

**Response:**
```json
{
  "checked": 5,
  "fresh": 3,
  "stale": 1,
  "drifted": 1,
  "results": [
    { "skill": "auth", "score": 95, "status": "fresh", "issues": [] },
    { "skill": "payments", "score": 55, "status": "stale", "issues": [...] }
  ]
}
```

### 7.9 Tool: `get_dependencies`

**Purpose:** Map out a skill's dependency graph.

**Response:**
```json
{
  "skill": "checkout",
  "directDependencies": [
    { "name": "payments", "description": "...", "domain": "billing" }
  ],
  "transitiveDependencies": [
    { "name": "stripe-sdk", "description": "...", "domain": "billing" }
  ],
  "allDependencies": [
    { "name": "payments", ... },
    { "name": "stripe-sdk", ... }
  ]
}
```

---

## 8. Format Renderers

### 8.1 Dispatcher (`src/formats/index.ts`)

Routes to the correct renderer based on the format string:

```typescript
function renderContext(context, skills, format: OutputFormat): string {
  switch (format) {
    case 'claude':        return renderClaude(context, skills);
    case 'system-prompt': return renderSystemPrompt(context, skills);
    case 'markdown':      return renderMarkdown(context, skills);
  }
}
```

### 8.2 Claude Format

Optimized for CLAUDE.md files:

```markdown
# Domain Context

| Domain | Skills | Status |
| --- | --- | --- |
| auth | auth-core, sessions | active |
| billing | payments | dependency |

## auth-core
> Authentication and authorization logic

**Domain:** auth
**Dependencies:** sessions
**Code paths:** src/auth/**/*.ts

[Full markdown body here...]

## [dep] payments
> Payment processing via Stripe

**Domain:** billing
```

### 8.3 Markdown Format

Clean markdown with metadata as bullet lists:

```markdown
# Domain Context

## auth-core
Authentication and authorization logic

- **Domain:** auth
- **Dependencies:** sessions
- **Code paths:** src/auth/**/*.ts
- **API routes:** POST /auth/login, POST /auth/logout
- **Last verified:** 2025-03-15

[Full body...]

---

### Dependencies

#### payments
Payment processing via Stripe
- **Domain:** billing
```

### 8.4 System Prompt Format

XML-style blocks for direct system prompt injection:

```xml
<project>
<domain_index>
| Domain | Description |
| --- | --- |
| auth | Authentication and authorization |
</domain_index>

<active_domain name="auth-core">
Authentication and authorization logic

Domain: auth
Dependencies: sessions
Code paths: src/auth/**/*.ts

[Full body...]
</active_domain>

<dependency name="payments">
Payment processing via Stripe
Domain: billing
</dependency>
</project>
```

---

## 9. End-to-End Data Flows

### Flow 1: Agent asks "Help me implement user authentication"

```
Agent sends to MCP: get_context({ task: "implement user authentication" })
    │
    ▼
get-context.ts handler:
    │
    ├─ resolveProjectContext()
    │     ├─ Find .domainkit/ or .git/ directory (walk up from cwd)
    │     ├─ Load .domainkit/config.yaml → validate with Ajv
    │     └─ Read all .skills/*/SKILL.md → parse frontmatter
    │
    ├─ matchTaskToDomains("implement user authentication", allSkills)
    │     ├─ Try: TF-IDF via `natural` package
    │     │     Build corpus for each skill (name + description + body)
    │     │     Query: "implement user authentication"
    │     │     Scores: auth-core=0.72, sessions=0.45, payments=0.08, ...
    │     │     Normalize: auth-core=1.0, sessions=0.63, payments=0.11
    │     │     Classify: auth-core=strong, sessions=strong, payments=weak
    │     └─ Fallback: keyword overlap if `natural` not installed
    │
    │   Selected: ["auth-core", "sessions"] (strong matches)
    │
    ├─ assembleContext({ skills: all, selectedSkills: ["auth-core", "sessions"], budget: 8000 })
    │     ├─ Build dependency graph: auth-core → [sessions], sessions → []
    │     ├─ Resolve deps: BFS from [auth-core, sessions] → [auth-core, sessions]
    │     ├─ Primary: [auth-core, sessions], Dependencies: []
    │     ├─ Token budget: auth-core ≈ 1200 tokens, sessions ≈ 800 tokens
    │     │   Budget: 8000 - 1200 - 800 = 6000 remaining
    │     └─ Return AssembledContext
    │
    ├─ renderContext(assembled, allSkills, 'markdown')
    │     └─ Markdown renderer produces formatted output
    │
    └─ Return McpResult: { content: [{ type: 'text', text: rendered }] }

Agent receives domain context and uses it to write authentication code.
```

### Flow 2: Developer runs `dk drift`

```
dk drift
    │
    ▼
CLI drift command:
    │
    ├─ Load config → get threshold (30 days), strategies (['staleness', 'file-coverage'])
    ├─ Read all skills
    │
    ├─ runDriftCheck({ skills, sourceRoot, threshold: 30, strategies })
    │     │
    │     For skill "auth-core":
    │     │
    │     ├─ Strategy: staleness
    │     │     Last verified: 2025-02-01 → 50 days ago > 30 → ERROR
    │     │     Issue: { type: 'staleness', severity: 'error',
    │     │             message: 'last verified 50 day(s) ago (threshold: 30)' }
    │     │
    │     ├─ Strategy: file-coverage
    │     │     Pattern: "src/auth/**/*.ts"
    │     │     Glob → 5 files matched
    │     │     git log --after="2025-02-01" → 2 files changed
    │     │     Issues: 2x { type: 'new-file', severity: 'info' }
    │     │
    │     Score: 100 - 30(error) - 5(info) - 5(info) = 60
    │     Status: 'stale' (60 >= 50)
    │     │
    │     For skill "payments":
    │     ├─ staleness: verified 2025-03-20 → 3 days ago → OK
    │     ├─ file-coverage: no changes after verification → OK
    │     Score: 100, Status: 'fresh'
    │
    ├─ formatDriftTerminal(results)
    │     ⚠  auth-core                      score= 60  [stale]
    │         error    Skill was last verified 50 day(s) ago (threshold: 30 days).
    │         info     File "auth.service.ts" was modified after last-verified date.
    │         info     File "auth.guard.ts" was modified after last-verified date.
    │     ✓  payments                       score=100  [fresh]
    │
    └─ Print to terminal
```

### Flow 3: Developer runs `dk validate --strict`

```
dk validate --strict
    │
    ▼
CLI validate command:
    │
    ├─ Read all skills
    │
    ├─ For each skill, call core validateSkill():
    │     │
    │     auth-core:
    │     ├─ name: "auth-core" ✓
    │     ├─ description: "Auth logic" ✓
    │     ├─ domainkit-last-verified: "2025-02-01" → valid ISO ✓
    │     ├─ domainkit-domain: "auth" ✓
    │     ├─ domainkit-version: undefined → WARNING: no version
    │     ├─ body: non-empty ✓
    │     ├─ section "Data Models": found ✓
    │     ├─ section "Business Rules": found ✓
    │     └─ section "API Surface": MISSING → WARNING
    │
    ├─ Merge all results
    │
    ├─ --strict flag: treat warnings as errors
    │
    └─ Exit code 1 (has warnings in strict mode)
        Errors (0)
        Warnings (strict mode): (2) — treated as errors
          ✖ auth-core [domainkit-version]: No domainkit-version specified
          ✖ auth-core [body]: Recommended section "API Surface" is missing
```

---

## 10. Key Design Decisions

### Why Constants Instead of Raw Strings?
The string `'domainkit-domain'` appeared in 15+ files. A typo in any single file (e.g., `'domainkit-domian'`) would silently fail — no error, just missing data. Constants catch typos at compile time.

### Why a Strategy Pattern for Drift?
Each drift check is independent — staleness doesn't depend on file coverage results, and api-routes doesn't need model-diff. The strategy pattern:
- Allows running any subset of checks (`config.drift.strategies`)
- Makes adding new strategies trivial (implement interface, register)
- Isolates failures (one strategy crashing doesn't block others)

### Why `mcpHandler()` Wrapper?
An unhandled exception in an MCP tool handler crashes the entire server process. The wrapper guarantees every error is caught and returned as a graceful text response to the AI agent.

### Why `ProjectContext` Service?
Five MCP tools and most CLI commands need the same bootstrap (find root → load config → read skills). Without it, this 5-line sequence was copy-pasted everywhere. A single function eliminates the duplication and ensures consistent behavior.

### Why Progressive Disclosure (index / contract / full)?
AI agents have limited context windows. Sending full skill bodies for 20 skills would waste tokens on irrelevant content. Progressive disclosure lets the agent:
1. First get an overview (`index`) — just names and descriptions
2. Then get details (`contract`) — metadata and schemas
3. Then get everything (`full`) — complete body text

Combined with token budgeting, this ensures the most relevant information fits within the agent's context window.

### Why TF-IDF with Keyword Fallback?
TF-IDF (via the `natural` package) provides intelligent matching — it understands that "implement login" is more related to "authentication" than to "payments" even without exact word matches. But `natural` is a large optional dependency. The keyword overlap fallback ensures matching still works (albeit less accurately) without it.

### Why Lazy Loading for Optional Dependencies?
Three packages (`natural`, `ts-morph`, `@modelcontextprotocol/sdk`) are large and only needed for specific features. Lazy loading means:
- `npm install domainkit` is fast (no heavy deps)
- `dk list` and `dk validate` work without any optional deps
- `dk serve` prompts you to install `@modelcontextprotocol/sdk` only when needed
