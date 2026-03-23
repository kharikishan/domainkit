import { describe, it, expect } from 'vitest';
import { checkStaleness, checkAllStaleness } from '../../../src/drift/staleness.js';
import type { Skill } from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal Skill for staleness unit tests
// ---------------------------------------------------------------------------

function makeSkill(
  name: string,
  description: string,
  body = '',
  overrides: Partial<Skill['metadata']> = {},
): Skill {
  return {
    metadata: { name, description, ...overrides },
    body,
    filePath: `/fake/${name}/SKILL.md`,
    dir: `/fake/${name}`,
    hasContract: false,
  };
}

describe('checkStaleness', () => {
  // ---------------------------------------------------------------------------
  // Fresh skill — last-verified within threshold
  // ---------------------------------------------------------------------------

  it('returns null for a fresh skill (last-verified within threshold)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const skill = makeSkill('fresh-skill', 'A fresh skill', '', {
      'domainkit-last-verified': today,
    });
    const result = checkStaleness(skill, 30);
    expect(result).toBeNull();
  });

  it('returns null when last-verified is exactly at the threshold boundary', () => {
    const now = new Date();
    const boundary = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const skill = makeSkill('boundary-skill', 'At boundary', '', {
      'domainkit-last-verified': boundary.toISOString().slice(0, 10),
    });
    const result = checkStaleness(skill, 30);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Stale skill — last-verified beyond threshold
  // ---------------------------------------------------------------------------

  it('returns a DriftIssue with severity error for a stale skill', () => {
    const now = new Date();
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const skill = makeSkill('stale-skill', 'An old skill', '', {
      'domainkit-last-verified': old.toISOString().slice(0, 10),
    });
    const result = checkStaleness(skill, 30);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('staleness');
    expect(result!.severity).toBe('error');
    expect(result!.message).toContain('day(s) ago');
    expect(result!.details).toHaveProperty('daysSince');
    expect(result!.details).toHaveProperty('thresholdDays', 30);
  });

  // ---------------------------------------------------------------------------
  // No last-verified date
  // ---------------------------------------------------------------------------

  it('returns a warning when no last-verified date is set', () => {
    const skill = makeSkill('no-date-skill', 'No date');
    const result = checkStaleness(skill, 30);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('staleness');
    expect(result!.severity).toBe('warning');
    expect(result!.message).toContain('no domainkit-last-verified');
  });

  // ---------------------------------------------------------------------------
  // Unparseable date
  // ---------------------------------------------------------------------------

  it('returns a warning when the date is unparseable', () => {
    const skill = makeSkill('bad-date-skill', 'Bad date', '', {
      'domainkit-last-verified': 'not-a-date',
    });
    const result = checkStaleness(skill, 30);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('staleness');
    expect(result!.severity).toBe('warning');
    expect(result!.message).toContain('unparseable');
    expect(result!.message).toContain('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// checkAllStaleness
// ---------------------------------------------------------------------------

describe('checkAllStaleness', () => {
  it('returns a Map with an entry per skill', () => {
    const today = new Date().toISOString().slice(0, 10);
    const skills = [
      makeSkill('a', 'skill a', '', { 'domainkit-last-verified': today }),
      makeSkill('b', 'skill b'),
    ];
    const results = checkAllStaleness(skills, 30);
    expect(results.size).toBe(2);
    expect(results.get('a')).toBeNull();
    expect(results.get('b')).not.toBeNull();
    expect(results.get('b')!.severity).toBe('warning');
  });
});
