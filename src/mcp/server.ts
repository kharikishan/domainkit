/**
 * DomainKit MCP server entry point.
 *
 * All MCP SDK imports are lazy via requireOptional so the rest of the CLI
 * continues to work without `@modelcontextprotocol/sdk` installed.
 */

import { requireOptional } from '../utils/optional-import.js';

export interface McpServerOptions {
  transport?: 'stdio' | 'sse';
  port?: number;
}

export async function startMcpServer(options: McpServerOptions = {}): Promise<void> {
  const { transport: transportKind = 'stdio' } = options;

  // ---------------------------------------------------------------------------
  // Lazy-load the MCP SDK and zod (zod is a transitive dep of the SDK)
  // ---------------------------------------------------------------------------
  const { McpServer } = await requireOptional<
    typeof import('@modelcontextprotocol/sdk/server/mcp.js')
  >('@modelcontextprotocol/sdk/server/mcp.js', 'MCP server');

  const { StdioServerTransport } = await requireOptional<
    typeof import('@modelcontextprotocol/sdk/server/stdio.js')
  >('@modelcontextprotocol/sdk/server/stdio.js', 'MCP server');

  // zod is a transitive dependency of @modelcontextprotocol/sdk.
  // We import it at runtime only; we cast to `any` to avoid requiring zod in
  // the project's own package.json while still calling its fluent API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const z = await requireOptional<any>('zod', 'MCP server');

  // ---------------------------------------------------------------------------
  // Create the high-level McpServer instance.
  // Cast to `any` for tool registration so TypeScript does not complain about
  // the zod schema shapes (which are real at runtime but opaque to the compiler
  // because zod is not a direct project dependency).
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = new McpServer({ name: 'domainkit', version: '0.1.0' }) as any;

  // ---------------------------------------------------------------------------
  // Tool: list_domains
  // ---------------------------------------------------------------------------
  server.tool(
    'list_domains',
    'List all domains and their skills in the DomainKit project.',
    {},
    async () => {
      const { handler } = await import('./tools/list-domains.js');
      return handler({});
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_context
  // ---------------------------------------------------------------------------
  server.tool(
    'get_context',
    'Assemble and return context for a given task description or explicit domain list.',
    {
      task: z.string().optional().describe(
        'Natural-language task description used to find relevant domains.',
      ),
      domains: z.array(z.string()).optional().describe(
        'Explicit list of domain names to include.',
      ),
      budget: z.number().optional().describe(
        'Token budget cap (default: 8000).',
      ),
      format: z.enum(['claude', 'system-prompt', 'markdown']).optional().describe(
        'Output format (default: markdown).',
      ),
    },
    async (args: { task?: string; domains?: string[]; budget?: number; format?: string }) => {
      const { handler } = await import('./tools/get-context.js');
      return handler(args);
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_skill
  // ---------------------------------------------------------------------------
  server.tool(
    'get_skill',
    'Read a specific skill by name and return its content at a requested depth.',
    {
      name: z.string().describe(
        "The skill name to retrieve (as declared in the skill's frontmatter).",
      ),
      depth: z.enum(['index', 'contract', 'full']).optional().describe(
        'Detail level: index (summary), contract (metadata + schema), full (body + contract).',
      ),
    },
    async (args: { name: string; depth?: string }) => {
      const { handler } = await import('./tools/get-skill.js');
      return handler(args);
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: check_drift
  // ---------------------------------------------------------------------------
  server.tool(
    'check_drift',
    'Run drift detection on all skills or a specific skill and return the results.',
    {
      skill: z.string().optional().describe(
        'Name of a specific skill to check. Omit to check all skills.',
      ),
    },
    async (args: { skill?: string }) => {
      const { handler } = await import('./tools/check-drift.js');
      return handler(args);
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_dependencies
  // ---------------------------------------------------------------------------
  server.tool(
    'get_dependencies',
    'Return the direct and transitive dependency graph for a given skill.',
    {
      skill: z.string().describe(
        'The skill name whose dependency graph should be resolved.',
      ),
    },
    async (args: { skill: string }) => {
      const { handler } = await import('./tools/get-dependencies.js');
      return handler(args);
    },
  );

  // ---------------------------------------------------------------------------
  // Connect transport
  // ---------------------------------------------------------------------------
  if (transportKind === 'sse') {
    throw new Error(`SSE transport is not yet supported. Use "stdio".`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
