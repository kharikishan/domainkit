import type { McpResult } from '../types.js';
import { resolveProjectContext } from '../../core/project-context.js';
import { buildManifest } from '../../core/manifest.js';
import { mcpHandler } from '../handler.js';

export const handler = mcpHandler(async (_args: Record<string, never>): Promise<McpResult> => {
  const { skills } = await resolveProjectContext();
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
});
