import { Command } from 'commander';
import { join } from 'node:path';
import * as logger from '../../utils/logger.js';
import { ensureDir, resolveProjectRoot, writeFileContent } from '../../utils/fs.js';
import { renderTemplate } from '../../utils/template.js';
import { loadConfig } from '../../core/config.js';
import { withSpinner } from '../ui/spinner.js';
import { promptAddSkill } from '../ui/prompts.js';

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toYamlList(items: string[]): string {
  if (items.length === 0) return '[]';
  return items.map((i) => `\n  - ${i}`).join('');
}

export function register(program: Command): void {
  program
    .command('add <name>')
    .description('Add a new skill to the project')
    .option('--non-interactive', 'Skip prompts and use flag values')
    .option('--description <text>', 'Short description of the skill')
    .option('--domain <domain>', 'Domain name (e.g. auth, payments)')
    .option('--deps <list>', 'Comma-separated dependency skill names')
    .option('--code-paths <list>', 'Comma-separated code paths')
    .option('--contract', 'Also scaffold a contract.yaml for this skill')
    .action(async (name: string, opts) => {
      try {
        const projectRoot = await resolveProjectRoot();
        if (!projectRoot) {
          logger.error(
            'Not inside a DomainKit project. Run "dk init" first.',
          );
          process.exit(1);
        }

        const config = await loadConfig(projectRoot);

        let description: string = opts.description ?? '';
        let domain: string = opts.domain ?? '';
        let depsRaw: string = opts.deps ?? '';
        let codePathsRaw: string = opts.codePaths ?? '';

        if (!opts.nonInteractive) {
          const answers = await promptAddSkill();
          if (!description) description = answers.description;
          if (!domain) domain = answers.domain;
          if (!depsRaw) depsRaw = answers.dependencies;
          if (!codePathsRaw) codePathsRaw = answers.codePaths;
        }

        const deps = parseList(depsRaw);
        const codePaths = parseList(codePathsRaw);
        const lastVerified = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const skillDir = join(projectRoot, config.skillsDir, name);

        await withSpinner(`Creating skill "${name}"…`, async () => {
          await ensureDir(skillDir);

          const skillContent = await renderTemplate('skill.md.hbs', {
            name,
            description,
            domain: domain || undefined,
            dependencies: deps.length > 0 ? toYamlList(deps) : undefined,
            codePaths: codePaths.length > 0 ? toYamlList(codePaths) : undefined,
            lastVerified,
          });

          await writeFileContent(join(skillDir, 'SKILL.md'), skillContent);
        });

        if (opts.contract) {
          await withSpinner('Creating contract.yaml…', async () => {
            const contractContent = await renderTemplate('contract.yaml.hbs', {
              name,
            });
            await writeFileContent(
              join(skillDir, 'references', 'contract.yaml'),
              contractContent,
            );
          });
        }

        logger.success(`\nSkill "${name}" created!`);
        logger.info(`  Location : ${join(config.skillsDir, name, 'SKILL.md')}`);
        if (opts.contract) {
          logger.info(`  Contract : ${join(config.skillsDir, name, 'references', 'contract.yaml')}`);
        }
      } catch (err) {
        logger.error(`Add failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
