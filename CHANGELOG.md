# Changelog

All notable changes to DomainKit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-03-19

### Added

#### Core
- `loadConfig` / `saveConfig` / `configExists` / `getDefaultConfig` for reading and writing `.domainkit/config.yaml`.
- `detectSkillsDir` auto-detects the skills directory from well-known locations (`.claude/skills`, `.agents/skills`, `.github/skills`, `.cursor/skills`, `.skills`).
- `readSkill` / `readAllSkills` / `readContract` for parsing `SKILL.md` files and their optional `references/contract.yaml` companions.
- `buildManifest` / `getSkillByName` / `getSkillsByDomain` for building an in-memory index of all skills organized by domain.
- `validateSkill` / `validateContract` / `validateAll` for checking skill frontmatter and JSON-Schema-validated contracts.
- `assembleContext` for selecting and token-budget-fitting skills for agent context injection, with full transitive dependency resolution.
- `buildDependencyGraph` / `resolveDependencies` / `detectCycles` for a topologically-aware skill dependency graph.
- `matchTaskToDomains` for TF-IDF (via `natural`) or keyword-overlap task-to-domain matching.
- `countTokens` / `createBudget` / `estimateSkillTokens` token-counting utilities backed by `gpt-tokenizer`.

#### Formats
- `renderContext` dispatcher supporting three output formats:
  - `markdown` — GitHub-flavoured Markdown for documentation and generic agents.
  - `claude` — XML-tagged `<domain-context>` blocks optimised for Claude.
  - `system-prompt` — Compact system-prompt injection format.

#### Drift Detection
- `runDriftCheck` orchestrator running configurable drift strategies per skill.
- `checkStaleness` / `checkAllStaleness` — flags skills whose `domainkit-last-verified` date exceeds a configurable threshold (default 30 days).
- `checkFileCoverage` — detects missing or newly-added source files relative to `domainkit-code-paths`.
- `extractExpressRoutes` / `extractNextjsRoutes` / `diffRoutes` — optional AST-based API route extraction and diff (requires `ts-morph`).
- `diffModels` — compares contract data models against TypeScript source types.
- `formatDriftTerminal` / `formatDriftMarkdown` / `formatDriftJson` output formatters.

#### Code Generation
- `scanModules` for discovering source modules eligible for skill scaffolding.
- `generateSkillDraft` scaffold generator using Handlebars templates.
- `extractTypes` / `extractRoutes` AST helpers (require `ts-morph`).

#### CLI (`domainkit` / `dk`)
- `init` — interactive project initialisation wizard.
- `add` — scaffold a new skill with optional contract.
- `list` — table view of all skills with domain grouping.
- `validate` — run validation across all skills and report errors/warnings.
- `build` — write the skill manifest to `.domainkit/manifest.json`.
- `drift` — run drift detection and display a per-skill score report.
- `context` — assemble and render a context block for a given task description.
- `generate` — auto-scaffold skills from detected source modules.
- `sync` — sync skills to configured agent targets (`.claude/CLAUDE.md`, etc.).

#### MCP Server
- Full Model Context Protocol server exposing DomainKit capabilities as MCP tools for Claude Desktop and compatible clients.

#### Infrastructure
- Dual ESM / CJS build via `tsup`.
- JSON Schema for `contract.yaml` at `schemas/contract.schema.json`.
- Handlebars templates for `skill.md` and `contract.yaml` scaffolding.

[0.1.0]: https://github.com/domainkit/domainkit/releases/tag/v0.1.0
