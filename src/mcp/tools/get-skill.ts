import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { resolveProjectRoot } from '../../utils/fs.js';
import type { ContextDepth } from '../../core/types.js';

export type McpContent = { type: 'text'; text: string };
export type McpResult = { content: McpContent[] };

export interface GetSkillArgs {
  name: string;
  depth?: string;
}

export async function handler(args: GetSkillArgs): Promise<McpResult> {
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

    // Build the response based on requested depth
    const result: Record<string, unknown> = {
      name: skill.metadata.name,
      domain: skill.metadata['domainkit-domain'] ?? skill.metadata.domain ?? '',
      description: skill.metadata.description,
      filePath: skill.filePath,
      hasContract: skill.hasContract,
    };

    if (depth === 'contract' || depth === 'full') {
      result['metadata'] = skill.metadata;
    }

    if (depth === 'full') {
      result['body'] = skill.body;

      // Attempt to read contract file if present
      if (skill.hasContract) {
        try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
