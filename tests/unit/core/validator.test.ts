import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSkill, validateContract } from '../../../src/core/validator.js';
import { readSkill } from '../../../src/core/skill-reader.js';
import type { Skill, Contract } from '../../../src/core/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures/skills');

// ---------------------------------------------------------------------------
// Helper: build a minimal Skill for validator unit tests
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

describe('validator', () => {
  // ---------------------------------------------------------------------------
  // validateSkill — valid fixture
  // ---------------------------------------------------------------------------

  describe('validateSkill with valid-skill fixture', () => {
    it('returns valid=true for a correctly-formed skill', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      const result = validateSkill(skill);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('produces no errors for the valid fixture', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'valid-skill'));
      const result = validateSkill(skill);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateSkill — invalid fixture (no name)
  // ---------------------------------------------------------------------------

  describe('validateSkill with invalid-skill fixture', () => {
    it('returns valid=false when name is missing', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'invalid-skill'));
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
    });

    it('includes an error for the name field', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'invalid-skill'));
      const result = validateSkill(skill);
      const nameError = result.errors.find((e) => e.field === 'name');
      expect(nameError).toBeDefined();
      expect(nameError!.message).toContain('required');
    });
  });

  // ---------------------------------------------------------------------------
  // validateSkill — minimal fixture (name + description, no body sections)
  // ---------------------------------------------------------------------------

  describe('validateSkill with minimal-skill fixture', () => {
    it('returns valid=true (name and description are present)', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'minimal-skill'));
      const result = validateSkill(skill);
      expect(result.valid).toBe(true);
    });

    it('warns about missing recommended sections', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'minimal-skill'));
      const result = validateSkill(skill);
      // minimal-skill body lacks Data Models / Business Rules / API Surface headers
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns about missing Data Models section', async () => {
      const skill = await readSkill(join(FIXTURES_DIR, 'minimal-skill'));
      const result = validateSkill(skill);
      const warning = result.warnings.find((w) => w.message.includes('Data Models'));
      expect(warning).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // validateSkill — unit tests for specific rules
  // ---------------------------------------------------------------------------

  describe('validateSkill unit rules', () => {
    it('errors when description is empty string', () => {
      const skill = makeSkill('my-skill', '');
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
      const descError = result.errors.find((e) => e.field === 'description');
      expect(descError).toBeDefined();
    });

    it('errors when name is empty string', () => {
      const skill = makeSkill('', 'Valid description');
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
      const nameError = result.errors.find((e) => e.field === 'name');
      expect(nameError).toBeDefined();
    });

    it('errors when domainkit-last-verified is not an ISO date', () => {
      const skill = makeSkill('s', 'd', 'body', {
        'domainkit-last-verified': 'not-a-date',
      });
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
      const dateError = result.errors.find((e) => e.field === 'domainkit-last-verified');
      expect(dateError).toBeDefined();
    });

    it('does not error when domainkit-last-verified is a valid ISO date', () => {
      const skill = makeSkill('s', 'd', 'body', {
        'domainkit-last-verified': '2025-06-15',
      });
      const result = validateSkill(skill);
      const dateError = result.errors.find((e) => e.field === 'domainkit-last-verified');
      expect(dateError).toBeUndefined();
    });

    it('warns when body is empty', () => {
      const skill = makeSkill('s', 'd', '');
      const result = validateSkill(skill);
      const bodyWarning = result.warnings.find((w) => w.field === 'body' && w.message.includes('empty'));
      expect(bodyWarning).toBeDefined();
    });

    it('warns for each of the three recommended sections when all are absent', () => {
      const skill = makeSkill('s', 'd', 'Some content without headings');
      const result = validateSkill(skill);
      const bodyWarnings = result.warnings.filter((w) => w.field === 'body');
      // At minimum 3 warnings for missing sections + 1 for empty body not applicable
      // (body is not empty here, but sections are missing)
      expect(bodyWarnings.length).toBeGreaterThanOrEqual(3);
    });

    it('does not warn about sections when all recommended sections are present', () => {
      const body = '## Data Models\n\ncontent\n\n## Business Rules\n\nrules\n\n## API Surface\n\napi';
      const skill = makeSkill('s', 'd', body);
      const result = validateSkill(skill);
      const sectionWarnings = result.warnings.filter(
        (w) =>
          w.message.includes('Data Models') ||
          w.message.includes('Business Rules') ||
          w.message.includes('API Surface'),
      );
      expect(sectionWarnings).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateContract — valid contract
  // ---------------------------------------------------------------------------

  describe('validateContract with valid contract', () => {
    it('returns valid=true for a well-formed contract', () => {
      const contract: Contract = {
        models: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'string', required: true },
              { name: 'email', type: 'string', required: true },
            ],
          },
        ],
        api: {
          routes: [
            { method: 'GET', path: '/users', description: 'List users' },
          ],
        },
        events: [{ name: 'user.created', payload: 'User', description: 'User created' }],
        dependencies: ['notifications'],
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=true for a minimal contract (empty object)', () => {
      const contract: Contract = {};
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
    });

    it('returns valid=true for contract with only models', () => {
      const contract: Contract = {
        models: [{ name: 'Item', fields: [{ name: 'id', type: 'string' }] }],
      };
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // validateContract — invalid contracts
  // ---------------------------------------------------------------------------

  describe('validateContract with invalid contracts', () => {
    it('returns valid=false when a model is missing required fields array', () => {
      // A model without a "fields" property violates the schema
      const contract = {
        models: [{ name: 'Broken' }],
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid=false when a route is missing the method field', () => {
      const contract = {
        api: {
          routes: [{ path: '/foo' }],
        },
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false when a route is missing the path field', () => {
      const contract = {
        api: {
          routes: [{ method: 'GET' }],
        },
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false when an event is missing the name field', () => {
      const contract = {
        events: [{ payload: 'SomeType' }],
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for additional properties not in schema', () => {
      const contract = { unknownProp: true } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
    });

    it('error objects contain field and message', () => {
      const contract = {
        models: [{ name: 'Broken' }],
      } as unknown as Contract;
      const result = validateContract(contract);
      expect(result.errors[0]).toHaveProperty('field');
      expect(result.errors[0]).toHaveProperty('message');
    });
  });
});
