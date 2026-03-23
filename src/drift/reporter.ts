import chalk from 'chalk';
import type { Skill, DriftResult, DriftIssue } from '../core/types.js';
import { checkStaleness } from './staleness.js';
import { checkFileCoverage } from './file-coverage.js';
import { extractExpressRoutes, extractNextjsRoutes, extractSkillRoutes, extractContractRoutes, diffRoutes } from './api-routes.js';
import { diffModels, modelDiffToIssues } from './model-diff.js';
import { readContract } from '../core/skill-reader.js';
import fg from 'fast-glob';

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
   * Which drift strategies to run.  Supported values: 'staleness', 'file-coverage', 'api-routes', 'model-diff'.
   * Defaults to both staleness and file-coverage.
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

    // --- api-routes ---
    if (strategySet.has('api-routes')) {
      try {
        // Gather documented routes from skill metadata and contract
        const documentedRoutes: string[] = [...extractSkillRoutes(skill)];
        const contract = await readContract(skill.dir);
        if (contract) {
          documentedRoutes.push(...extractContractRoutes(contract));
        }

        // Gather actual routes from code
        const codePaths = skill.metadata['domainkit-code-paths'] ?? [];
        const actualRoutes: string[] = [];

        for (const pattern of codePaths) {
          const files = await fg(pattern, { onlyFiles: true, absolute: true, cwd: sourceRoot });
          for (const file of files) {
            const routes = await extractExpressRoutes(file);
            actualRoutes.push(...routes);
          }
        }

        // Check for Next.js app directory
        const appDir = await fg('app', { onlyDirectories: true, absolute: true, cwd: sourceRoot });
        if (appDir.length > 0) {
          const nextRoutes = await extractNextjsRoutes(appDir[0]);
          actualRoutes.push(...nextRoutes);
        }

        // Only diff if we have documented routes to compare against
        if (documentedRoutes.length > 0 || actualRoutes.length > 0) {
          const routeIssues = diffRoutes(actualRoutes, documentedRoutes);
          issues.push(...routeIssues);
        }
      } catch (err: unknown) {
        console.warn(
          `[domainkit/drift] api-routes strategy failed for "${skill.metadata.name}": ${String(err)}`,
        );
      }
    }

    // --- model-diff ---
    if (strategySet.has('model-diff')) {
      try {
        const contract = await readContract(skill.dir);
        if (contract && contract.models && contract.models.length > 0) {
          const codePaths = skill.metadata['domainkit-code-paths'] ?? [];
          const sourceFiles: string[] = [];

          for (const pattern of codePaths) {
            const files = await fg(pattern, {
              onlyFiles: true,
              absolute: true,
              cwd: sourceRoot,
            });
            sourceFiles.push(...files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')));
          }

          if (sourceFiles.length > 0) {
            const diffs = await diffModels(contract, sourceFiles);
            const modelIssues = modelDiffToIssues(diffs);
            issues.push(...modelIssues);
          }
        }
      } catch (err: unknown) {
        console.warn(
          `[domainkit/drift] model-diff strategy failed for "${skill.metadata.name}": ${String(err)}`,
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
