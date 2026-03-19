import { Command } from 'commander';
import { join } from 'node:path';
import * as logger from '../../utils/logger.js';
import { fileExists, dirExists, ensureDir, resolveProjectRoot } from '../../utils/fs.js';
import { renderTemplate } from '../../utils/template.js';
import { writeFileContent } from '../../utils/fs.js';
import { detectSkillsDir } from '../../core/config.js';
import { withSpinner } from '../ui/spinner.js';
import { promptInit } from '../ui/prompts.js';

export function register(program: Command): void {
  program
    .command('init')
    .description('Initialise a DomainKit project in the current directory')
    .option('--non-interactive', 'Skip prompts and use flag values')
    .option('--platform <platform>', 'AI platform (claude|codex|vscode|cursor|generic)', 'generic')
    .option('--source-root <path>', 'Source root directory', 'src')
    .option('--skills-dir <path>', 'Skills directory')
    .action(async (opts) => {
      try {
        const cwd = process.cwd();
        const configPath = join(cwd, '.domainkit', 'config.yaml');

        // Check if already initialised
        if (await fileExists(configPath)) {
          logger.warn(
            'DomainKit is already initialised in this directory (.domainkit/config.yaml exists).',
          );
          process.exit(0);
        }

        let platform: string = opts.platform;
        let sourceRoot: string = opts.sourceRoot;
        let skillsDir: string | undefined = opts.skillsDir;

        if (!opts.nonInteractive) {
          // Detect an existing skills dir to use as default
          const detectedSkillsDir = await detectSkillsDir(cwd);

          const answers = await promptInit();
          platform = answers.platform;
          sourceRoot = answers.sourceRoot;
          skillsDir = answers.skillsDir || detectedSkillsDir;
        } else {
          if (!skillsDir) {
            skillsDir = await detectSkillsDir(cwd);
          }
        }

        const resolvedSkillsDir = skillsDir ?? '.skills';

        await withSpinner('Writing .domainkit/config.yaml…', async () => {
          const content = await renderTemplate('config.yaml.hbs', {
            platform,
            sourceRoot,
            skillsDir: resolvedSkillsDir,
          });
          await writeFileContent(configPath, content);
        });

        await withSpinner(`Creating skills directory (${resolvedSkillsDir})…`, async () => {
          const fullSkillsPath = join(cwd, resolvedSkillsDir);
          if (!(await dirExists(fullSkillsPath))) {
            await ensureDir(fullSkillsPath);
          }
        });

        logger.success(`\nDomainKit initialised!`);
        logger.info(`  Config : .domainkit/config.yaml`);
        logger.info(`  Skills : ${resolvedSkillsDir}`);
        logger.info(`\nRun "dk add <name>" to create your first skill.`);
      } catch (err) {
        logger.error(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
