import type { AssembledContext, Skill } from '../core/types.js';
import { getSkillDomain, getSkillDependencies, getSkillCodePaths } from '../core/constants.js';

/**
 * Render an AssembledContext as an XML-style system-prompt block.
 *
 * Structure:
 *   <project>
 *   <domain_index>
 *   | Domain | Description |
 *   ...
 *   </domain_index>
 *   <active_domain name="...">
 *   content
 *   </active_domain>
 *   <dependency name="...">
 *   summary
 *   </dependency>
 *   </project>
 */
export function renderSystemPrompt(context: AssembledContext, _skills: Skill[]): string {
  const lines: string[] = [];

  lines.push('<project>');

  // -------------------------------------------------------------------------
  // Domain index table
  // -------------------------------------------------------------------------
  lines.push('<domain_index>');
  lines.push('| Domain | Description |');
  lines.push('| --- | --- |');

  // Deduplicate by domain — prefer the primary skill's description
  const seen = new Set<string>();
  for (const skill of [...context.primary, ...context.dependencies]) {
    const domain = getSkillDomain(skill, 'unknown');
    if (!seen.has(domain)) {
      seen.add(domain);
      const desc = skill.metadata.description.replace(/\|/g, '\\|');
      lines.push(`| ${domain} | ${desc} |`);
    }
  }

  lines.push('</domain_index>');
  lines.push('');

  // -------------------------------------------------------------------------
  // Primary (active) domains
  // -------------------------------------------------------------------------
  for (const skill of context.primary) {
    lines.push(`<active_domain name="${skill.metadata.name}">`);

    if (skill.metadata.description) {
      lines.push(skill.metadata.description);
      lines.push('');
    }

    const domain = getSkillDomain(skill);
    if (domain) lines.push(`Domain: ${domain}`);

    const deps = getSkillDependencies(skill);
    if (deps.length > 0) {
      lines.push(`Dependencies: ${deps.join(', ')}`);
    }

    const codePaths = getSkillCodePaths(skill);
    if (codePaths.length > 0) {
      lines.push(`Code paths: ${codePaths.join(', ')}`);
    }

    if (skill.body) {
      lines.push('');
      lines.push(skill.body);
    }

    lines.push('</active_domain>');
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Dependencies (index-level summary)
  // -------------------------------------------------------------------------
  for (const skill of context.dependencies) {
    lines.push(`<dependency name="${skill.metadata.name}">`);

    if (skill.metadata.description) {
      lines.push(skill.metadata.description);
    }

    const domain = getSkillDomain(skill);
    if (domain) lines.push(`Domain: ${domain}`);

    const deps = getSkillDependencies(skill);
    if (deps.length > 0) {
      lines.push(`Dependencies: ${deps.join(', ')}`);
    }

    lines.push('</dependency>');
    lines.push('');
  }

  lines.push('</project>');

  return lines.join('\n').trimEnd() + '\n';
}
