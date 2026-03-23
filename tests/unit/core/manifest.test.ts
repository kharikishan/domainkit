import { describe, it, expect } from 'vitest';
import { buildManifest, getSkillByName, getSkillsByDomain } from '../../../src/core/manifest.js';
import type { Skill } from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// Helper: build minimal Skill stubs
// ---------------------------------------------------------------------------

function makeSkill(
  name: string,
  domain: string,
  description = 'Test skill',
  overrides: Partial<Skill['metadata']> = {},
): Skill {
  return {
    metadata: {
      name,
      description,
      'domainkit-domain': domain,
      ...overrides,
    },
    body: '## Data Models\n\n## Business Rules\n\n## API Surface',
    filePath: `/fake/${domain}/${name}/SKILL.md`,
    dir: `/fake/${domain}/${name}`,
    hasContract: false,
  };
}

describe('manifest', () => {
  // ---------------------------------------------------------------------------
  // buildManifest
  // ---------------------------------------------------------------------------

  describe('buildManifest', () => {
    it('returns a manifest with a skills array', () => {
      const manifest = buildManifest([makeSkill('auth', 'core')]);
      expect(Array.isArray(manifest.skills)).toBe(true);
      expect(manifest.skills.length).toBe(1);
    });

    it('populates each entry with correct name and domain', () => {
      const manifest = buildManifest([makeSkill('auth', 'core')]);
      const entry = manifest.skills[0]!;
      expect(entry.name).toBe('auth');
      expect(entry.domain).toBe('core');
    });

    it('groups skills by domain in the domains Map', () => {
      const skills = [
        makeSkill('auth', 'core'),
        makeSkill('payments', 'commerce'),
        makeSkill('orders', 'commerce'),
      ];
      const manifest = buildManifest(skills);
      expect(manifest.domains.size).toBe(2);
      expect(manifest.domains.get('commerce')!.length).toBe(2);
      expect(manifest.domains.get('core')!.length).toBe(1);
    });

    it('sets a timestamp in ISO format', () => {
      const manifest = buildManifest([]);
      expect(manifest.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('uses domainkit-domain over generic domain field', () => {
      const skill = makeSkill('auth', 'domainkit-domain-value');
      skill.metadata.domain = 'generic-domain';
      const manifest = buildManifest([skill]);
      expect(manifest.skills[0]!.domain).toBe('domainkit-domain-value');
    });

    it('falls back to domain field when domainkit-domain is absent', () => {
      const skill: Skill = {
        metadata: {
          name: 'auth',
          description: 'Auth skill',
          domain: 'fallback-domain',
        },
        body: 'body',
        filePath: '/fake/SKILL.md',
        dir: '/fake',
        hasContract: false,
      };
      const manifest = buildManifest([skill]);
      expect(manifest.skills[0]!.domain).toBe('fallback-domain');
    });

    it('uses domainkit-dependencies when present', () => {
      const skill = makeSkill('orders', 'commerce', 'Orders', {
        'domainkit-dependencies': ['auth', 'payments'],
      });
      const manifest = buildManifest([skill]);
      expect(manifest.skills[0]!.dependencies).toEqual(['auth', 'payments']);
    });

    it('uses domainkit-code-paths', () => {
      const skill = makeSkill('orders', 'commerce', 'Orders', {
        'domainkit-code-paths': ['src/orders'],
      });
      const manifest = buildManifest([skill]);
      expect(manifest.skills[0]!.codePaths).toEqual(['src/orders']);
    });

    it('sets lastVerified from domainkit-last-verified', () => {
      const skill = makeSkill('orders', 'commerce', 'Orders', {
        'domainkit-last-verified': '2025-01-01',
      });
      const manifest = buildManifest([skill]);
      expect(manifest.skills[0]!.lastVerified).toBe('2025-01-01');
    });

    it('sets lastVerified to null when not present', () => {
      const manifest = buildManifest([makeSkill('auth', 'core')]);
      expect(manifest.skills[0]!.lastVerified).toBeNull();
    });

    it('handles an empty skills array', () => {
      const manifest = buildManifest([]);
      expect(manifest.skills).toEqual([]);
      expect(manifest.domains.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getSkillByName
  // ---------------------------------------------------------------------------

  describe('getSkillByName', () => {
    it('returns the matching entry by name', () => {
      const manifest = buildManifest([
        makeSkill('auth', 'core'),
        makeSkill('payments', 'commerce'),
      ]);
      const entry = getSkillByName(manifest, 'auth');
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('auth');
    });

    it('returns undefined for a name that does not exist', () => {
      const manifest = buildManifest([makeSkill('auth', 'core')]);
      expect(getSkillByName(manifest, 'nonexistent')).toBeUndefined();
    });

    it('is case-sensitive', () => {
      const manifest = buildManifest([makeSkill('Auth', 'core')]);
      expect(getSkillByName(manifest, 'auth')).toBeUndefined();
      expect(getSkillByName(manifest, 'Auth')).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getSkillsByDomain
  // ---------------------------------------------------------------------------

  describe('getSkillsByDomain', () => {
    it('returns all skills in a given domain', () => {
      const manifest = buildManifest([
        makeSkill('payments', 'commerce'),
        makeSkill('orders', 'commerce'),
        makeSkill('auth', 'core'),
      ]);
      const commerceSkills = getSkillsByDomain(manifest, 'commerce');
      expect(commerceSkills.length).toBe(2);
    });

    it('returns empty array for a domain that does not exist', () => {
      const manifest = buildManifest([makeSkill('auth', 'core')]);
      expect(getSkillsByDomain(manifest, 'nonexistent')).toEqual([]);
    });

    it('returns correct skills for each domain', () => {
      const manifest = buildManifest([
        makeSkill('auth', 'core'),
        makeSkill('payments', 'commerce'),
      ]);
      const coreSkills = getSkillsByDomain(manifest, 'core');
      expect(coreSkills[0]!.name).toBe('auth');
    });
  });
});
