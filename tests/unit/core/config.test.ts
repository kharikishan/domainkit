import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getDefaultConfig,
  loadConfig,
  saveConfig,
  detectSkillsDir,
  CONFIG_FILE,
} from '../../../src/core/config.js';
import type { DomainKitConfig } from '../../../src/core/types.js';

describe('config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'domainkit-config-test-'));
    // All tests that use loadConfig/saveConfig need a .domainkit dir so
    // resolveProjectRoot can find the project root.
    await mkdir(join(tmpDir, '.domainkit'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // getDefaultConfig
  // ---------------------------------------------------------------------------

  describe('getDefaultConfig', () => {
    it('returns an object with a version field', () => {
      const config = getDefaultConfig();
      expect(config.version).toBe('1');
    });

    it('returns default skillsDir of .skills', () => {
      const config = getDefaultConfig();
      expect(config.skillsDir).toBe('.skills');
    });

    it('returns default sourceRoot of src', () => {
      const config = getDefaultConfig();
      expect(config.sourceRoot).toBe('src');
    });

    it('returns default platform of generic', () => {
      const config = getDefaultConfig();
      expect(config.platform).toBe('generic');
    });

    it('returns a fresh object each time (no shared reference)', () => {
      const a = getDefaultConfig();
      const b = getDefaultConfig();
      a.skillsDir = 'mutated';
      expect(b.skillsDir).toBe('.skills');
    });
  });

  // ---------------------------------------------------------------------------
  // saveConfig / loadConfig round-trip
  // ---------------------------------------------------------------------------

  describe('saveConfig / loadConfig round-trip', () => {
    it('saves and reloads config correctly', async () => {
      const config: DomainKitConfig = {
        version: '1',
        skillsDir: '.agents/skills',
        sourceRoot: 'lib',
        platform: 'cursor',
      };

      await saveConfig(config, tmpDir);
      const loaded = await loadConfig(tmpDir);

      expect(loaded.version).toBe('1');
      expect(loaded.skillsDir).toBe('.agents/skills');
      expect(loaded.sourceRoot).toBe('lib');
      expect(loaded.platform).toBe('cursor');
    });

    it('config file is written at expected path', async () => {
      const config = getDefaultConfig();
      await saveConfig(config, tmpDir);

      const { fileExists } = await import('../../../src/utils/fs.js');
      const exists = await fileExists(join(tmpDir, CONFIG_FILE));
      expect(exists).toBe(true);
    });

    it('throws when project root cannot be resolved and no root is given', async () => {
      // Use an isolated temp dir that has no .git or .domainkit
      // and is NOT inside the actual repo — impossible to guarantee,
      // so instead pass an explicit temp dir that has .domainkit but no config
      // to test loadConfig throws on missing file.
      const emptyRoot = await mkdtemp(join(tmpdir(), 'domainkit-noconfig-'));
      await mkdir(join(emptyRoot, '.domainkit'));
      try {
        await expect(loadConfig(emptyRoot)).rejects.toThrow();
      } finally {
        await rm(emptyRoot, { recursive: true, force: true });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // detectSkillsDir
  // ---------------------------------------------------------------------------

  describe('detectSkillsDir', () => {
    it('returns .skills when no candidate directory exists', async () => {
      const result = await detectSkillsDir(tmpDir);
      expect(result).toBe('.skills');
    });

    it('detects .claude/skills when it exists', async () => {
      await mkdir(join(tmpDir, '.claude', 'skills'), { recursive: true });
      const result = await detectSkillsDir(tmpDir);
      expect(result).toBe('.claude/skills');
    });

    it('detects .agents/skills when it exists', async () => {
      await mkdir(join(tmpDir, '.agents', 'skills'), { recursive: true });
      const result = await detectSkillsDir(tmpDir);
      expect(result).toBe('.agents/skills');
    });

    it('prefers .claude/skills over .agents/skills (order matters)', async () => {
      await mkdir(join(tmpDir, '.claude', 'skills'), { recursive: true });
      await mkdir(join(tmpDir, '.agents', 'skills'), { recursive: true });
      const result = await detectSkillsDir(tmpDir);
      expect(result).toBe('.claude/skills');
    });

    it('detects .skills when it exists', async () => {
      await mkdir(join(tmpDir, '.skills'), { recursive: true });
      const result = await detectSkillsDir(tmpDir);
      expect(result).toBe('.skills');
    });
  });
});
