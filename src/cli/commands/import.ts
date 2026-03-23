import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../../core/config.js';
import { info, error, success } from '../../utils/logger.js';

export function register(program: Command): void {
  const importCmd = program
    .command('import')
    .description('Import skills from API specifications');

  importCmd
    .command('openapi <spec-file>')
    .description('Generate skills from an OpenAPI/Swagger specification')
    .action(async (specFile: string) => {
      try {
        const config = await loadConfig();
        const skillsDir = resolve(process.cwd(), config.skillsDir);
        const specPath = resolve(process.cwd(), specFile);

        const { importOpenAPI } = await import('../../generate/openapi-importer.js');
        const created = await importOpenAPI(specPath, skillsDir);

        if (created.length === 0) {
          info('No skills generated — the spec may be empty or unsupported.');
          return;
        }

        success(`\nImported ${created.length} skill(s) from OpenAPI spec:`);
        for (const name of created) {
          info(`  - ${name}`);
        }
      } catch (err) {
        error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
