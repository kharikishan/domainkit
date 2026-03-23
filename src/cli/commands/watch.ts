import { Command } from 'commander';
import { resolve, relative } from 'node:path';
import { watch } from 'node:fs/promises';
import { minimatch } from 'minimatch';
import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { info, error, success } from '../../utils/logger.js';
import type { Skill } from '../../core/types.js';
import { getSkillCodePaths } from '../../core/constants.js';

function findAffectedSkills(changedFile: string, skills: Skill[]): Skill[] {
  const affected: Skill[] = [];
  for (const skill of skills) {
    const codePaths = getSkillCodePaths(skill);
    for (const pattern of codePaths) {
      if (minimatch(changedFile, pattern)) {
        affected.push(skill);
        break;
      }
    }
  }
  return affected;
}

export function register(program: Command): void {
  program
    .command('watch')
    .description('Watch source files and detect skill drift in real-time')
    .action(async () => {
      try {
        const config = await loadConfig();
        const sourceRoot = resolve(process.cwd(), config.sourceRoot);
        const skillsDir = resolve(process.cwd(), config.skillsDir);

        const skills = await readAllSkills(skillsDir);
        if (skills.length === 0) {
          error('No skills found. Run "dk add" or "dk generate --bootstrap" first.');
          process.exit(1);
        }

        info(`Watching ${sourceRoot} for changes...`);
        info(`Tracking ${skills.length} skill(s)\n`);

        const watcher = watch(sourceRoot, { recursive: true });

        for await (const event of watcher) {
          if (!event.filename) continue;

          const relPath = relative(process.cwd(), resolve(sourceRoot, event.filename));
          const affected = findAffectedSkills(relPath, skills);

          if (affected.length > 0) {
            const names = affected.map(s => s.metadata.name).join(', ');
            info(`File changed: ${relPath}`);
            info(`  Affected skill(s): ${names}`);
            info(`  Run: dk drift --skill ${affected[0].metadata.name}\n`);
          }
        }
      } catch (err) {
        error(`Watch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
