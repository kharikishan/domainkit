import { describe, it, expect } from 'vitest';
import {
  diffRoutes,
  extractSkillRoutes,
  extractContractRoutes,
} from '../../../src/drift/api-routes.js';
import type { Skill, Contract } from '../../../src/core/types.js';

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
// diffRoutes
// ---------------------------------------------------------------------------

describe('diffRoutes', () => {
  it('returns no issues when actual and documented match exactly', () => {
    const routes = ['GET /users', 'POST /users'];
    const issues = diffRoutes(routes, routes);
    expect(issues).toHaveLength(0);
  });

  it('returns info issue for undocumented routes (in code but not in docs)', () => {
    const actual = ['GET /users', 'POST /users', 'DELETE /users/:id'];
    const documented = ['GET /users', 'POST /users'];
    const issues = diffRoutes(actual, documented);
    const undocumented = issues.filter(
      (i) => i.details?.direction === 'undocumented',
    );
    expect(undocumented).toHaveLength(1);
    expect(undocumented[0].severity).toBe('info');
    expect(undocumented[0].type).toBe('route-mismatch');
    expect(undocumented[0].message).toContain('DELETE /users/:id');
  });

  it('returns warning issue for missing routes (in docs but not in code)', () => {
    const actual = ['GET /users'];
    const documented = ['GET /users', 'PUT /users/:id'];
    const issues = diffRoutes(actual, documented);
    const missing = issues.filter((i) => i.details?.direction === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].severity).toBe('warning');
    expect(missing[0].type).toBe('route-mismatch');
    expect(missing[0].message).toContain('PUT /users/:id');
  });

  it('returns both undocumented and missing issues', () => {
    const actual = ['GET /a', 'POST /b'];
    const documented = ['GET /a', 'DELETE /c'];
    const issues = diffRoutes(actual, documented);
    expect(issues).toHaveLength(2);
    const undocumented = issues.filter(
      (i) => i.details?.direction === 'undocumented',
    );
    const missing = issues.filter((i) => i.details?.direction === 'missing');
    expect(undocumented).toHaveLength(1);
    expect(missing).toHaveLength(1);
  });

  it('returns no issues when both arrays are empty', () => {
    const issues = diffRoutes([], []);
    expect(issues).toHaveLength(0);
  });

  it('normalises route casing for comparison', () => {
    const actual = ['get /users'];
    const documented = ['GET /users'];
    const issues = diffRoutes(actual, documented);
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractSkillRoutes
// ---------------------------------------------------------------------------

describe('extractSkillRoutes', () => {
  it('returns routes from domainkit-api-routes metadata', () => {
    const skill = makeSkill('api', 'API skill', '', {
      'domainkit-api-routes': ['GET /users', 'POST /users'],
    });
    const routes = extractSkillRoutes(skill);
    expect(routes).toEqual(['GET /users', 'POST /users']);
  });

  it('returns empty array when domainkit-api-routes is not set', () => {
    const skill = makeSkill('no-routes', 'No routes');
    const routes = extractSkillRoutes(skill);
    expect(routes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractContractRoutes
// ---------------------------------------------------------------------------

describe('extractContractRoutes', () => {
  it('returns formatted routes from contract api.routes', () => {
    const contract: Contract = {
      api: {
        routes: [
          { method: 'GET', path: '/items', description: 'List items' },
          { method: 'post', path: '/items', description: 'Create item' },
        ],
      },
    };
    const routes = extractContractRoutes(contract);
    expect(routes).toEqual(['GET /items', 'POST /items']);
  });

  it('returns empty array when contract has no api section', () => {
    const contract: Contract = {};
    const routes = extractContractRoutes(contract);
    expect(routes).toEqual([]);
  });

  it('returns empty array when api has no routes', () => {
    const contract: Contract = { api: { routes: [] } };
    const routes = extractContractRoutes(contract);
    expect(routes).toEqual([]);
  });
});
