import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { buildManifest } from '../../core/manifest.js';
import { resolveProjectRoot } from '../../utils/fs.js';

export type McpContent = { type: 'text'; text: string };
export type McpResult = { content: McpContent[] };

export async function handler(): Promise<McpResult> {
  try {
    const projectRoot = await resolveProjectRoot();
    if (!projectRoot) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'No DomainKit project found in current directory tree.' }) }],
      };
    }

    const config = await loadConfig(projectRoot);
    const { join } = await import('node:path');
    const skillsRoot = join(projectRoot, config.skillsDir);

    const skills = await readAllSkills(skillsRoot);
    const manifest = buildManifest(skills);

    const domainsResult: Record<string, { skillCount: number; skills: string[] }> = {};
    for (const [domain, entries] of manifest.domains.entries()) {
      domainsResult[domain] = {
        skillCount: entries.length,
        skills: entries.map((e) => e.name),
      };
    }

    const result = {
      totalSkills: manifest.skills.length,
      totalDomains: manifest.domains.size,
      domains: domainsResult,
      timestamp: manifest.timestamp,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    };
  }
}
