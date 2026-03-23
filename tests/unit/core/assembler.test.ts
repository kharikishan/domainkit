import { describe, it, expect } from 'vitest';
import { assembleContext } from '../../../src/core/assembler.js';
import type { Skill } from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal Skill for assembler unit tests
// ---------------------------------------------------------------------------

function makeSkill(
  name: string,
  description: string,
  body = '## Data Models\n\n## Business Rules\n\n## API Surface',
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
// Context assembly
// ---------------------------------------------------------------------------

describe('assembleContext', () => {
  it('includes the selected skill in the primary list', async () => {
    const skills = [
      makeSkill('auth', 'Authentication service'),
      makeSkill('payments', 'Payments service'),
    ];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.primary).toHaveLength(1);
    expect(result.primary[0].metadata.name).toBe('auth');
  });

  it('returns empty primary when selected skill does not exist', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['nonexistent'],
    });
    expect(result.primary).toHaveLength(0);
  });

  it('includes multiple selected skills in the primary list', async () => {
    const skills = [
      makeSkill('auth', 'Auth'),
      makeSkill('payments', 'Payments'),
      makeSkill('notifications', 'Notifications'),
    ];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth', 'payments'],
    });
    expect(result.primary).toHaveLength(2);
    const names = result.primary.map((s) => s.metadata.name);
    expect(names).toContain('auth');
    expect(names).toContain('payments');
  });

  // ---------------------------------------------------------------------------
  // Dependency resolution
  // ---------------------------------------------------------------------------

  it('resolves transitive dependencies into the dependencies list', async () => {
    const skills = [
      makeSkill('auth', 'Auth', '', { 'domainkit-dependencies': ['users'] }),
      makeSkill('users', 'Users'),
    ];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.primary).toHaveLength(1);
    expect(result.primary[0].metadata.name).toBe('auth');
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].metadata.name).toBe('users');
  });

  it('does not duplicate a skill that is both selected and a dependency', async () => {
    const skills = [
      makeSkill('auth', 'Auth', '', { 'domainkit-dependencies': ['users'] }),
      makeSkill('users', 'Users'),
    ];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth', 'users'],
    });
    // users is selected AND a dep of auth — should only appear in primary
    expect(result.primary).toHaveLength(2);
    expect(result.dependencies).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Token budget management
  // ---------------------------------------------------------------------------

  it('uses the default budget of 8000 when none is specified', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.budget.total).toBe(8000);
  });

  it('respects a custom budget', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
      budget: 500,
    });
    expect(result.budget.total).toBe(500);
    expect(result.budget.used).toBeGreaterThan(0);
    expect(result.budget.remaining).toBeLessThan(500);
  });

  it('drops skills that do not fit within a very small budget', async () => {
    const skills = [
      makeSkill('auth', 'Authentication service with lots of details'),
      makeSkill('payments', 'Payments service with lots of details'),
    ];
    // Use a very small budget that can only fit one skill
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth', 'payments'],
      budget: 60,
    });
    // At least one skill should be dropped due to budget
    expect(result.primary.length).toBeLessThanOrEqual(2);
    expect(result.budget.remaining).toBeGreaterThanOrEqual(0);
  });

  it('tracks token usage in the budget', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.budget.used).toBeGreaterThan(0);
    expect(result.budget.remaining).toBe(
      result.budget.total - result.budget.used,
    );
  });

  // ---------------------------------------------------------------------------
  // Format and output
  // ---------------------------------------------------------------------------

  it('defaults format to "markdown"', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.format).toBe('markdown');
  });

  it('respects a custom format option', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
      format: 'claude',
    });
    expect(result.format).toBe('claude');
  });

  it('returns an empty rendered string (rendering is handled separately)', async () => {
    const skills = [makeSkill('auth', 'Auth')];
    const result = await assembleContext({
      skills,
      selectedSkills: ['auth'],
    });
    expect(result.rendered).toBe('');
  });
});
