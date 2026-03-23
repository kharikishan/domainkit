import chalk from 'chalk';
import type { DriftResult, DriftIssue } from '../core/types.js';

// ---------------------------------------------------------------------------
// Formatting constants
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

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

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
