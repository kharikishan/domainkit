import type { AssembledContext, Skill } from '../core/types.js';

/**
 * Render an AssembledContext as plain Markdown.
 *
 * Structure:
 *   # Domain Context
 *   ## {name}          <- primary skills
 *   ### Dependencies   <- dependency skills section
 *   #### {name}        <- each dependency
 */
export function renderMarkdown(context: AssembledContext, skills: Skill[]): string {
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

    const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'];
    if (domain) lines.push(`- **Domain:** ${domain}`);

    const deps =
      skill.metadata['domainkit-dependencies'] ?? skill.metadata.dependencies;
    if (Array.isArray(deps) && deps.length > 0) {
      lines.push(`- **Dependencies:** ${deps.join(', ')}`);
    }

    const codePaths = skill.metadata['domainkit-code-paths'];
    if (Array.isArray(codePaths) && codePaths.length > 0) {
      lines.push(`- **Code paths:** ${codePaths.join(', ')}`);
    }

    const apiRoutes = skill.metadata['domainkit-api-routes'];
    if (Array.isArray(apiRoutes) && apiRoutes.length > 0) {
      lines.push(`- **API routes:** ${apiRoutes.join(', ')}`);
    }

    const lastVerified = skill.metadata['domainkit-last-verified'];
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

      const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'];
      if (domain) lines.push(`- **Domain:** ${domain}`);

      const deps =
        skill.metadata['domainkit-dependencies'] ?? skill.metadata.dependencies;
      if (Array.isArray(deps) && deps.length > 0) {
        lines.push(`- **Dependencies:** ${deps.join(', ')}`);
      }

      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
