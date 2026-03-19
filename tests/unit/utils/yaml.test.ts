import { describe, it, expect } from 'vitest';
import { parseYaml, stringifyYaml, parseFrontmatter } from '../../../src/utils/yaml.js';

describe('yaml utils', () => {
  // ---------------------------------------------------------------------------
  // parseYaml
  // ---------------------------------------------------------------------------

  describe('parseYaml', () => {
    it('parses a simple YAML string into an object', () => {
      const yaml = `name: hello\nversion: "1"`;
      const result = parseYaml<{ name: string; version: string }>(yaml);
      expect(result).toEqual({ name: 'hello', version: '1' });
    });

    it('parses YAML arrays correctly', () => {
      const yaml = `items:\n  - a\n  - b\n  - c`;
      const result = parseYaml<{ items: string[] }>(yaml);
      expect(result.items).toEqual(['a', 'b', 'c']);
    });

    it('parses nested YAML objects', () => {
      const yaml = `outer:\n  inner:\n    value: 42`;
      const result = parseYaml<{ outer: { inner: { value: number } } }>(yaml);
      expect(result.outer.inner.value).toBe(42);
    });

    it('returns undefined for empty YAML', () => {
      const result = parseYaml<null>('');
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // stringifyYaml
  // ---------------------------------------------------------------------------

  describe('stringifyYaml', () => {
    it('serializes an object to a YAML string', () => {
      const data = { name: 'test', version: '1' };
      const result = stringifyYaml(data);
      expect(result).toContain('name: test');
      expect(result).toContain("version: '1'");
    });

    it('serializes arrays to YAML', () => {
      const data = { items: ['a', 'b', 'c'] };
      const result = stringifyYaml(data);
      expect(result).toContain('- a');
      expect(result).toContain('- b');
      expect(result).toContain('- c');
    });

    it('round-trips: parse(stringify(obj)) === obj', () => {
      const original = {
        name: 'payment-processing',
        version: '1',
        tags: ['billing', 'finance'],
      };
      const yaml = stringifyYaml(original);
      const parsed = parseYaml<typeof original>(yaml);
      expect(parsed).toEqual(original);
    });
  });

  // ---------------------------------------------------------------------------
  // parseFrontmatter
  // ---------------------------------------------------------------------------

  describe('parseFrontmatter', () => {
    it('parses YAML frontmatter from a markdown string', () => {
      const content = `---\nname: my-skill\ndescription: A test skill.\n---\n\n# Body content here`;
      const result = parseFrontmatter<{ name: string; description: string }>(content);
      expect(result.data.name).toBe('my-skill');
      expect(result.data.description).toBe('A test skill.');
    });

    it('returns the body content without frontmatter', () => {
      const content = `---\nname: my-skill\n---\n\n# Body content here`;
      const result = parseFrontmatter<{ name: string }>(content);
      expect(result.content.trim()).toBe('# Body content here');
    });

    it('handles documents with no frontmatter', () => {
      const content = `# Just a heading\n\nSome body text.`;
      const result = parseFrontmatter<Record<string, unknown>>(content);
      expect(result.data).toEqual({});
      expect(result.content.trim()).toContain('Just a heading');
    });

    it('handles multiline frontmatter values', () => {
      const content = `---\nname: skill\ndeps:\n  - dep-a\n  - dep-b\n---\n\nbody`;
      const result = parseFrontmatter<{ name: string; deps: string[] }>(content);
      expect(result.data.deps).toEqual(['dep-a', 'dep-b']);
    });
  });
});
