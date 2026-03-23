import type { Skill, DriftIssue } from '../core/types.js';
import { METADATA_LAST_VERIFIED } from '../core/constants.js';

/**
 * Check whether a single skill's `domainkit-last-verified` date is older than
 * `thresholdDays` days from today.  Returns a DriftIssue when stale, or null
 * when the skill is fresh (or has no last-verified date recorded).
 */
export function checkStaleness(skill: Skill, thresholdDays: number): DriftIssue | null {
  const lastVerifiedRaw = skill.metadata[METADATA_LAST_VERIFIED];

  if (!lastVerifiedRaw) {
    return {
      type: 'staleness',
      severity: 'warning',
      message: 'Skill has no domainkit-last-verified date recorded.',
      details: { skillName: skill.metadata.name },
    };
  }

  const lastVerified = new Date(lastVerifiedRaw);

  if (isNaN(lastVerified.getTime())) {
    return {
      type: 'staleness',
      severity: 'warning',
      message: `Skill has an unparseable domainkit-last-verified date: "${lastVerifiedRaw}".`,
      details: { skillName: skill.metadata.name, rawDate: lastVerifiedRaw },
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastVerified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > thresholdDays) {
    const daysSince = Math.floor(diffDays);
    return {
      type: 'staleness',
      severity: 'error',
      message: `Skill was last verified ${daysSince} day(s) ago (threshold: ${thresholdDays} days).`,
      details: {
        skillName: skill.metadata.name,
        lastVerified: lastVerifiedRaw,
        daysSince,
        thresholdDays,
      },
    };
  }

  return null;
}

/**
 * Run staleness checks over a collection of skills.
 * Returns a Map keyed by skill name where each value is the DriftIssue (or
 * null if the skill is not stale).
 */
export function checkAllStaleness(
  skills: Skill[],
  thresholdDays: number,
): Map<string, DriftIssue | null> {
  const results = new Map<string, DriftIssue | null>();

  for (const skill of skills) {
    const issue = checkStaleness(skill, thresholdDays);
    results.set(skill.metadata.name, issue);
  }

  return results;
}
