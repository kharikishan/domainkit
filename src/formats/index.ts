import type { AssembledContext, Skill } from '../core/types.js';
import { renderClaude } from './claude.js';
import { renderSystemPrompt } from './system-prompt.js';
import { renderMarkdown } from './markdown.js';

export type { OutputFormat } from '../core/types.js';

/**
 * Dispatch rendering to the appropriate format renderer.
 *
 * @param context  The assembled context (primary + dependency skills + budget).
 * @param skills   The full list of available skills (passed through to renderers).
 * @param format   The desired output format.
 * @returns        The rendered string ready to inject into an agent prompt or file.
 */
export function renderContext(
  context: AssembledContext,
  skills: Skill[],
  format: import('../core/types.js').OutputFormat,
): string {
  switch (format) {
    case 'claude':
      return renderClaude(context, skills);
    case 'system-prompt':
      return renderSystemPrompt(context, skills);
    case 'markdown':
      return renderMarkdown(context, skills);
    default: {
      // Exhaustiveness guard — TypeScript will catch this at compile time
      const _exhaustive: never = format;
      throw new Error(`Unknown output format: ${String(_exhaustive)}`);
    }
  }
}
