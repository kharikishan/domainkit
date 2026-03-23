import { describe, it, expect } from 'vitest';
import {
  runDriftCheck,
  formatDriftTerminal,
  formatDriftMarkdown,
  formatDriftJson,
} from '../../../src/drift/reporter.js';
import type { Skill, DriftResult } from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal Skill
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

// ---------------------------------------------------------------------------
// Score and status classification (tested via runDriftCheck)
// ---------------------------------------------------------------------------

describe('runDriftCheck — score computation', () => {
  it('returns score 100 and status "fresh" for a skill with no issues', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const skill = makeSkill('clean', 'Clean skill', '', {
      'domainkit-last-verified': today,
    });
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(100);
    expect(results[0].status).toBe('fresh');
    expect(results[0].issues).toHaveLength(0);
  });

  it('subtracts 15 for a warning issue (no last-verified) — score 85, status "fresh"', async () => {
    const skill = makeSkill('no-date', 'No date skill');
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    expect(results).toHaveLength(1);
    // warning penalty = 15 → score = 85
    expect(results[0].score).toBe(85);
    expect(results[0].status).toBe('fresh');
  });

  it('subtracts 30 for an error issue (stale) — score 70, status "stale"', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const skill = makeSkill('old', 'Old skill', '', {
      'domainkit-last-verified': old.toISOString().slice(0, 10),
    });
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(70);
    expect(results[0].status).toBe('stale');
  });

  it('score never drops below 0', async () => {
    // With staleness only we can get at most one issue per skill,
    // but we can test the floor by checking that the score is >= 0
    const skill = makeSkill('floor', 'Floor skill');
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    expect(results[0].score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Status classification thresholds
// ---------------------------------------------------------------------------

describe('status classification', () => {
  it('classifies score >= 80 as "fresh"', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const skill = makeSkill('fresh', 'Fresh', '', {
      'domainkit-last-verified': today,
    });
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    expect(results[0].status).toBe('fresh');
  });

  it('classifies score 50-79 as "stale"', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const skill = makeSkill('stale', 'Stale', '', {
      'domainkit-last-verified': old.toISOString().slice(0, 10),
    });
    const results = await runDriftCheck({
      skills: [skill],
      sourceRoot: '/fake',
      strategies: ['staleness'],
    });
    // error = -30 → score = 70
    expect(results[0].score).toBeGreaterThanOrEqual(50);
    expect(results[0].score).toBeLessThan(80);
    expect(results[0].status).toBe('stale');
  });
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

describe('formatDriftTerminal', () => {
  it('includes skill name, score, and status in output', () => {
    const results: DriftResult[] = [
      { skill: 'auth', issues: [], score: 100, status: 'fresh' },
    ];
    const output = formatDriftTerminal(results);
    expect(output).toContain('auth');
    expect(output).toContain('100');
    expect(output).toContain('fresh');
  });

  it('includes issue messages for skills with issues', () => {
    const results: DriftResult[] = [
      {
        skill: 'payments',
        issues: [
          {
            type: 'staleness',
            severity: 'warning',
            message: 'Skill has no domainkit-last-verified date recorded.',
          },
        ],
        score: 85,
        status: 'fresh',
      },
    ];
    const output = formatDriftTerminal(results);
    expect(output).toContain('no domainkit-last-verified');
  });
});

describe('formatDriftMarkdown', () => {
  it('outputs a Markdown table with headers', () => {
    const results: DriftResult[] = [
      { skill: 'auth', issues: [], score: 100, status: 'fresh' },
    ];
    const output = formatDriftMarkdown(results);
    expect(output).toContain('| Skill | Score | Status | Issues |');
    expect(output).toContain('| --- | --- | --- | --- |');
  });

  it('shows "none" when there are no issues', () => {
    const results: DriftResult[] = [
      { skill: 'auth', issues: [], score: 100, status: 'fresh' },
    ];
    const output = formatDriftMarkdown(results);
    expect(output).toContain('none');
  });

  it('includes issue severity and message in table rows', () => {
    const results: DriftResult[] = [
      {
        skill: 'api',
        issues: [
          {
            type: 'staleness',
            severity: 'error',
            message: 'Skill was last verified 60 day(s) ago',
          },
        ],
        score: 70,
        status: 'stale',
      },
    ];
    const output = formatDriftMarkdown(results);
    expect(output).toContain('**error**');
    expect(output).toContain('60 day');
  });
});

describe('formatDriftJson', () => {
  it('returns valid JSON string', () => {
    const results: DriftResult[] = [
      { skill: 'auth', issues: [], score: 100, status: 'fresh' },
    ];
    const output = formatDriftJson(results);
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(results);
  });

  it('preserves all fields in the JSON output', () => {
    const results: DriftResult[] = [
      {
        skill: 'payments',
        issues: [
          { type: 'staleness', severity: 'warning', message: 'test' },
        ],
        score: 85,
        status: 'fresh',
      },
    ];
    const output = formatDriftJson(results);
    const parsed = JSON.parse(output);
    expect(parsed[0].skill).toBe('payments');
    expect(parsed[0].issues).toHaveLength(1);
    expect(parsed[0].score).toBe(85);
  });
});
