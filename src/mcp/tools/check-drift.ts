import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { resolveProjectRoot } from '../../utils/fs.js';

export type McpContent = { type: 'text'; text: string };
export type McpResult = { content: McpContent[] };

export interface CheckDriftArgs {
  skill?: string;
}

export async function handler(args: CheckDriftArgs): Promise<McpResult> {
  try {
    const projectRoot = await resolveProjectRoot();
    if (!projectRoot) {
      return {
        content: [{ type: 'text', text: 'Error: No DomainKit project found in current directory tree.' }],
      };
    }

    const config = await loadConfig(projectRoot);
    const { join } = await import('node:path');
    const skillsRoot = join(projectRoot, config.skillsDir);

    const allSkills = await readAllSkills(skillsRoot);

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

    const sourceRoot = join(projectRoot, config.sourceRoot);
    const threshold = config.drift?.threshold ?? 30;
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
