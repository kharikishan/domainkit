import chalk from 'chalk';
import type { Skill, DriftResult, DriftIssue } from '../core/types.js';
import { checkStaleness } from './staleness.js';
import { checkFileCoverage } from './file-coverage.js';

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface DriftCheckOptions {
  /** The skills to analyse. */
  skills: Skill[];
  /** Absolute path to the project's source root (used for glob resolution and git). */
  sourceRoot: string;
  /**
   * Maximum number of days since last-verified before a skill is considered stale.
   * Defaults to 30.
   */
  threshold?: number;
  /**
   * Which drift strategies to run.  Supported values: 'staleness', 'file-coverage'.
   * Defaults to both.
   */
  strategies?: string[];
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
  if (score >= 80) return 'fresh';
  if (score >= 50) return 'stale';
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
    threshold = 30,
    strategies = ['staleness', 'file-coverage'],
  } = options;

  const strategySet = new Set(strategies.map((s) => s.toLowerCase()));
  const results: DriftResult[] = [];

  for (const skill of skills) {
    const issues: DriftIssue[] = [];

    // --- staleness ---
    if (strategySet.has('staleness')) {
      try {
        const issue = checkStaleness(skill, threshold);
        if (issue) issues.push(issue);
      } catch (err: unknown) {
        console.warn(
          `[domainkit/drift] staleness strategy failed for "${skill.metadata.name}": ${String(err)}`,
        );
      }
    }

    // --- file-coverage ---
    if (strategySet.has('file-coverage')) {
      try {
        const coverageIssues = await checkFileCoverage(skill, sourceRoot);
        issues.push(...coverageIssues);
      } catch (err: unknown) {
        console.warn(
          `[domainkit/drift] file-coverage strategy failed for "${skill.metadata.name}": ${String(err)}`,
        );
      }
    }

    // --- api-routes (optional, not in the default set but callable by name) ---
    // The heavy lifting (ts-morph AST walking + filesystem scan) lives in
    // api-routes.ts; callers that want this strategy should wire it up
    // themselves using extractExpressRoutes / extractNextjsRoutes / diffRoutes.
    if (strategySet.has('api-routes')) {
      console.warn(
        '[domainkit/drift] The "api-routes" strategy must be orchestrated by the caller ' +
          'using extractExpressRoutes / extractNextjsRoutes / diffRoutes from api-routes.ts.',
      );
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

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const STATUS_ICONS: Record<DriftResult['status'], string> = {
  fresh: '✓',
  stale: '⚠',
  drifted: '✗',
};

const STATUS_CHALK: Record<DriftResult['status'], (s: string) => string> = {
  fresh: chalk.green,
  stale: chalk.yellow,
  drifted: chalk.red,
};

const SEVERITY_CHALK: Record<DriftIssue['severity'], (s: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
};

/**
 * Render drift results as a chalk-colored terminal string.
 *
 * Example output:
 *   ✓ auth-service  score=95  [fresh]
 *   ⚠ payments      score=60  [stale]
 *     ⚠ warning  Skill was last verified 35 day(s) ago ...
 */
export function formatDriftTerminal(results: DriftResult[]): string {
  const lines: string[] = [];

  for (const result of results) {
    const icon = STATUS_ICONS[result.status];
    const coloured = STATUS_CHALK[result.status];
    const header = coloured(
      `${icon}  ${result.skill.padEnd(30)} score=${String(result.score).padStart(3)}  [${result.status}]`,
    );
    lines.push(header);

    for (const issue of result.issues) {
      const tag = SEVERITY_CHALK[issue.severity](`${issue.severity}`);
      lines.push(`    ${tag}  ${issue.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render drift results as a GitHub-flavoured Markdown table.
 *
 * | Skill | Score | Status | Issues |
 * | ----- | ----- | ------ | ------ |
 * | auth  |    95 | fresh  | none   |
 */
export function formatDriftMarkdown(results: DriftResult[]): string {
  const header = '| Skill | Score | Status | Issues |';
  const divider = '| --- | --- | --- | --- |';

  const rows = results.map((r) => {
    const issuesSummary =
      r.issues.length === 0
        ? 'none'
        : r.issues
            .map((i) => `**${i.severity}**: ${escapeMarkdown(i.message)}`)
            .join('<br>');
    return `| ${escapeMarkdown(r.skill)} | ${r.score} | ${r.status} | ${issuesSummary} |`;
  });

  return [header, divider, ...rows].join('\n');
}

/**
 * Render drift results as a pretty-printed JSON string.
 */
export function formatDriftJson(results: DriftResult[]): string {
  return JSON.stringify(results, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMarkdown(text: string): string {
  return text.replace(/[|`*_[\]<>]/g, (c) => `\\${c}`);
}
