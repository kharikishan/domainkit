import { Command } from 'commander';
import { join } from 'node:path';
import * as logger from '../../utils/logger.js';
import { resolveProjectRoot } from '../../utils/fs.js';
import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { printTable } from '../ui/table.js';
import { buildManifest } from '../../core/manifest.js';

export function register(program: Command): void {
  program
    .command('list')
    .description('List all skills in the project')
    .option('--json', 'Output as JSON')
    .option('--domain <domain>', 'Filter by domain')
    .action(async (opts) => {
      try {
        const projectRoot = await resolveProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a DomainKit project. Run "dk init" first.');
          process.exit(1);
        }

        const config = await loadConfig(projectRoot);
        const skillsRoot = join(projectRoot, config.skillsDir);
        const skills = await readAllSkills(skillsRoot);

        const manifest = buildManifest(skills, 'uncategorised');

        let entries = manifest.skills;

        if (opts.domain) {
          entries = entries.filter(
            (e) => e.domain.toLowerCase() === (opts.domain as string).toLowerCase(),
          );
        }

        if (entries.length === 0) {
          logger.info('No skills found.');
          return;
        }

        if (opts.json) {
          // Serialise the Map to a plain object for JSON output
          const output = {
            ...manifest,
            skills: entries,
            domains: Object.fromEntries(manifest.domains),
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        const headers = ['Name', 'Domain', 'Description', 'Dependencies', 'Last Verified'];
        const rows: string[][] = entries.map((e) => [
          e.name,
          e.domain || '-',
          e.description || '-',
          e.dependencies.length > 0 ? e.dependencies.join(', ') : '-',
          e.lastVerified ?? '-',
        ]);

        printTable(headers, rows);
        logger.info(`\n${entries.length} skill(s) found.`);
      } catch (err) {
        logger.error(`List failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
