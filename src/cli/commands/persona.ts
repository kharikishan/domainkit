import { Command } from 'commander';
import { join } from 'node:path';
import * as logger from '../../utils/logger.js';
import { ensureDir, writeFileContent, resolveProjectRoot } from '../../utils/fs.js';
import { stringifyYaml } from '../../utils/yaml.js';
import { listPersonas, getPersona } from '../../personas/index.js';

export function register(program: Command): void {
  const persona = program
    .command('persona')
    .description('Manage persona definitions for skill generation');

  persona
    .command('list')
    .description('List all available personas (built-in + custom)')
    .action(async () => {
      try {
        const projectRoot = await resolveProjectRoot();
        const personas = await listPersonas(projectRoot ?? undefined);

        if (personas.length === 0) {
          logger.info('No personas found.');
          return;
        }

        logger.info(`Available personas (${personas.length}):\n`);
        for (const p of personas) {
          const tag = p.id.includes('+') ? 'custom' : 'built-in';
          logger.info(`  ${p.id.padEnd(20)} ${p.name} (${tag})`);
          logger.info(`  ${''.padEnd(20)} ${p.description}`);
          logger.info('');
        }
      } catch (err) {
        logger.error(`Failed to list personas: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  persona
    .command('show <id>')
    .description('Show details of a specific persona')
    .action(async (id: string) => {
      try {
        const projectRoot = await resolveProjectRoot();
        const p = await getPersona(id, projectRoot ?? undefined);

        if (!p) {
          logger.error(`Persona "${id}" not found. Run "dk persona list" to see available personas.`);
          process.exit(1);
        }

        logger.info(`Persona: ${p.name} (${p.id})`);
        logger.info(`Description: ${p.description}`);
        logger.info(`Priority: ${p.priority}`);
        logger.info(`\nFocus Areas:`);
        for (const area of p.focusAreas) {
          logger.info(`  - ${area}`);
        }
        logger.info(`\nSections:`);
        for (const section of p.sections) {
          const req = section.required ? '(required)' : '(optional)';
          logger.info(`  ${section.heading} ${req}`);
          logger.info(`    ${section.prompt}`);
        }
        logger.info(`\nPrompt Context:`);
        logger.info(`  ${p.promptContext}`);
      } catch (err) {
        logger.error(`Failed to show persona: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  persona
    .command('create <id>')
    .description('Scaffold a custom persona YAML file')
    .option('--name <name>', 'Display name for the persona')
    .option('--description <text>', 'Description of the persona')
    .action(async (id: string, opts) => {
      try {
        const projectRoot = await resolveProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a DomainKit project. Run "dk init" first.');
          process.exit(1);
        }

        const personasDir = join(projectRoot, '.domainkit', 'personas');
        await ensureDir(personasDir);

        const filePath = join(personasDir, `${id}.yaml`);

        const scaffold = {
          id,
          name: opts.name ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: opts.description ?? `Custom persona: ${id}`,
          focusAreas: ['area-1', 'area-2'],
          sections: [
            {
              heading: '## Section Title',
              prompt: 'Describe what content should go in this section.',
              required: true,
            },
          ],
          promptContext: 'Describe how this persona should approach examining code.',
          priority: 'supplementary',
        };

        await writeFileContent(filePath, stringifyYaml(scaffold));

        logger.success(`\nPersona "${id}" created!`);
        logger.info(`  Location: ${join('.domainkit', 'personas', `${id}.yaml`)}`);
        logger.info('  Edit the file to customize focus areas, sections, and prompt context.');
      } catch (err) {
        logger.error(`Failed to create persona: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
