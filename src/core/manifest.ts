import { join } from 'node:path';
import type { Manifest, ManifestEntry, Skill } from './types.js';
import { ensureDir, fileExists, readFileContent, writeFileContent } from '../utils/fs.js';

export function buildManifest(skills: Skill[]): Manifest {
  const entries: ManifestEntry[] = skills.map((skill) => ({
    name: skill.metadata.name,
    domain: skill.metadata['domainkit-domain'] ?? skill.metadata.domain ?? '',
    description: skill.metadata.description,
    dependencies: skill.metadata['domainkit-dependencies'] ?? skill.metadata.dependencies ?? [],
    codePaths: skill.metadata['domainkit-code-paths'] ?? [],
    lastVerified: skill.metadata['domainkit-last-verified'] ?? null,
    filePath: skill.filePath,
    hasContract: skill.hasContract,
  }));

  const domains = new Map<string, ManifestEntry[]>();
  for (const entry of entries) {
    const key = entry.domain;
    const existing = domains.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      domains.set(key, [entry]);
    }
  }

  return {
    skills: entries,
    domains,
    timestamp: new Date().toISOString(),
  };
}

export function getSkillByName(manifest: Manifest, name: string): ManifestEntry | undefined {
  return manifest.skills.find((entry) => entry.name === name);
}

export function getSkillsByDomain(manifest: Manifest, domain: string): ManifestEntry[] {
  return manifest.domains.get(domain) ?? [];
}

export async function saveManifest(manifest: Manifest, configDir: string): Promise<void> {
  await ensureDir(configDir);
  const filePath = join(configDir, 'manifest.json');
  const serializable = {
    skills: manifest.skills,
    domains: Object.fromEntries(manifest.domains),
    timestamp: manifest.timestamp,
  };
  await writeFileContent(filePath, JSON.stringify(serializable, null, 2));
}

export async function loadManifest(configDir: string): Promise<Manifest | null> {
  const filePath = join(configDir, 'manifest.json');
  if (!(await fileExists(filePath))) {
    return null;
  }
  const raw = JSON.parse(await readFileContent(filePath));
  const domains = new Map<string, ManifestEntry[]>(Object.entries(raw.domains));
  return {
    skills: raw.skills,
    domains,
    timestamp: raw.timestamp,
  };
}
