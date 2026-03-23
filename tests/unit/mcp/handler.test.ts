import { describe, it, expect } from 'vitest';
import { mcpHandler } from '../../../src/mcp/handler.js';
import type { McpResult } from '../../../src/mcp/types.js';

describe('mcpHandler', () => {
  it('passes args through and returns the result', async () => {
    const wrapped = mcpHandler(async (args: { value: number }): Promise<McpResult> => {
      return { content: [{ type: 'text', text: String(args.value) }] };
    });

    const result = await wrapped({ value: 42 });
    expect(result.content[0].text).toBe('42');
  });

  it('catches errors and returns an MCP error response', async () => {
    const wrapped = mcpHandler(async (): Promise<McpResult> => {
      throw new Error('something went wrong');
    });

    const result = await wrapped({});
    expect(result.content[0].text).toBe('Error: something went wrong');
  });

  it('handles non-Error throws', async () => {
    const wrapped = mcpHandler(async (): Promise<McpResult> => {
      throw 'raw string error';
    });

    const result = await wrapped({});
    expect(result.content[0].text).toBe('Error: raw string error');
  });
});
