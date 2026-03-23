import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as AjvModule from 'ajv';
import type { DomainKitConfig } from './types.js';
import { fileExists, dirExists, readFileContent, writeFileContent, resolveProjectRoot } from '../utils/fs.js';
import { parseYaml, stringifyYaml } from '../utils/yaml.js';

const require = createRequire(import.meta.url);
const configSchema = require('../schemas/config.schema.json') as Record<string, unknown>;

// Ajv v8 may export its constructor as the default or as .default depending on the bundler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvConstructor: new (...args: unknown[]) => AjvModule.default = (
  (AjvModule as unknown as { default: typeof AjvModule.default }).default ?? AjvModule
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any;

const ajv = new AjvConstructor({ allErrors: true });
const validateConfigSchema = ajv.compile(configSchema);

export function validateConfig(config: unknown): DomainKitConfig {
  const isValid = validateConfigSchema(config);
  if (!isValid && validateConfigSchema.errors) {
    const details = validateConfigSchema.errors
      .map((e) => {
        const field = e.instancePath || '/';
        return `  - ${field}: ${e.message ?? 'validation failed'}`;
      })
      .join('\n');
    throw new Error(`Invalid DomainKit config:\n${details}`);
  }
  return config as DomainKitConfig;
}

export const CONFIG_FILE = '.domainkit/config.yaml';

export async function loadConfig(projectRoot?: string): Promise<DomainKitConfig> {
  const root = await resolveRoot(projectRoot);
  const configPath = join(root, CONFIG_FILE);
  const content = await readFileContent(configPath);
  const parsed = parseYaml<unknown>(content);
  return validateConfig(parsed);
}

export async function saveConfig(config: DomainKitConfig, projectRoot?: string): Promise<void> {
  const root = await resolveRoot(projectRoot);
  const configPath = join(root, CONFIG_FILE);
  const content = stringifyYaml(config);
  await writeFileContent(configPath, content);
}

export async function configExists(projectRoot?: string): Promise<boolean> {
  const root = projectRoot ?? await resolveProjectRoot();
  if (!root) return false;
  return fileExists(join(root, CONFIG_FILE));
}

export function getDefaultConfig(): DomainKitConfig {
  return {
    version: '1',
    skillsDir: '.skills',
    sourceRoot: 'src',
    platform: 'generic',
  };
}

const CANDIDATE_SKILLS_DIRS = [
  '.claude/skills',
  '.agents/skills',
  '.github/skills',
  '.cursor/skills',
  '.skills',
] as const;

export async function detectSkillsDir(projectRoot: string): Promise<string> {
  for (const candidate of CANDIDATE_SKILLS_DIRS) {
    const fullPath = join(projectRoot, candidate);
    if (await dirExists(fullPath)) {
      return candidate;
    }
  }
  return '.skills';
}

async function resolveRoot(projectRoot?: string): Promise<string> {
  const root = projectRoot ?? await resolveProjectRoot();
  if (!root) {
    throw new Error('Could not determine project root. Make sure you are inside a DomainKit project (has .domainkit/ or .git/).');
  }
  return root;
}
