import type { McpResult } from '../types.js';
import { resolveProjectContext } from '../../core/project-context.js';
import { DEFAULT_STALENESS_THRESHOLD } from '../../core/constants.js';
import { mcpHandler } from '../handler.js';

export interface CheckDriftArgs {
  skill?: string;
}

export const handler = mcpHandler(async (args: CheckDriftArgs): Promise<McpResult> => {
  const { config, sourceRoot, skills: allSkills } = await resolveProjectContext();

  // Filter to a single skill if requested
  let skillsToCheck = allSkills;
  if (args.skill) {
    skillsToCheck = allSkills.filter((s) => s.metadata.name === args.skill);
    if (skillsToCheck.length === 0) {
      const allNames = allSkills.map((s) => s.metadata.name);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Skill "${args.skill}" not found.`,
              availableSkills: allNames,
            }),
          },
        ],
      };
    }
  }

  const { runDriftCheck } = await import('../../drift/reporter.js');

  const threshold = config.drift?.threshold ?? DEFAULT_STALENESS_THRESHOLD;
  const strategies = config.drift?.strategies ?? ['staleness', 'file-coverage'];

  const results = await runDriftCheck({
    skills: skillsToCheck,
    sourceRoot,
    threshold,
    strategies,
  });

  const summary = {
    checked: results.length,
    fresh: results.filter((r) => r.status === 'fresh').length,
    stale: results.filter((r) => r.status === 'stale').length,
    drifted: results.filter((r) => r.status === 'drifted').length,
    results,
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
  };
});
