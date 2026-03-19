import type { AssembledContext, Skill } from '../core/types.js';

/**
 * Render an AssembledContext as a CLAUDE.md-style document.
 *
 * Structure:
 *   # Domain Context
 *   | Domain | Skills | Status |   <- index table
 *   ## {name}                       <- primary skills (full content per depth)
 *   ## [dep] {name}                 <- dependency skills (index-level summary)
 */
export function renderClaude(context: AssembledContext, skills: Skill[]): string {
  const lines: string[] = [];

  lines.push('# Domain Context', '');

  // -------------------------------------------------------------------------
  // Domain index table
  // -------------------------------------------------------------------------

  // Collect all domains represented in primary + dependency skills
  const domainMap = new Map<string, { names: string[]; status: string }>();

  for (const skill of context.primary) {
    const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'] ?? 'unknown';
    if (!domainMap.has(domain)) domainMap.set(domain, { names: [], status: 'active' });
    domainMap.get(domain)!.names.push(skill.metadata.name);
  }
  for (const skill of context.dependencies) {
    const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'] ?? 'unknown';
    if (!domainMap.has(domain)) domainMap.set(domain, { names: [], status: 'dependency' });
    domainMap.get(domain)!.names.push(skill.metadata.name);
  }

  lines.push('| Domain | Skills | Status |');
  lines.push('| --- | --- | --- |');
  for (const [domain, { names, status }] of domainMap) {
    lines.push(`| ${domain} | ${names.join(', ')} | ${status} |`);
  }
  lines.push('');

  // -------------------------------------------------------------------------
  // Primary skills
  // -------------------------------------------------------------------------
  for (const skill of context.primary) {
    lines.push(`## ${skill.metadata.name}`, '');

    if (skill.metadata.description) {
      lines.push(`> ${skill.metadata.description}`, '');
    }

    const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'];
    if (domain) lines.push(`**Domain:** ${domain}  `);

    const deps =
      skill.metadata['domainkit-dependencies'] ?? skill.metadata.dependencies;
    if (Array.isArray(deps) && deps.length > 0) {
      lines.push(`**Dependencies:** ${deps.join(', ')}  `);
    }

    const codePaths = skill.metadata['domainkit-code-paths'];
    if (Array.isArray(codePaths) && codePaths.length > 0) {
      lines.push(`**Code paths:** ${codePaths.join(', ')}  `);
    }

    if (skill.metadata.domain || skill.metadata['domainkit-domain'] || deps) {
      lines.push('');
    }

    if (skill.body) {
      lines.push(skill.body, '');
    }
  }

  // -------------------------------------------------------------------------
  // Dependency skills (index-level)
  // -------------------------------------------------------------------------
  if (context.dependencies.length > 0) {
    for (const skill of context.dependencies) {
      lines.push(`## [dep] ${skill.metadata.name}`, '');

      if (skill.metadata.description) {
        lines.push(`> ${skill.metadata.description}`, '');
      }

      const domain = skill.metadata.domain ?? skill.metadata['domainkit-domain'];
      if (domain) lines.push(`**Domain:** ${domain}  `);

      const deps =
        skill.metadata['domainkit-dependencies'] ?? skill.metadata.dependencies;
      if (Array.isArray(deps) && deps.length > 0) {
        lines.push(`**Dependencies:** ${deps.join(', ')}  `);
      }

      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
