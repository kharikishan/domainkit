import { describe, it, expect } from 'vitest';
import {
  getStrategy,
  listStrategies,
  registerStrategy,
} from '../../../src/drift/strategy.js';
import type { DriftStrategyPlugin } from '../../../src/drift/strategy.js';
import type { Skill } from '../../../src/core/types.js';

describe('drift strategy registry', () => {
  it('lists all four built-in strategies', () => {
    const names = listStrategies();
    expect(names).toContain('staleness');
    expect(names).toContain('file-coverage');
    expect(names).toContain('api-routes');
    expect(names).toContain('model-diff');
  });

  it('returns undefined for unknown strategy', () => {
    expect(getStrategy('nonexistent')).toBeUndefined();
  });

  it('returns a strategy by name', () => {
    const strategy = getStrategy('staleness');
    expect(strategy).toBeDefined();
    expect(strategy!.name).toBe('staleness');
  });

  it('allows registering a custom strategy', () => {
    const original = getStrategy('staleness');
    const custom: DriftStrategyPlugin = {
      name: 'staleness', // override built-in for test
      async execute() {
        return [];
      },
    };
    registerStrategy(custom);
    expect(getStrategy('staleness')).toBe(custom);
    // Restore original
    if (original) registerStrategy(original);
  });
});

describe('staleness strategy', () => {
  it('returns issues for skills with no last-verified date', async () => {
    const strategy = getStrategy('staleness')!;
    const skill: Skill = {
      metadata: { name: 'test', description: 'desc' },
      body: '',
      filePath: '/test/SKILL.md',
      dir: '/test',
      hasContract: false,
    };

    const issues = await strategy.execute(skill, {
      sourceRoot: '/src',
      threshold: 30,
    });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe('staleness');
  });

  it('returns no issues for recently verified skills', async () => {
    const strategy = getStrategy('staleness')!;
    const today = new Date().toISOString().split('T')[0];
    const skill: Skill = {
      metadata: {
        name: 'test',
        description: 'desc',
        'domainkit-last-verified': today,
      },
      body: '',
      filePath: '/test/SKILL.md',
      dir: '/test',
      hasContract: false,
    };

    const issues = await strategy.execute(skill, {
      sourceRoot: '/src',
      threshold: 30,
    });

    expect(issues).toEqual([]);
  });
});
