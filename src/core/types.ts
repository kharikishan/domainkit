/**
 * Shared TypeScript interfaces for the DomainKit project.
 * DomainKit is a domain-focused Agent Skills management tool.
 */

// ---------------------------------------------------------------------------
// Skill types
// ---------------------------------------------------------------------------

/** Frontmatter metadata parsed from a skill's markdown file. */
export interface SkillMetadata {
  name: string;
  description: string;
  domain?: string;
  dependencies?: string[];
  "domainkit-version"?: string;
  "domainkit-domain"?: string;
  "domainkit-dependencies"?: string[];
  "domainkit-code-paths"?: string[];
  "domainkit-last-verified"?: string;
  "domainkit-api-routes"?: string[];
  [key: string]: unknown;
}

/** A fully parsed skill, including its metadata, markdown body, and file location. */
export interface Skill {
  metadata: SkillMetadata;
  body: string;
  filePath: string;
  dir: string;
  hasContract: boolean;
}

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export interface ContractModelField {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ContractModel {
  name: string;
  fields: ContractModelField[];
}

export interface ContractRoute {
  method: string;
  path: string;
  description?: string;
}

export interface ContractApi {
  routes: ContractRoute[];
}

export interface ContractEvent {
  name: string;
  payload?: string;
  description?: string;
}

/** Structure of a skill's contract.yaml file describing its data models, API routes, and events. */
export interface Contract {
  models?: ContractModel[];
  api?: ContractApi;
  events?: ContractEvent[];
  dependencies?: string[];
}

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export interface ManifestEntry {
  name: string;
  domain: string;
  description: string;
  dependencies: string[];
  codePaths: string[];
  lastVerified: string | null;
  filePath: string;
  hasContract: boolean;
}

/** Aggregated index of all skills in the project, organized by domain. */
export interface Manifest {
  skills: ManifestEntry[];
  domains: Map<string, ManifestEntry[]>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Root configuration object for a DomainKit project (domainkit.config.json / yaml). */
export interface DomainKitConfig {
  version: string;
  skillsDir: string;
  sourceRoot: string;
  platform: "claude" | "codex" | "vscode" | "cursor" | "generic";
  sync?: {
    targets: string[];
  };
  drift?: {
    threshold: number;
    strategies: DriftStrategyName[];
  };
  context?: {
    defaultBudget: number;
    defaultFormat: string;
    defaultDepth: string;
  };
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface ValidationError {
  skill: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  skill: string;
  field: string;
  message: string;
}

/** Result of validating one or more skills against their contracts and metadata rules. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ---------------------------------------------------------------------------
// Context assembly types
// ---------------------------------------------------------------------------

export interface MatchResult {
  skill: string;
  domain: string;
  score: number;
  strength: "strong" | "weak" | "none";
}

export interface TokenBudget {
  total: number;
  used: number;
  remaining: number;
}

/** The assembled context payload ready to be rendered and injected into an agent prompt. */
export interface AssembledContext {
  primary: Skill[];
  dependencies: Skill[];
  format: string;
  budget: TokenBudget;
  rendered: string;
}

// ---------------------------------------------------------------------------
// Drift detection types
// ---------------------------------------------------------------------------

export interface DriftIssue {
  type:
    | "staleness"
    | "missing-file"
    | "new-file"
    | "route-mismatch"
    | "model-mismatch";
  message: string;
  severity: "error" | "warning" | "info";
  details?: Record<string, unknown>;
}

/** Drift analysis result for a single skill, summarising how out-of-date it is. */
export interface DriftResult {
  skill: string;
  issues: DriftIssue[];
  score: number;
  status: "fresh" | "stale" | "drifted";
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

export type OutputFormat = "claude" | "system-prompt" | "markdown";

export type ContextDepth = "index" | "contract" | "full";

/** Supported drift detection strategy names. */
export type DriftStrategyName = 'staleness' | 'file-coverage' | 'api-routes' | 'model-diff';
