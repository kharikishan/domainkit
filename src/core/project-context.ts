import { join } from 'node:path';
import type { DomainKitConfig, Skill } from './types.js';
import { loadConfig } from './config.js';
import { readAllSkills } from './skill-reader.js';
import { resolveProjectRoot } from '../utils/fs.js';

/**
 * A resolved project context containing all commonly-needed project state.
 * Eliminates repeated bootstrap logic across MCP tools and CLI commands.
 */
export interface ProjectContext {
  projectRoot: string;
  config: DomainKitConfig;
  skillsRoot: string;
  sourceRoot: string;
  skills: Skill[];
}

/**
 * Resolve the full project context: find the project root, load config,
 * resolve paths, and read all skills. Throws if no project is found.
 */
export async function resolveProjectContext(startDir?: string): Promise<ProjectContext> {
  const projectRoot = await resolveProjectRoot(startDir);
  if (!projectRoot) {
    throw new Error('No DomainKit project found in current directory tree.');
  }

  const config = await loadConfig(projectRoot);
  const skillsRoot = join(projectRoot, config.skillsDir);
  const sourceRoot = join(projectRoot, config.sourceRoot);
  const skills = await readAllSkills(skillsRoot);

  return { projectRoot, config, skillsRoot, sourceRoot, skills };
}
