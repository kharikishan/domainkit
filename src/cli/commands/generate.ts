import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../../core/config.js';
import { info, error, success } from '../../utils/logger.js';

export function register(program: Command): void {
  program
    .command('generate')
    .description('Generate skill drafts from codebase analysis')
    .option('--scan', 'Scan for modules and suggest skills')
    .option('--bootstrap', 'Generate draft skills for discovered modules')
    .option('-m, --modules <modules...>', 'Specific modules to generate for')
    .option('--auto', 'Skip confirmation prompts')
    .option('--with-contracts', 'Also generate contract.yaml files')
    .option('--dry-run', 'Show what would be generated without writing')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const sourceRoot = resolve(process.cwd(), config.sourceRoot);
        const skillsDir = resolve(process.cwd(), config.skillsDir);

        const { scanForModules } = await import('../../generate/module-scanner.js');
        const modules = await scanForModules(sourceRoot, options.modules);

        if (modules.length === 0) {
          error('No modules found. Check your sourceRoot configuration.');
          process.exit(1);
        }

        if (options.scan && !options.bootstrap) {
          info(`Found ${modules.length} module(s):`);
          for (const mod of modules) {
            info(`  ${mod.name} (confidence: ${(mod.confidence * 100).toFixed(0)}%)`);
          }
          return;
        }

        const { generateSkillDraft } = await import('../../generate/skill-writer.js');

        for (const mod of modules) {
          if (options.dryRun) {
            info(`[dry-run] Would generate skill for: ${mod.name}`);
            continue;
          }

          await generateSkillDraft({
            module: mod,
            skillsDir,
            withContract: options.withContracts ?? false,
          });
          success(`Generated skill draft: ${mod.name}`);
        }
      } catch (err) {
        error(`Generation failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
