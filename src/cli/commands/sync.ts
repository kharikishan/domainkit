import { Command } from 'commander';
import { resolve, join, relative } from 'node:path';
import { cp, rm } from 'node:fs/promises';
import { loadConfig } from '../../core/config.js';
import { readAllSkills } from '../../core/skill-reader.js';
import { info, warn, error, success } from '../../utils/logger.js';
import { ensureDir, dirExists } from '../../utils/fs.js';

const AGENT_DIR_MAP: Record<string, string> = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
  codex: '.agents/skills',
  vscode: '.github/skills',
  github: '.github/skills',
  windsurf: '.agents/skills',
  generic: '.skills',
};

export function register(program: Command): void {
  program
    .command('sync')
    .description('Sync skills to agent platform directories (Agent Skills standard)')
    .option('-t, --target <targets...>', 'Target platforms (claude, cursor, codex, vscode, github, windsurf)')
    .option('-a, --all', 'Sync to all known platforms')
    .option('--dry-run', 'Show what would be synced without writing')
    .option('--clean', 'Remove target directories before syncing')
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const projectRoot = process.cwd();
        const skillsDir = resolve(projectRoot, config.skillsDir);
        const skills = await readAllSkills(skillsDir);

        if (skills.length === 0) {
          error('No skills found. Run `dk add` to create skills.');
          process.exit(1);
        }

        let targets: string[];
        if (options.all) {
          targets = Object.keys(AGENT_DIR_MAP);
        } else if (options.target) {
          targets = options.target;
        } else if (config.sync?.targets) {
          targets = config.sync.targets;
        } else {
          targets = config.platform !== 'generic' ? [config.platform] : ['claude'];
        }

        for (const target of targets) {
          const targetDir = AGENT_DIR_MAP[target];
          if (!targetDir) {
            warn(`Unknown target platform: ${target}`);
            continue;
          }

          const destDir = resolve(projectRoot, targetDir);

          if (options.dryRun) {
            info(`[dry-run] Would sync ${skills.length} skill(s) to ${targetDir}/`);
            for (const skill of skills) {
              info(`  ${relative(skillsDir, skill.dir)} → ${targetDir}/${relative(skillsDir, skill.dir)}`);
            }
            continue;
          }

          if (options.clean && await dirExists(destDir)) {
            await rm(destDir, { recursive: true });
            info(`Cleaned ${targetDir}/`);
          }

          await ensureDir(destDir);

          for (const skill of skills) {
            const skillRelDir = relative(skillsDir, skill.dir);
            const dest = join(destDir, skillRelDir);
            await cp(skill.dir, dest, { recursive: true });
          }

          success(`Synced ${skills.length} skill(s) to ${targetDir}/`);
        }
      } catch (err) {
        error(`Sync failed: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
