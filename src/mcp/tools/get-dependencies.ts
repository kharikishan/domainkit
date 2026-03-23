import type { McpResult } from '../types.js';
import { resolveProjectContext } from '../../core/project-context.js';
import { buildDependencyGraph, resolveDependencies } from '../../core/dependency-graph.js';
import { getSkillDomain } from '../../core/constants.js';
import { mcpHandler } from '../handler.js';

export interface GetDependenciesArgs {
  skill: string;
}

export const handler = mcpHandler(async (args: GetDependenciesArgs): Promise<McpResult> => {
  const { skills: allSkills } = await resolveProjectContext();

  const targetSkill = allSkills.find((s) => s.metadata.name === args.skill);
  if (!targetSkill) {
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

  const graph = buildDependencyGraph(allSkills);

  // Resolve all transitive dependencies (includes the skill itself)
  const allResolved = resolveDependencies(graph, [args.skill]);

  // Separate direct deps from transitive-only deps
  const directDeps: string[] = graph.get(args.skill) ?? [];
  const transitiveDeps = allResolved.filter(
    (name) => name !== args.skill && !directDeps.includes(name),
  );

  // Build detailed info for each dependency
  const skillMap = new Map(allSkills.map((s) => [s.metadata.name, s]));

  const buildDepInfo = (name: string) => {
    const s = skillMap.get(name);
    if (!s) return { name, description: null, domain: null };
    return {
      name,
      description: s.metadata.description,
      domain: getSkillDomain(s) || null,
    };
  };

  const result = {
    skill: args.skill,
    directDependencies: directDeps.map(buildDepInfo),
    transitiveDependencies: transitiveDeps.map(buildDepInfo),
    allDependencies: allResolved
      .filter((name) => name !== args.skill)
      .map(buildDepInfo),
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});
