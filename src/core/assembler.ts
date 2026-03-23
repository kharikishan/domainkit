import type { Skill, AssembledContext, OutputFormat, ContextDepth, TokenBudget } from './types.js';
import { buildDependencyGraph, resolveDependencies } from './dependency-graph.js';
import { createBudget, estimateSkillTokens, fitsInBudget, consumeBudget } from './token-counter.js';

const DEFAULT_BUDGET = 8000;
const DEFAULT_DEPTH: ContextDepth = 'contract';

export interface AssembleOptions {
  /** The full list of available skills (used to build the dependency graph). */
  skills: Skill[];
  /** Names of the skills explicitly requested by the caller. */
  selectedSkills: string[];
  /** Token budget cap (defaults to 8000). */
  budget?: number;
  /** How much detail to include for primary skills (defaults to 'contract'). */
  depth?: ContextDepth;
  /** Output format tag stored on the result (rendering happens separately). */
  format?: OutputFormat;
}

/** Find a skill by name from a list. */
function findSkill(skills: Skill[], name: string): Skill | undefined {
  return skills.find((s) => s.metadata.name === name);
}

export async function assembleContext(options: AssembleOptions): Promise<AssembledContext> {
  const {
    skills,
    selectedSkills,
    budget: budgetTotal = DEFAULT_BUDGET,
    depth = DEFAULT_DEPTH,
    format = 'markdown',
  } = options;

  // Step 1: Build the full dependency graph from all available skills
  const graph = buildDependencyGraph(skills);

  // Step 2: Resolve all transitive dependencies for the selected skills
  const allRequired = resolveDependencies(graph, selectedSkills);

  // Separate primary skills from their pure dependencies
  const selectedSet = new Set(selectedSkills);
  const dependencyNames = allRequired.filter((name) => !selectedSet.has(name));

  // Resolve actual Skill objects (skip any names that don't resolve)
  const primarySkills: Skill[] = selectedSkills
    .map((name) => findSkill(skills, name))
    .filter((s): s is Skill => s !== undefined);

  const dependencySkills: Skill[] = dependencyNames
    .map((name) => findSkill(skills, name))
    .filter((s): s is Skill => s !== undefined);

  // Step 3: Create token budget
  let budget: TokenBudget = createBudget(budgetTotal);

  // Step 4: Consume tokens for primary skills at the requested depth
  const includedPrimary: Skill[] = [];
  for (const skill of primarySkills) {
    const tokens = estimateSkillTokens(skill, depth);
    if (fitsInBudget(budget, tokens)) {
      budget = consumeBudget(budget, tokens);
      includedPrimary.push(skill);
    }
  }

  // Step 5: Consume tokens for dependency skills at 'index' depth
  const includedDeps: Skill[] = [];
  for (const skill of dependencySkills) {
    const tokens = estimateSkillTokens(skill, 'index');
    if (fitsInBudget(budget, tokens)) {
      budget = consumeBudget(budget, tokens);
      includedDeps.push(skill);
    }
    // Skills that don't fit are silently dropped (lowest-priority deps first,
    // since dependencyNames is already ordered by BFS traversal distance)
  }

  // Step 7: Return the assembled context; rendering is handled by format modules
  return {
    primary: includedPrimary,
    dependencies: includedDeps,
    format,
    budget,
    rendered: '',
  };
}
