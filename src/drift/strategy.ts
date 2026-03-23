import type { Skill, DriftIssue, DriftStrategyName } from '../core/types.js';
import { getSkillCodePaths } from '../core/constants.js';
import { checkStaleness } from './staleness.js';
import { checkFileCoverage } from './file-coverage.js';
import { extractExpressRoutes, extractNextjsRoutes, extractSkillRoutes, extractContractRoutes, diffRoutes } from './api-routes.js';
import { diffModels, modelDiffToIssues } from './model-diff.js';
import { readContract } from '../core/skill-reader.js';
import fg from 'fast-glob';

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

/** Context passed to each drift strategy during execution. */
export interface DriftStrategyContext {
  sourceRoot: string;
  threshold: number;
}

/** A pluggable drift detection strategy. */
export interface DriftStrategyPlugin {
  name: DriftStrategyName;
  execute(skill: Skill, context: DriftStrategyContext): Promise<DriftIssue[]>;
}

// ---------------------------------------------------------------------------
// Built-in strategies
// ---------------------------------------------------------------------------

const stalenessStrategy: DriftStrategyPlugin = {
  name: 'staleness',
  async execute(skill, context) {
    const issue = checkStaleness(skill, context.threshold);
    return issue ? [issue] : [];
  },
};

const fileCoverageStrategy: DriftStrategyPlugin = {
  name: 'file-coverage',
  async execute(skill, context) {
    return checkFileCoverage(skill, context.sourceRoot);
  },
};

const apiRoutesStrategy: DriftStrategyPlugin = {
  name: 'api-routes',
  async execute(skill, context) {
    // Gather documented routes from skill metadata and contract
    const documentedRoutes: string[] = [...extractSkillRoutes(skill)];
    const contract = await readContract(skill.dir);
    if (contract) {
      documentedRoutes.push(...extractContractRoutes(contract));
    }

    // Gather actual routes from code
    const codePaths = getSkillCodePaths(skill);
    const actualRoutes: string[] = [];

    for (const pattern of codePaths) {
      const files = await fg(pattern, { onlyFiles: true, absolute: true, cwd: context.sourceRoot });
      for (const file of files) {
        const routes = await extractExpressRoutes(file);
        actualRoutes.push(...routes);
      }
    }

    // Check for Next.js app directory
    const appDir = await fg('app', { onlyDirectories: true, absolute: true, cwd: context.sourceRoot });
    if (appDir.length > 0) {
      const nextRoutes = await extractNextjsRoutes(appDir[0]);
      actualRoutes.push(...nextRoutes);
    }

    // Only diff if we have documented routes to compare against
    if (documentedRoutes.length > 0 || actualRoutes.length > 0) {
      return diffRoutes(actualRoutes, documentedRoutes);
    }

    return [];
  },
};

const modelDiffStrategy: DriftStrategyPlugin = {
  name: 'model-diff',
  async execute(skill, context) {
    const contract = await readContract(skill.dir);
    if (!contract?.models?.length) return [];

    const codePaths = getSkillCodePaths(skill);
    const sourceFiles: string[] = [];

    for (const pattern of codePaths) {
      const files = await fg(pattern, {
        onlyFiles: true,
        absolute: true,
        cwd: context.sourceRoot,
      });
      sourceFiles.push(...files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')));
    }

    if (sourceFiles.length === 0) return [];

    const diffs = await diffModels(contract, sourceFiles);
    return modelDiffToIssues(diffs);
  },
};

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

const BUILTIN_STRATEGIES = new Map<string, DriftStrategyPlugin>([
  ['staleness', stalenessStrategy],
  ['file-coverage', fileCoverageStrategy],
  ['api-routes', apiRoutesStrategy],
  ['model-diff', modelDiffStrategy],
]);

/** Register a custom drift strategy (or override a built-in one). */
export function registerStrategy(strategy: DriftStrategyPlugin): void {
  BUILTIN_STRATEGIES.set(strategy.name, strategy);
}

/** Look up a strategy by name. */
export function getStrategy(name: string): DriftStrategyPlugin | undefined {
  return BUILTIN_STRATEGIES.get(name);
}

/** List all registered strategy names. */
export function listStrategies(): string[] {
  return Array.from(BUILTIN_STRATEGIES.keys());
}
