import type { McpResult } from './types.js';

/**
 * Wrap an MCP tool handler with standardised error handling.
 * If the handler throws, the error is caught and returned as an MCP error response.
 */
export function mcpHandler<T>(
  fn: (args: T) => Promise<McpResult>,
): (args: T) => Promise<McpResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
      };
    }
  };
}
