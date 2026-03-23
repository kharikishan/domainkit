import type { AssembledContext, Skill } from '../core/types.js';
import {
  getSkillDomain,
  getSkillDependencies,
  getSkillCodePaths,
  METADATA_API_ROUTES,
  METADATA_LAST_VERIFIED,
} from '../core/constants.js';

/**
 * Render an AssembledContext as plain Markdown.
 *
 * Structure:
 *   # Domain Context
 *   ## {name}          <- primary skills
 *   ### Dependencies   <- dependency skills section
 *   #### {name}        <- each dependency
 */
export function renderMarkdown(context: AssembledContext, _skills: Skill[]): string {
  const lines: string[] = [];

  lines.push('# Domain Context', '');

  // -------------------------------------------------------------------------
  // Primary skills
  // -------------------------------------------------------------------------
  for (const skill of context.primary) {
    lines.push(`## ${skill.metadata.name}`, '');

    if (skill.metadata.description) {
      lines.push(skill.metadata.description, '');
    }

    const domain = getSkillDomain(skill);
    if (domain) lines.push(`- **Domain:** ${domain}`);

    const deps = getSkillDependencies(skill);
    if (deps.length > 0) {
      lines.push(`- **Dependencies:** ${deps.join(', ')}`);
    }

    const codePaths = getSkillCodePaths(skill);
    if (codePaths.length > 0) {
      lines.push(`- **Code paths:** ${codePaths.join(', ')}`);
    }

    const apiRoutes = skill.metadata[METADATA_API_ROUTES];
    if (Array.isArray(apiRoutes) && apiRoutes.length > 0) {
      lines.push(`- **API routes:** ${apiRoutes.join(', ')}`);
    }

    const lastVerified = skill.metadata[METADATA_LAST_VERIFIED];
    if (lastVerified) {
      lines.push(`- **Last verified:** ${lastVerified}`);
    }

    lines.push('');

    if (skill.body) {
      lines.push(skill.body, '');
    }
  }

  // -------------------------------------------------------------------------
  // Dependency skills (index-level summary)
  // -------------------------------------------------------------------------
  if (context.dependencies.length > 0) {
    lines.push('---', '');
    lines.push('### Dependencies', '');

    for (const skill of context.dependencies) {
      lines.push(`#### ${skill.metadata.name}`, '');

      if (skill.metadata.description) {
        lines.push(skill.metadata.description, '');
      }

      const domain = getSkillDomain(skill);
      if (domain) lines.push(`- **Domain:** ${domain}`);

      const deps = getSkillDependencies(skill);
      if (deps.length > 0) {
        lines.push(`- **Dependencies:** ${deps.join(', ')}`);
      }

      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
