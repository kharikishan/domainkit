import { execSync } from 'node:child_process';
import { join } from 'node:path';
import fg from 'fast-glob';
import type { Skill, DriftIssue } from '../core/types.js';
import { getSkillCodePaths, METADATA_LAST_VERIFIED } from '../core/constants.js';
import * as logger from '../utils/logger.js';

/**
 * Expand code-path glob patterns for a skill and check:
 *  1. Patterns that match no files → 'missing-file' warning
 *  2. Files modified in git after the skill's last-verified date → 'new-file' info issues
 */
export async function checkFileCoverage(skill: Skill, sourceRoot: string): Promise<DriftIssue[]> {
  const issues: DriftIssue[] = [];
  const codePaths = getSkillCodePaths(skill);

  if (codePaths.length === 0) {
    return issues;
  }

  const lastVerified = skill.metadata[METADATA_LAST_VERIFIED];

  for (const pattern of codePaths) {
    // Resolve the pattern relative to sourceRoot unless it is already absolute
    const resolvedPattern = pattern.startsWith('/')
      ? pattern
      : join(sourceRoot, pattern).replace(/\\/g, '/');

    let matchedFiles: string[];
    try {
      matchedFiles = await fg(resolvedPattern, { onlyFiles: true, absolute: true });
    } catch (err: unknown) {
      issues.push({
        type: 'missing-file',
        severity: 'warning',
        message: `Error expanding glob pattern "${pattern}": ${String(err)}`,
        details: { pattern, sourceRoot },
      });
      continue;
    }

    if (matchedFiles.length === 0) {
      issues.push({
        type: 'missing-file',
        severity: 'warning',
        message: `Code-path glob "${pattern}" matched no files.`,
        details: { pattern, sourceRoot },
      });
      continue;
    }

    // Check for files modified after last-verified date via git
    if (lastVerified) {
      const changedFiles = findFilesChangedAfter(lastVerified, matchedFiles, sourceRoot);
      for (const changedFile of changedFiles) {
        issues.push({
          type: 'new-file',
          severity: 'info',
          message: `File "${changedFile}" was modified after the skill's last-verified date (${lastVerified}).`,
          details: {
            file: changedFile,
            lastVerified,
            pattern,
          },
        });
      }
    }
  }

  return issues;
}

/**
 * Use `git log` to find which of the given absolute file paths were touched
 * after the specified ISO date string.  Returns paths relative to sourceRoot.
 *
 * Runs: git log --after=<date> --name-only --pretty=format: -- <paths...>
 */
function findFilesChangedAfter(
  afterDate: string,
  absolutePaths: string[],
  sourceRoot: string,
): string[] {
  if (absolutePaths.length === 0) return [];

  // Convert absolute paths to paths relative to sourceRoot for git
  const relativePaths = absolutePaths.map((p) =>
    p.startsWith(sourceRoot) ? p.slice(sourceRoot.length).replace(/^[\\/]/, '') : p,
  );

  // Build the git command
  // Use -- to separate paths from options, quoting each path
  const quotedPaths = relativePaths.map((p) => JSON.stringify(p)).join(' ');
  const cmd = `git log --after=${JSON.stringify(afterDate)} --name-only --pretty=format: -- ${quotedPaths}`;

  let stdout: string;
  try {
    stdout = execSync(cmd, { cwd: sourceRoot, encoding: 'utf-8' });
  } catch (err) {
    logger.debug(`[domainkit/drift] git log failed for file coverage check: ${String(err)}`);
    return [];
  }

  // Parse output: blank lines separate commits; non-blank lines are file paths
  const changedSet = new Set<string>();
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      changedSet.add(trimmed);
    }
  }

  // Return only the files that git reported as changed AND that are in our set
  const relativeSet = new Set(relativePaths);
  return [...changedSet].filter((f) => relativeSet.has(f));
}
