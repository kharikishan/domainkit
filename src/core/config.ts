import { join } from 'node:path';
import type { DomainKitConfig } from './types.js';
import { fileExists, dirExists, readFileContent, writeFileContent, resolveProjectRoot } from '../utils/fs.js';
import { parseYaml, stringifyYaml } from '../utils/yaml.js';

export const CONFIG_FILE = '.domainkit/config.yaml';

export async function loadConfig(projectRoot?: string): Promise<DomainKitConfig> {
  const root = await resolveRoot(projectRoot);
  const configPath = join(root, CONFIG_FILE);
  const content = await readFileContent(configPath);
  return parseYaml<DomainKitConfig>(content);
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
