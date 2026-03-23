import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { recommendFromDiff } from '../../recommend/index.js';
import { info, error } from '../../utils/logger.js';

export function register(program: Command): void {
  program
    .command('recommend')
    .description('Recommend relevant skills based on git changes')
    .option('--staged', 'Analyze staged changes only')
    .option('--commit <sha>', 'Analyze a specific commit')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const sourceRoot = resolve(process.cwd(), config.sourceRoot);
        const skillsDir = resolve(process.cwd(), config.skillsDir);

        const skills = await readAllSkills(skillsDir);
        if (skills.length === 0) {
          error('No skills found. Run "dk add" or "dk generate --bootstrap" first.');
          process.exit(1);
        }

        const mode = options.staged ? 'staged' : options.commit ? 'commit' : 'unstaged';
        const results = recommendFromDiff({
          skills,
          sourceRoot: process.cwd(),
          mode,
          commitSha: options.commit,
        });

        if (results.length === 0) {
          info('No skill recommendations — no changed files match any skill code-paths.');
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        info(`Recommended skills (${results.length}):\n`);
        for (const r of results) {
          const pct = (r.score * 100).toFixed(0);
          const tag = r.strength === 'strong' ? '\u2605' : '\u25CB';
          info(`  ${tag} ${r.skill.padEnd(25)} ${pct}% match  [${r.domain}]`);
        }

        // Suggest dk context command
        const domains = [...new Set(results.map(r => r.domain).filter(Boolean))];
        if (domains.length > 0) {
          info(`\nSuggested command:`);
          info(`  dk context -d ${domains.join(',')}`);
        }
      } catch (err) {
        error(`Recommend failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
