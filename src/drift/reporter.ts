import type { DriftResult, DriftIssue, DriftStrategyName } from '../core/types.js';
import { SCORE_THRESHOLD_FRESH, SCORE_THRESHOLD_STALE, DEFAULT_STALENESS_THRESHOLD } from '../core/constants.js';
import { getStrategy } from './strategy.js';
import * as logger from '../utils/logger.js';

// Re-export formatters for backwards compatibility
export { formatDriftTerminal, formatDriftMarkdown, formatDriftJson } from './formatters.js';

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface DriftCheckOptions {
  /** The skills to analyse. */
  skills: import('../core/types.js').Skill[];
  /** Absolute path to the project's source root (used for glob resolution and git). */
  sourceRoot: string;
  /**
   * Maximum number of days since last-verified before a skill is considered stale.
   * Defaults to 30.
   */
  threshold?: number;
  /**
   * Which drift strategies to run.  Supported values: 'staleness', 'file-coverage', 'api-routes', 'model-diff'.
   * Defaults to both staleness and file-coverage.
   */
  strategies?: DriftStrategyName[];
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

const SEVERITY_PENALTY: Record<DriftIssue['severity'], number> = {
  error: 30,
  warning: 15,
  info: 5,
};

function computeScore(issues: DriftIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= SEVERITY_PENALTY[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

function classifyStatus(score: number): DriftResult['status'] {
  if (score >= SCORE_THRESHOLD_FRESH) return 'fresh';
  if (score >= SCORE_THRESHOLD_STALE) return 'stale';
  return 'drifted';
}

// ---------------------------------------------------------------------------
// Core orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the enabled drift-detection strategies over all provided skills and
 * return one DriftResult per skill.
 */
export async function runDriftCheck(options: DriftCheckOptions): Promise<DriftResult[]> {
  const {
    skills,
    sourceRoot,
    threshold = DEFAULT_STALENESS_THRESHOLD,
    strategies = ['staleness', 'file-coverage'] as DriftStrategyName[],
  } = options;

  const context = { sourceRoot, threshold };
  const results: DriftResult[] = [];

  for (const skill of skills) {
    const issues: DriftIssue[] = [];

    for (const strategyName of strategies) {
      const strategy = getStrategy(strategyName);
      if (!strategy) {
        logger.warn(`[domainkit/drift] Unknown strategy: "${strategyName}"`);
        continue;
      }

      try {
        const strategyIssues = await strategy.execute(skill, context);
        issues.push(...strategyIssues);
      } catch (err: unknown) {
        logger.warn(
          `[domainkit/drift] ${strategyName} strategy failed for "${skill.metadata.name}": ${String(err)}`,
        );
      }
    }

    const score = computeScore(issues);
    const status = classifyStatus(score);

    results.push({
      skill: skill.metadata.name,
      issues,
      score,
      status,
    });
  }

  return results;
}
