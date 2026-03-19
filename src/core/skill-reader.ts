import { join } from 'node:path';
import fg from 'fast-glob';
import type { Skill, SkillMetadata, Contract } from './types.js';
import { fileExists, readFileContent } from '../utils/fs.js';
import { parseYaml, parseFrontmatter } from '../utils/yaml.js';

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
    typeof data['domainkit-version'] === 'string' ? data['domainkit-version'] : undefined;

  const domainkitDomain =
    typeof data['domainkit-domain'] === 'string' ? data['domainkit-domain'] : undefined;

  const domainkitLastVerified =
    typeof data['domainkit-last-verified'] === 'string'
      ? data['domainkit-last-verified']
      : undefined;

  const domainkitDependencies = toStringArray(data['domainkit-dependencies']);
  const domainkitCodePaths = toStringArray(data['domainkit-code-paths']);
  const domainkitApiRoutes = toStringArray(data['domainkit-api-routes']);

  const metadata: SkillMetadata = {
    name,
    description,
    ...data,
    ...(domain !== undefined && { domain }),
    ...(dependencies !== undefined && { dependencies }),
    ...(domainkitVersion !== undefined && { 'domainkit-version': domainkitVersion }),
    ...(domainkitDomain !== undefined && { 'domainkit-domain': domainkitDomain }),
    ...(domainkitLastVerified !== undefined && { 'domainkit-last-verified': domainkitLastVerified }),
    'domainkit-dependencies': domainkitDependencies.length > 0 ? domainkitDependencies : undefined,
    'domainkit-code-paths': domainkitCodePaths.length > 0 ? domainkitCodePaths : undefined,
    'domainkit-api-routes': domainkitApiRoutes.length > 0 ? domainkitApiRoutes : undefined,
  };

  return metadata;
}
