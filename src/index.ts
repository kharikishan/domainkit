// DomainKit programmatic API
export * from './core/types.js';
export { loadConfig, saveConfig, configExists, getDefaultConfig } from './core/config.js';
export { readSkill, readAllSkills, readContract } from './core/skill-reader.js';
export { buildManifest, getSkillByName, getSkillsByDomain } from './core/manifest.js';
export { validateSkill, validateContract, validateAll } from './core/validator.js';
export { countTokens, createBudget, estimateSkillTokens } from './core/token-counter.js';
export { buildDependencyGraph, resolveDependencies, detectCycles } from './core/dependency-graph.js';
export { matchTaskToDomains } from './core/matcher.js';
export { assembleContext } from './core/assembler.js';
export { renderContext } from './formats/index.js';
export { saveManifest, loadManifest } from './core/manifest.js';
export { computeSkillHash, trackVersion, getVersionHistory } from './core/versioning.js';
export { recommendFromDiff } from './recommend/index.js';
export type { PersonaDefinition, PersonaSection } from './personas/types.js';
export { listPersonas, getPersona, mergePersonas, loadBuiltinPersonas } from './personas/registry.js';

// Project context service
export { resolveProjectContext } from './core/project-context.js';
export type { ProjectContext } from './core/project-context.js';

// Constants & helpers
export {
  METADATA_DOMAIN,
  METADATA_VERSION,
  METADATA_DEPENDENCIES,
  METADATA_CODE_PATHS,
  METADATA_LAST_VERIFIED,
  METADATA_API_ROUTES,
  getSkillDomain,
  getSkillDependencies,
  getSkillCodePaths,
} from './core/constants.js';

// Drift detection
export { runDriftCheck, formatDriftTerminal, formatDriftMarkdown, formatDriftJson } from './drift/reporter.js';
export { registerStrategy, getStrategy, listStrategies } from './drift/strategy.js';
export type { DriftStrategyPlugin, DriftStrategyContext } from './drift/strategy.js';
export type { DriftCheckOptions } from './drift/reporter.js';
