import { Command } from 'commander';
import { info, error } from '../../utils/logger.js';

export function register(program: Command): void {
  program
    .command('serve')
    .description('Start the DomainKit MCP server')
    .option('-p, --port <port>', 'Port for SSE transport')
    .option('--transport <type>', 'Transport type (stdio, sse)', 'stdio')
    .action(async (options) => {
      try {
        const { startMcpServer } = await import('../../mcp/server.js');
        info('Starting DomainKit MCP server...');
        await startMcpServer({
          transport: options.transport as 'stdio' | 'sse',
          port: options.port ? parseInt(options.port, 10) : undefined,
        });
      } catch (err) {
        error(`MCP server failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
