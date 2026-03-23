import { describe, it, expect } from 'vitest';
import {
  METADATA_DOMAIN,
  METADATA_VERSION,
  METADATA_DEPENDENCIES,
  METADATA_CODE_PATHS,
  METADATA_LAST_VERIFIED,
  METADATA_API_ROUTES,
  getSkillDomain,
  getSkillDependencies,
  getSkillCodePaths,
} from '../../../src/core/constants.js';
import type { Skill } from '../../../src/core/types.js';

function makeSkill(metadata: Record<string, unknown> = {}): Skill {
  return {
    metadata: { name: 'test', description: 'desc', ...metadata },
    body: '',
    filePath: '/test/SKILL.md',
    dir: '/test',
    hasContract: false,
  };
}

describe('constants', () => {
  it('exports the correct metadata field names', () => {
    expect(METADATA_DOMAIN).toBe('domainkit-domain');
    expect(METADATA_VERSION).toBe('domainkit-version');
    expect(METADATA_DEPENDENCIES).toBe('domainkit-dependencies');
    expect(METADATA_CODE_PATHS).toBe('domainkit-code-paths');
    expect(METADATA_LAST_VERIFIED).toBe('domainkit-last-verified');
    expect(METADATA_API_ROUTES).toBe('domainkit-api-routes');
  });
});

describe('getSkillDomain', () => {
  it('prefers domainkit-domain over domain', () => {
    const skill = makeSkill({ domain: 'a', 'domainkit-domain': 'b' });
    expect(getSkillDomain(skill)).toBe('b');
  });

  it('falls back to domain when domainkit-domain is missing', () => {
    const skill = makeSkill({ domain: 'a' });
    expect(getSkillDomain(skill)).toBe('a');
  });

  it('returns fallback when both are missing', () => {
    const skill = makeSkill({});
    expect(getSkillDomain(skill)).toBe('');
    expect(getSkillDomain(skill, 'unknown')).toBe('unknown');
  });
});

describe('getSkillDependencies', () => {
  it('prefers domainkit-dependencies over dependencies', () => {
    const skill = makeSkill({
      dependencies: ['a'],
      'domainkit-dependencies': ['b', 'c'],
    });
    expect(getSkillDependencies(skill)).toEqual(['b', 'c']);
  });

  it('falls back to dependencies', () => {
    const skill = makeSkill({ dependencies: ['x'] });
    expect(getSkillDependencies(skill)).toEqual(['x']);
  });

  it('returns empty array when none set', () => {
    expect(getSkillDependencies(makeSkill({}))).toEqual([]);
  });
});

describe('getSkillCodePaths', () => {
  it('returns code paths from metadata', () => {
    const skill = makeSkill({ 'domainkit-code-paths': ['src/**'] });
    expect(getSkillCodePaths(skill)).toEqual(['src/**']);
  });

  it('returns empty array when none set', () => {
    expect(getSkillCodePaths(makeSkill({}))).toEqual([]);
  });
});
