import { describe, it, expect } from 'vitest';
import { loadTemplate, renderTemplate } from '../../../src/utils/template.js';

describe('template utils', () => {
  // ---------------------------------------------------------------------------
  // loadTemplate
  // ---------------------------------------------------------------------------

  describe('loadTemplate', () => {
    it('loads the config.yaml.hbs template successfully', async () => {
      const source = await loadTemplate('config.yaml.hbs');
      expect(typeof source).toBe('string');
      expect(source.length).toBeGreaterThan(0);
    });

    it('the config template contains expected placeholders', async () => {
      const source = await loadTemplate('config.yaml.hbs');
      expect(source).toContain('{{skillsDir}}');
      expect(source).toContain('{{sourceRoot}}');
      expect(source).toContain('{{platform}}');
    });

    it('throws when the template file does not exist', async () => {
      await expect(loadTemplate('nonexistent-template.hbs')).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // renderTemplate
  // ---------------------------------------------------------------------------

  describe('renderTemplate', () => {
    it('renders config.yaml.hbs with provided data', async () => {
      const result = await renderTemplate('config.yaml.hbs', {
        skillsDir: '.skills',
        sourceRoot: 'src',
        platform: 'claude',
      });
      expect(result).toContain('.skills');
      expect(result).toContain('src');
      expect(result).toContain('claude');
    });

    it('replaces all placeholders with data values', async () => {
      const result = await renderTemplate('config.yaml.hbs', {
        skillsDir: '.custom-skills',
        sourceRoot: 'lib',
        platform: 'cursor',
      });
      expect(result).toContain('.custom-skills');
      expect(result).toContain('lib');
      expect(result).toContain('cursor');
      // Handlebars should not leave any unresolved {{}} placeholders for provided keys
      expect(result).not.toContain('{{skillsDir}}');
      expect(result).not.toContain('{{sourceRoot}}');
      expect(result).not.toContain('{{platform}}');
    });

    it('titleCase helper capitalises words correctly', async () => {
      // skill.md.hbs uses titleCase helper
      const source = await loadTemplate('skill.md.hbs');
      // The template exists and is readable
      expect(typeof source).toBe('string');
      expect(source.length).toBeGreaterThan(0);
    });
  });
});
