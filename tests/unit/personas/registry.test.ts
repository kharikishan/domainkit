import { describe, it, expect } from 'vitest';
import {
  loadBuiltinPersonas,
  getPersona,
  mergePersonas,
  listPersonas,
} from '../../../src/personas/index.js';

// ---------------------------------------------------------------------------
// loadBuiltinPersonas
// ---------------------------------------------------------------------------

describe('loadBuiltinPersonas', () => {
  it('returns a Map containing the "developer" persona', () => {
    const personas = loadBuiltinPersonas();
    expect(personas).toBeInstanceOf(Map);
    expect(personas.has('developer')).toBe(true);
  });

  it('returns a Map containing the "domain-expert" persona', () => {
    const personas = loadBuiltinPersonas();
    expect(personas.has('domain-expert')).toBe(true);
  });

  it('returns at least 2 built-in personas', () => {
    const personas = loadBuiltinPersonas();
    expect(personas.size).toBeGreaterThanOrEqual(2);
  });

  it('each persona has required fields', () => {
    const personas = loadBuiltinPersonas();
    for (const [id, persona] of personas) {
      expect(persona.id).toBe(id);
      expect(persona.name).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(Array.isArray(persona.focusAreas)).toBe(true);
      expect(persona.focusAreas.length).toBeGreaterThan(0);
      expect(Array.isArray(persona.sections)).toBe(true);
      expect(persona.sections.length).toBeGreaterThan(0);
      expect(persona.promptContext).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// getPersona
// ---------------------------------------------------------------------------

describe('getPersona', () => {
  it('returns the developer persona by id', async () => {
    const persona = await getPersona('developer');
    expect(persona).toBeDefined();
    expect(persona!.id).toBe('developer');
    expect(persona!.name).toBe('Developer');
  });

  it('returns the domain-expert persona by id', async () => {
    const persona = await getPersona('domain-expert');
    expect(persona).toBeDefined();
    expect(persona!.id).toBe('domain-expert');
    expect(persona!.name).toBe('Domain Expert');
  });

  it('returns undefined for a nonexistent persona', async () => {
    const persona = await getPersona('nonexistent');
    expect(persona).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mergePersonas
// ---------------------------------------------------------------------------

describe('mergePersonas', () => {
  it('returns the single persona when given an array of one', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const merged = mergePersonas([dev]);
    expect(merged).toBe(dev);
  });

  it('combines sections from multiple personas (deduplicating by heading)', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const expert = personas.get('domain-expert')!;
    const merged = mergePersonas([dev, expert]);

    // Should have all unique section headings from both personas
    const allHeadings = new Set([
      ...dev.sections.map((s) => s.heading),
      ...expert.sections.map((s) => s.heading),
    ]);
    expect(merged.sections).toHaveLength(allHeadings.size);
  });

  it('combines focusAreas from multiple personas (deduplicated)', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const expert = personas.get('domain-expert')!;
    const merged = mergePersonas([dev, expert]);

    const allFocusAreas = new Set([...dev.focusAreas, ...expert.focusAreas]);
    expect(merged.focusAreas).toHaveLength(allFocusAreas.size);
    for (const area of allFocusAreas) {
      expect(merged.focusAreas).toContain(area);
    }
  });

  it('concatenates ids with "+"', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const expert = personas.get('domain-expert')!;
    const merged = mergePersonas([dev, expert]);
    expect(merged.id).toBe('developer+domain-expert');
  });

  it('concatenates names with " + "', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const expert = personas.get('domain-expert')!;
    const merged = mergePersonas([dev, expert]);
    expect(merged.name).toBe('Developer + Domain Expert');
  });

  it('joins prompt contexts with double newline', () => {
    const personas = loadBuiltinPersonas();
    const dev = personas.get('developer')!;
    const expert = personas.get('domain-expert')!;
    const merged = mergePersonas([dev, expert]);
    expect(merged.promptContext).toContain(dev.promptContext);
    expect(merged.promptContext).toContain(expert.promptContext);
  });

  it('throws when given an empty array', () => {
    expect(() => mergePersonas([])).toThrow('Cannot merge zero personas');
  });
});

// ---------------------------------------------------------------------------
// listPersonas
// ---------------------------------------------------------------------------

describe('listPersonas', () => {
  it('returns at least 2 built-in personas', async () => {
    const list = await listPersonas();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('returns persona objects with id and name', async () => {
    const list = await listPersonas();
    for (const persona of list) {
      expect(persona.id).toBeTruthy();
      expect(persona.name).toBeTruthy();
    }
  });

  it('includes both developer and domain-expert', async () => {
    const list = await listPersonas();
    const ids = list.map((p) => p.id);
    expect(ids).toContain('developer');
    expect(ids).toContain('domain-expert');
  });
});
