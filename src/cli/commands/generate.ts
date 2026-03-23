import { Command } from 'commander';
import { join, resolve } from 'node:path';
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
    .option('--persona <id>', 'Generate skills using a specific persona (e.g. developer, domain-expert)')
    .option('--personas <ids...>', 'Generate skills by merging multiple personas')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const sourceRoot = resolve(process.cwd(), config.sourceRoot);
        const skillsDir = resolve(process.cwd(), config.skillsDir);

        const { scanForModules } = await import('../../generate/module-scanner.js');
        const modules = await scanForModules({
          projectRoot: process.cwd(),
          sourceRoot,
          filterModules: options.modules,
        });

        if (modules.length === 0) {
          error('No modules found. Check your sourceRoot configuration.');
          process.exit(1);
        }

        if (options.scan && !options.bootstrap) {
          info(`Found ${modules.length} module(s):`);
          for (const mod of modules) {
            const pct = (mod.confidence * 100).toFixed(0);
            const via = mod.detectedBy ?? 'unknown';
            const hints = mod.indicators?.length
              ? ` [${mod.indicators.join(', ')}]`
              : '';
            info(`  ${mod.name} (confidence: ${pct}%, via: ${via})${hints}`);
          }
          const meta: string[] = [];
          if (modules[0]?.projectType) meta.push(`type: ${modules[0].projectType}`);
          if (modules[0]?.language) meta.push(`language: ${modules[0].language}`);
          if (meta.length > 0) info(`\nProject ${meta.join(', ')}`);
          if (modules[0]?.specKit?.detected) {
            const sk = modules[0].specKit;
            const parts = ['spec-kit detected (.specify/)'];
            if (sk.hasConstitution) parts.push('has constitution');
            if (sk.features?.length) parts.push(`${sk.features.length} feature spec(s)`);
            info(`Spec-Kit: ${parts.join(', ')}`);
          }
          return;
        }

        const { generateSkillDraft } = await import('../../generate/skill-writer.js');

        // Resolve persona if specified
        let persona = undefined;
        const personaIds: string[] = options.personas ?? (options.persona ? [options.persona] : []);
        if (personaIds.length > 0) {
          const { getPersona, mergePersonas } = await import('../../personas/index.js');
          const resolved = [];
          for (const pid of personaIds) {
            const p = await getPersona(pid, process.cwd());
            if (!p) {
              error(`Persona "${pid}" not found. Run "dk persona list" to see available personas.`);
              process.exit(1);
            }
            resolved.push(p);
          }
          persona = resolved.length === 1 ? resolved[0] : mergePersonas(resolved);
        }

        for (const mod of modules) {
          if (options.dryRun) {
            info(`[dry-run] Would generate skill for: ${mod.name}${persona ? ` (persona: ${persona.id})` : ''}`);
            continue;
          }

          await generateSkillDraft({
            module: mod,
            skillsDir,
            withContract: options.withContracts ?? false,
            persona,
          });
          success(`Generated skill draft: ${mod.name}${persona ? ` (persona: ${persona.id})` : ''}`);
        }

        if (!options.dryRun) {
          const { readAllSkills } = await import('../../core/skill-reader.js');
          const { buildManifest, saveManifest } = await import('../../core/manifest.js');
          const allSkills = await readAllSkills(config.skillsDir);
          const manifest = buildManifest(allSkills);
          await saveManifest(manifest, join(process.cwd(), '.domainkit'));
        }
      } catch (err) {
        error(`Generation failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
