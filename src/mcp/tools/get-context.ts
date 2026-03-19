import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { resolveProjectRoot } from '../../utils/fs.js';
import type { OutputFormat } from '../../core/types.js';

export type McpContent = { type: 'text'; text: string };
export type McpResult = { content: McpContent[] };

export interface GetContextArgs {
  task?: string;
  domains?: string[];
  budget?: number;
  format?: string;
}

export async function handler(args: GetContextArgs): Promise<McpResult> {
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

    // Determine which skill names to select
    let selectedSkills: string[] = [];

    if (args.task) {
      // Use matcher to find relevant domains / skills by task description
      const { matchTaskToDomains } = await import('../../core/matcher.js');
      const matches = await matchTaskToDomains(args.task, allSkills);
      // Take strong matches, or top-3 if none qualify as strong
      const strong = matches.filter((m) => m.strength === 'strong');
      const chosen = strong.length > 0 ? strong : matches.slice(0, 3);
      selectedSkills = chosen.map((m) => m.skill);
    }

    // If domains are specified, add all skills in those domains
    if (args.domains && args.domains.length > 0) {
      const domainSet = new Set(args.domains);
      for (const skill of allSkills) {
        const skillDomain = skill.metadata['domainkit-domain'] ?? skill.metadata.domain ?? '';
        if (domainSet.has(skillDomain) && !selectedSkills.includes(skill.metadata.name)) {
          selectedSkills.push(skill.metadata.name);
        }
      }
    }

    // Fall back to all skills if nothing selected
    if (selectedSkills.length === 0) {
      selectedSkills = allSkills.map((s) => s.metadata.name);
    }

    const budget = args.budget ?? config.context?.defaultBudget ?? 8000;
    const rawFormat = args.format ?? config.context?.defaultFormat ?? 'markdown';
    const format = rawFormat as OutputFormat;

    const { assembleContext } = await import('../../core/assembler.js');
    const assembled = await assembleContext({
      skills: allSkills,
      selectedSkills,
      budget,
      format,
    });

    const { renderContext } = await import('../../formats/index.js');
    const rendered = renderContext(assembled, allSkills, format);

    return {
      content: [{ type: 'text', text: rendered }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
