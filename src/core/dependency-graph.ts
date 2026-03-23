import type { Skill } from './types.js';
import { getSkillDependencies } from './constants.js';

/** Build a map of skill name -> list of dependency names. */
export function buildDependencyGraph(skills: Skill[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const skill of skills) {
    graph.set(skill.metadata.name, getSkillDependencies(skill));
  }
  return graph;
}

/**
 * BFS traversal from the given skill names, collecting all transitive dependencies.
 * Returns a deduplicated list of all skill names reachable (including the seeds themselves).
 * Cycles are handled safely by tracking visited nodes.
 */
export function resolveDependencies(
  graph: Map<string, string[]>,
  skillNames: string[],
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [...skillNames];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = graph.get(current) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return Array.from(visited);
}

/**
 * DFS-based cycle detection.
 * Returns an array of cycle paths, where each path is the ordered list of node names
 * forming the cycle (last element repeats the first to close the loop).
 */
export function detectCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (stack.has(node)) {
      // Found a cycle — extract the cycle portion from `path`
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      cycles.push(cycle);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      dfs(dep);
    }

    path.pop();
    stack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  return cycles;
}

/**
 * Get all transitive dependencies for a single skill (not including itself).
 */
export function getTransitiveDependencies(
  graph: Map<string, string[]>,
  skillName: string,
): string[] {
  const all = resolveDependencies(graph, [skillName]);
  return all.filter((name) => name !== skillName);
}
