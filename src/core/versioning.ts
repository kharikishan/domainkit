import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Skill } from './types.js';

export interface VersionEntry {
  hash: string;
  timestamp: string;
  previousHash: string | null;
}

export function computeSkillHash(skill: Skill): string {
  return createHash('sha256').update(skill.body).digest('hex').slice(0, 12);
}

export async function trackVersion(skill: Skill, historyDir: string): Promise<void> {
  if (!existsSync(historyDir)) {
    await mkdir(historyDir, { recursive: true });
  }

  const hash = computeSkillHash(skill);
  const filePath = join(historyDir, `${skill.metadata.name}.jsonl`);

  let previousHash: string | null = null;
  if (existsSync(filePath)) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      const lastEntry = JSON.parse(lines[lines.length - 1]) as VersionEntry;
      previousHash = lastEntry.hash;
    }
  }

  // Skip if hash hasn't changed
  if (previousHash === hash) return;

  const entry: VersionEntry = {
    hash,
    timestamp: new Date().toISOString(),
    previousHash,
  };

  await appendFile(filePath, JSON.stringify(entry) + '\n');
}

export async function getVersionHistory(skillName: string, historyDir: string): Promise<VersionEntry[]> {
  const filePath = join(historyDir, `${skillName}.jsonl`);
  if (!existsSync(filePath)) return [];

  const content = await readFile(filePath, 'utf-8');
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as VersionEntry);
}

export function hasChanged(skill: Skill, previousHash: string | null): boolean {
  if (!previousHash) return true;
  return computeSkillHash(skill) !== previousHash;
}
