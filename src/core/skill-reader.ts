import { join } from 'node:path';
import fg from 'fast-glob';
import type { Skill, SkillMetadata, Contract } from './types.js';
import { fileExists, readFileContent } from '../utils/fs.js';
import { parseYaml, parseFrontmatter } from '../utils/yaml.js';
import {
  METADATA_VERSION,
  METADATA_DOMAIN,
  METADATA_LAST_VERIFIED,
  METADATA_DEPENDENCIES,
  METADATA_CODE_PATHS,
  METADATA_API_ROUTES,
} from './constants.js';

const SKILL_FILENAME = 'SKILL.md';
const CONTRACT_RELATIVE_PATH = 'references/contract.yaml';

export async function readSkill(skillDir: string): Promise<Skill> {
  const filePath = join(skillDir, SKILL_FILENAME);
  const rawContent = await readFileContent(filePath);
  const { data, content: body } = parseFrontmatter<Record<string, unknown>>(rawContent);

  const metadata = parseDomainkitMetadata(data);

  const contractPath = join(skillDir, CONTRACT_RELATIVE_PATH);
  const hasContract = await fileExists(contractPath);

  return {
    metadata,
    body: body.trim(),
    filePath,
    dir: skillDir,
    hasContract,
  };
}

export async function readAllSkills(skillsRoot: string): Promise<Skill[]> {
  const pattern = `${skillsRoot}/*/SKILL.md`;
  const skillFiles = await fg(pattern, { onlyFiles: true, absolute: false });

  const skills: Skill[] = [];
  for (const skillFile of skillFiles) {
    // skillFile is e.g. ".skills/my-domain/SKILL.md" — skillDir is the parent
    const skillDir = skillFile.replace(/\/SKILL\.md$/, '');
    const skill = await readSkill(skillDir);
    skills.push(skill);
  }

  return skills;
}

export async function readContract(skillDir: string): Promise<Contract | null> {
  const contractPath = join(skillDir, CONTRACT_RELATIVE_PATH);
  const exists = await fileExists(contractPath);
  if (!exists) return null;

  const content = await readFileContent(contractPath);
  return parseYaml<Contract>(content);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().split(/\s+/);
  }
  return [];
}

function parseDomainkitMetadata(data: Record<string, unknown>): SkillMetadata {
  const name = typeof data['name'] === 'string' ? data['name'] : '';
  const description = typeof data['description'] === 'string' ? data['description'] : '';
  const domain = typeof data['domain'] === 'string' ? data['domain'] : undefined;

  const dependencies = Array.isArray(data['dependencies'])
    ? (data['dependencies'] as unknown[]).map(String)
    : undefined;

  const domainkitVersion =
    typeof data[METADATA_VERSION] === 'string' ? data[METADATA_VERSION] : undefined;

  const domainkitDomain =
    typeof data[METADATA_DOMAIN] === 'string' ? data[METADATA_DOMAIN] : undefined;

  const domainkitLastVerified =
    typeof data[METADATA_LAST_VERIFIED] === 'string'
      ? data[METADATA_LAST_VERIFIED]
      : undefined;

  const domainkitDependencies = toStringArray(data[METADATA_DEPENDENCIES]);
  const domainkitCodePaths = toStringArray(data[METADATA_CODE_PATHS]);
  const domainkitApiRoutes = toStringArray(data[METADATA_API_ROUTES]);

  const metadata: SkillMetadata = {
    name,
    description,
    ...data,
    ...(domain !== undefined && { domain }),
    ...(dependencies !== undefined && { dependencies }),
    ...(domainkitVersion !== undefined && { [METADATA_VERSION]: domainkitVersion }),
    ...(domainkitDomain !== undefined && { [METADATA_DOMAIN]: domainkitDomain }),
    ...(domainkitLastVerified !== undefined && { [METADATA_LAST_VERIFIED]: domainkitLastVerified }),
    [METADATA_DEPENDENCIES]: domainkitDependencies.length > 0 ? domainkitDependencies : undefined,
    [METADATA_CODE_PATHS]: domainkitCodePaths.length > 0 ? domainkitCodePaths : undefined,
    [METADATA_API_ROUTES]: domainkitApiRoutes.length > 0 ? domainkitApiRoutes : undefined,
  };

  return metadata;
}
