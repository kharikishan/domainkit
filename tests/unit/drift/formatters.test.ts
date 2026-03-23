import { describe, it, expect } from 'vitest';
import {
  formatDriftTerminal,
  formatDriftMarkdown,
  formatDriftJson,
} from '../../../src/drift/formatters.js';
import type { DriftResult } from '../../../src/core/types.js';

const freshResult: DriftResult = {
  skill: 'auth-service',
  issues: [],
  score: 100,
  status: 'fresh',
};

const staleResult: DriftResult = {
  skill: 'payments',
  issues: [
    {
      type: 'staleness',
      severity: 'warning',
      message: 'Skill was last verified 35 day(s) ago',
    },
  ],
  score: 60,
  status: 'stale',
};

describe('formatDriftTerminal', () => {
  it('renders fresh result with checkmark', () => {
    const output = formatDriftTerminal([freshResult]);
    expect(output).toContain('✓');
    expect(output).toContain('auth-service');
    expect(output).toContain('fresh');
  });

  it('renders stale result with warning icon', () => {
    const output = formatDriftTerminal([staleResult]);
    expect(output).toContain('⚠');
    expect(output).toContain('payments');
    expect(output).toContain('stale');
  });
});

describe('formatDriftMarkdown', () => {
  it('renders a markdown table', () => {
    const output = formatDriftMarkdown([freshResult, staleResult]);
    expect(output).toContain('| Skill | Score | Status | Issues |');
    expect(output).toContain('auth-service');
    expect(output).toContain('none');
    expect(output).toContain('payments');
  });
});

describe('formatDriftJson', () => {
  it('renders valid JSON', () => {
    const output = formatDriftJson([freshResult]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].skill).toBe('auth-service');
  });
});
