import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';
import type { Skill, MatchResult } from '../core/types.js';

export interface RecommendOptions {
  skills: Skill[];
  sourceRoot: string;
  mode: 'unstaged' | 'staged' | 'commit';
  commitSha?: string;
}

export function recommendFromDiff(options: RecommendOptions): MatchResult[] {
  const { skills, sourceRoot, mode, commitSha } = options;

  // Get the diff
  let diffCmd: string;
  switch (mode) {
    case 'staged':
      diffCmd = 'git diff --cached --name-only';
      break;
    case 'commit':
      diffCmd = `git diff ${commitSha}~1 ${commitSha} --name-only`;
      break;
    default:
      diffCmd = 'git diff HEAD --name-only';
  }

  let changedFiles: string[];
  try {
    const output = execSync(diffCmd, { cwd: sourceRoot, encoding: 'utf-8' });
    changedFiles = output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }

  if (changedFiles.length === 0) return [];

  // Match changed files against skills' code-paths
  const results: MatchResult[] = [];

  for (const skill of skills) {
    const codePaths = skill.metadata['domainkit-code-paths'] ?? [];
    if (codePaths.length === 0) continue;

    let matchCount = 0;
    for (const file of changedFiles) {
      for (const pattern of codePaths) {
        if (minimatch(file, pattern)) {
          matchCount++;
          break;
        }
      }
    }

    if (matchCount > 0) {
      const score = matchCount / changedFiles.length;
      results.push({
        skill: skill.metadata.name,
        domain: skill.metadata['domainkit-domain'] ?? skill.metadata.domain ?? '',
        score,
        strength: score >= 0.5 ? 'strong' : score >= 0.2 ? 'weak' : 'none',
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}
