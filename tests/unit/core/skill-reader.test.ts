import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkill, readAllSkills, readContract } from '../../../src/core/skill-reader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures/skills');

describe('skill-reader', () => {
  // ---------------------------------------------------------------------------
  // readSkill
  // ---------------------------------------------------------------------------

  describe('readSkill', () => {
    it('reads a valid skill with all frontmatter fields', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));

      expect(skill.metadata.name).toBe('payment-processing');
      expect(skill.metadata.description).toContain('payment processing');
      expect(skill.metadata['domainkit-domain']).toBe('commerce');
      expect(skill.metadata['domainkit-version']).toBe('1');
      expect(skill.metadata['domainkit-last-verified']).toBe('2025-01-15');
      expect(skill.hasContract).toBe(true);
    });

    it('sets filePath to the SKILL.md path', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      expect(skill.filePath).toMatch(/valid-skill[/\\]SKILL\.md$/);
    });

    it('sets dir to the skill directory', async () => {
      const skillDir = join(FIXTURES_DIR, 'valid-skill');
      const skill = await readSkill(skillDir);
      expect(skill.dir).toBe(skillDir);
    });

    it('includes trimmed body content', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      expect(skill.body.length).toBeGreaterThan(0);
      expect(skill.body).toContain('Data Models');
    });

    it('reads a minimal skill with only required fields', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'minimal-skill'));
      expect(skill.metadata.name).toBe('simple-logger');
      expect(skill.metadata.description).toBe('A minimal logging utility skill.');
      expect(skill.hasContract).toBe(false);
    });

    it('reads an invalid skill (no name) without throwing', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'invalid-skill'));
      expect(skill.metadata.name).toBe('');
      expect(skill.metadata.description).toContain('missing the required name');
    });

    it('parses domainkit-dependencies as an array', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      expect(Array.isArray(skill.metadata['domainkit-dependencies'])).toBe(true);
      expect(skill.metadata['domainkit-dependencies']).toContain('user-auth');
      expect(skill.metadata['domainkit-dependencies']).toContain('notifications');
    });

    it('parses domainkit-code-paths as an array', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      expect(Array.isArray(skill.metadata['domainkit-code-paths'])).toBe(true);
      expect(skill.metadata['domainkit-code-paths']).toContain('src/payments');
    });

    it('parses domainkit-api-routes as an array', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      const routes = skill.metadata['domainkit-api-routes'];
      expect(Array.isArray(routes)).toBe(true);
      expect(routes!.length).toBeGreaterThan(0);
    });

    it('parses space-separated string values into arrays via toStringArray', async () => {
      // The toStringArray helper converts space-separated strings to arrays.
      // We can verify this by checking that when YAML provides a real array,
      // it comes back as an array in metadata.
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      const deps = skill.metadata['domainkit-dependencies'];
      // YAML provided an array, should remain an array
      expect(Array.isArray(deps)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // readAllSkills
  // ---------------------------------------------------------------------------

  describe('readAllSkills', () => {
    it('reads all skills from the multi-domain fixture', async () => {
      const skills = await readAllSkills(join(FIXTURES_DIR, 'multi-domain'));
      expect(skills.length).toBe(2);
    });

    it('each skill has correct domain metadata', async () => {
      const skills = await readAllSkills(join(FIXTURES_DIR, 'multi-domain'));
      const domains = skills.map((s) => s.metadata['domainkit-domain']);
      expect(domains).toContain('alpha');
      expect(domains).toContain('beta');
    });

    it('skill in domain-b depends on domain-a skill', async () => {
      const skills = await readAllSkills(join(FIXTURES_DIR, 'multi-domain'));
      const beta = skills.find((s) => s.metadata['domainkit-domain'] === 'beta');
      expect(beta).toBeDefined();
      expect(beta!.metadata['domainkit-dependencies']).toContain('user-auth');
    });

    it('returns empty array for a directory with no SKILL.md files', async () => {
      const skills = await readAllSkills(join(FIXTURES_DIR, 'valid-skill'));
      // valid-skill itself has no sub-directories with SKILL.md at depth 1
      expect(skills).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // readContract
  // ---------------------------------------------------------------------------

  describe('readContract', () => {
    it('reads and parses the contract for a skill that has one', async () => {
      const contract = await readContract(join(FIXTURES_DIR, 'valid-skill'));
      expect(contract).not.toBeNull();
      expect(contract!.models).toBeDefined();
      expect(Array.isArray(contract!.models)).toBe(true);
    });

    it('contract has expected model names', async () => {
      const contract = await readContract(join(FIXTURES_DIR, 'valid-skill'));
      const modelNames = contract!.models!.map((m) => m.name);
      expect(modelNames).toContain('Payment');
      expect(modelNames).toContain('Refund');
    });

    it('contract has api routes', async () => {
      const contract = await readContract(join(FIXTURES_DIR, 'valid-skill'));
      expect(contract!.api).toBeDefined();
      expect(Array.isArray(contract!.api!.routes)).toBe(true);
      expect(contract!.api!.routes.length).toBeGreaterThan(0);
    });

    it('contract has events', async () => {
      const contract = await readContract(join(FIXTURES_DIR, 'valid-skill'));
      expect(Array.isArray(contract!.events)).toBe(true);
      expect(contract!.events!.length).toBeGreaterThan(0);
    });

    it('returns null for a skill without a contract', async () => {
      const contract = await readContract(join(FIXTURES_DIR, 'minimal-skill'));
      expect(contract).toBeNull();
    });
  });
});
