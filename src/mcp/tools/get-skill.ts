import type { McpResult } from '../types.js';
import type { ContextDepth } from '../../core/types.js';
import { resolveProjectContext } from '../../core/project-context.js';
import { getSkillDomain } from '../../core/constants.js';
import { mcpHandler } from '../handler.js';

export interface GetSkillArgs {
  name: string;
  depth?: string;
}

export const handler = mcpHandler(async (args: GetSkillArgs): Promise<McpResult> => {
  const { config, skills: allSkills } = await resolveProjectContext();
  const skill = allSkills.find((s) => s.metadata.name === args.name);

  if (!skill) {
    const allNames = allSkills.map((s) => s.metadata.name);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `Skill "${args.name}" not found.`,
            availableSkills: allNames,
          }),
        },
      ],
    };
  }

  const depth = (args.depth ?? config.context?.defaultDepth ?? 'contract') as ContextDepth;

  const result: Record<string, unknown> = {
    name: skill.metadata.name,
    domain: getSkillDomain(skill),
    description: skill.metadata.description,
    filePath: skill.filePath,
    hasContract: skill.hasContract,
  };

  if (depth === 'contract' || depth === 'full') {
    result['metadata'] = skill.metadata;
  }

  if (depth === 'full') {
    result['body'] = skill.body;

    if (skill.hasContract) {
      try {
        const { join } = await import('node:path');
        const { readFileContent } = await import('../../utils/fs.js');
        const { parseYaml } = await import('../../utils/yaml.js');
        const contractPath = join(skill.dir, 'references/contract.yaml');
        const contractContent = await readFileContent(contractPath);
        result['contract'] = parseYaml(contractContent);
      } catch {
        // Contract may be missing or unparseable — just skip it
      }
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});
