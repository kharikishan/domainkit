import type { McpResult } from '../types.js';
import type { OutputFormat } from '../../core/types.js';
import { resolveProjectContext } from '../../core/project-context.js';
import { getSkillDomain, DEFAULT_TOKEN_BUDGET } from '../../core/constants.js';
import { mcpHandler } from '../handler.js';

export interface GetContextArgs {
  task?: string;
  domains?: string[];
  budget?: number;
  format?: string;
}

export const handler = mcpHandler(async (args: GetContextArgs): Promise<McpResult> => {
  const { config, skills: allSkills } = await resolveProjectContext();

  // Determine which skill names to select
  let selectedSkills: string[] = [];

  if (args.task) {
    const { matchTaskToDomains } = await import('../../core/matcher.js');
    const matches = await matchTaskToDomains(args.task, allSkills);
    const strong = matches.filter((m) => m.strength === 'strong');
    const chosen = strong.length > 0 ? strong : matches.slice(0, 3);
    selectedSkills = chosen.map((m) => m.skill);
  }

  // If domains are specified, add all skills in those domains
  if (args.domains && args.domains.length > 0) {
    const domainSet = new Set(args.domains);
    for (const skill of allSkills) {
      const skillDomain = getSkillDomain(skill);
      if (domainSet.has(skillDomain) && !selectedSkills.includes(skill.metadata.name)) {
        selectedSkills.push(skill.metadata.name);
      }
    }
  }

  // Fall back to all skills if nothing selected
  if (selectedSkills.length === 0) {
    selectedSkills = allSkills.map((s) => s.metadata.name);
  }

  const budget = args.budget ?? config.context?.defaultBudget ?? DEFAULT_TOKEN_BUDGET;
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
});
