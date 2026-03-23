// Drift detection modules
export { checkStaleness, checkAllStaleness } from './staleness.js';
export { checkFileCoverage } from './file-coverage.js';
export { extractExpressRoutes, extractNextjsRoutes, extractSkillRoutes, extractContractRoutes, diffRoutes } from './api-routes.js';
export { diffModels, modelDiffToIssues } from './model-diff.js';

// Orchestrator
export { runDriftCheck } from './reporter.js';
export type { DriftCheckOptions } from './reporter.js';

// Strategy pattern
export { registerStrategy, getStrategy, listStrategies } from './strategy.js';
export type { DriftStrategyPlugin, DriftStrategyContext } from './strategy.js';

// Formatters
export { formatDriftTerminal, formatDriftMarkdown, formatDriftJson } from './formatters.js';
