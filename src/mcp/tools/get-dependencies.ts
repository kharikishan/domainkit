import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { buildDependencyGraph, resolveDependencies } from '../../core/dependency-graph.js';
import { resolveProjectRoot } from '../../utils/fs.js';

export type McpContent = { type: 'text'; text: string };
export type McpResult = { content: McpContent[] };

export interface GetDependenciesArgs {
  skill: string;
}

export async function handler(args: GetDependenciesArgs): Promise<McpResult> {
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
        domain: s.metadata['domainkit-domain'] ?? s.metadata.domain ?? null,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
