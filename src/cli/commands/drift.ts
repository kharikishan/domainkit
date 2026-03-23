import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../../core/config.js';
import { readAllSkills, readSkill } from '../../core/skill-reader.js';
import { runDriftCheck, formatDriftTerminal, formatDriftMarkdown, formatDriftJson } from '../../drift/reporter.js';
import { error } from '../../utils/logger.js';
import { writeFileContent } from '../../utils/fs.js';

export function register(program: Command): void {
  program
    .command('drift')
    .description('Check skills for drift from the codebase')
    .option('-s, --skill <name>', 'Check a specific skill')
    .option('-r, --report <format>', 'Report format (terminal, md, json)', 'terminal')
    .option('-o, --output <file>', 'Write report to file')
    .option('--threshold <days>', 'Staleness threshold in days', '30')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const skillsDir = resolve(process.cwd(), config.skillsDir);
        const sourceRoot = resolve(process.cwd(), config.sourceRoot);

        let skills;
        if (options.skill) {
          const skillDir = resolve(skillsDir, options.skill);
          const skill = await readSkill(skillDir);
          skills = [skill];
        } else {
          skills = await readAllSkills(skillsDir);
        }

        if (skills.length === 0) {
          error('No skills found.');
          process.exit(1);
        }

        const results = await runDriftCheck({
          skills,
          sourceRoot,
          threshold: parseInt(options.threshold, 10),
          strategies: config.drift?.strategies,
        });

        let output: string;
        switch (options.report) {
          case 'md':
            output = formatDriftMarkdown(results);
            break;
          case 'json':
            output = formatDriftJson(results);
            break;
          default:
            output = formatDriftTerminal(results);
        }

        if (options.output) {
          await writeFileContent(options.output, output);
        } else {
          console.log(output);
        }

        const hasDrift = results.some(r => r.status === 'drifted');
        if (hasDrift) {
          process.exit(1);
        }
      } catch (err) {
        error(`Drift check failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
