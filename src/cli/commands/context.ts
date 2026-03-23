import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { matchTaskToDomains } from '../../core/matcher.js';
import { assembleContext } from '../../core/assembler.js';
import { renderContext } from '../../formats/index.js';
import { info, error, success } from '../../utils/logger.js';
import { writeFileContent } from '../../utils/fs.js';
import type { OutputFormat, ContextDepth } from '../../core/types.js';
import { getSkillDomain } from '../../core/constants.js';

export function register(program: Command): void {
  program
    .command('context [task]')
    .description('Assemble domain context for a task')
    .option('-d, --domains <domains...>', 'Specify domains directly')
    .option('-f, --format <format>', 'Output format (claude, system-prompt, markdown)', 'claude')
    .option('-o, --output <file>', 'Write output to file')
    .option('-b, --budget <tokens>', 'Token budget', '8000')
    .option('--auto', 'Skip confirmation prompts')
    .option('--depth <depth>', 'Context depth (index, contract, full)', 'contract')
    .option('--clipboard', 'Copy to clipboard')
    .action(async (task: string | undefined, options) => {
      try {
        const config = await loadConfig();
        const skillsDir = resolve(process.cwd(), config.skillsDir);
        const skills = await readAllSkills(skillsDir);

        if (skills.length === 0) {
          error('No skills found. Run `dk add` to create skills.');
          process.exit(1);
        }

        let selectedSkillNames: string[];

        if (options.domains) {
          selectedSkillNames = skills
            .filter(s => {
              const domain = getSkillDomain(s);
              return options.domains.includes(domain);
            })
            .map(s => s.metadata.name);
        } else if (task) {
          info(`Matching task: "${task}"`);
          const matches = await matchTaskToDomains(task, skills);

          if (matches.length === 0) {
            error('No matching domains found for this task.');
            process.exit(1);
          }

          info(`Found ${matches.length} matching domain(s):`);
          for (const m of matches) {
            info(`  ${m.strength === 'strong' ? '●' : '○'} ${m.skill} (${m.domain}) — score: ${m.score.toFixed(2)}`);
          }

          selectedSkillNames = matches.map(m => m.skill);
        } else {
          selectedSkillNames = skills.map(s => s.metadata.name);
        }

        const context = await assembleContext({
          skills,
          selectedSkills: selectedSkillNames,
          budget: parseInt(options.budget, 10),
          depth: options.depth as ContextDepth,
          format: options.format as OutputFormat,
        });

        const rendered = renderContext(context, skills, options.format as OutputFormat);

        if (options.output) {
          await writeFileContent(options.output, rendered);
          success(`Context written to ${options.output}`);
        } else {
          console.log(rendered);
        }

        if (options.clipboard) {
          try {
            const { execSync } = await import('node:child_process');
            execSync('pbcopy', { input: rendered });
            success('Copied to clipboard');
          } catch {
            error('Failed to copy to clipboard');
          }
        }
      } catch (err) {
        error(`Context assembly failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
