import { Command } from 'commander';
import { join } from 'node:path';
import chalk from 'chalk';
import * as logger from '../../utils/logger.js';
import { resolveProjectRoot } from '../../utils/fs.js';
import { loadConfig } from '../../core/config.js';
import { readAllSkills, readSkill, readContract } from '../../core/skill-reader.js';
import type {
  Skill,
  ValidationError,
  ValidationWarning,
  ValidationResult,
} from '../../core/types.js';

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

function validateSkill(skill: Skill): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const skillName = skill.metadata.name || skill.dir;

  // Required fields
  if (!skill.metadata.name || skill.metadata.name.trim() === '') {
    errors.push({ skill: skillName, field: 'name', message: 'Missing required field: name' });
  }

  if (!skill.metadata.description || skill.metadata.description.trim() === '') {
    errors.push({
      skill: skillName,
      field: 'description',
      message: 'Missing required field: description',
    });
  }

  // Recommended fields (warnings)
  if (!skill.metadata['domainkit-domain'] && !skill.metadata.domain) {
    warnings.push({
      skill: skillName,
      field: 'domainkit-domain',
      message: 'No domain specified — consider adding domainkit-domain to the frontmatter',
    });
  }

  if (!skill.metadata['domainkit-last-verified']) {
    warnings.push({
      skill: skillName,
      field: 'domainkit-last-verified',
      message: 'No last-verified date — consider adding domainkit-last-verified',
    });
  }

  if (!skill.metadata['domainkit-version']) {
    warnings.push({
      skill: skillName,
      field: 'domainkit-version',
      message: 'No domainkit-version specified in frontmatter',
    });
  }

  if (!skill.body || skill.body.trim().length === 0) {
    warnings.push({
      skill: skillName,
      field: 'body',
      message: 'Skill body is empty — add documentation sections',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function mergeResults(results: ValidationResult[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const r of results) {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printResults(result: ValidationResult, strict: boolean): void {
  if (result.errors.length === 0 && result.warnings.length === 0) {
    logger.success('All skills are valid.');
    return;
  }

  if (result.errors.length > 0) {
    console.log(chalk.red.bold(`\nErrors (${result.errors.length}):`));
    for (const err of result.errors) {
      console.log(
        `  ${chalk.red('✖')} ${chalk.bold(err.skill)} [${err.field}]: ${err.message}`,
      );
    }
  }

  if (result.warnings.length > 0) {
    const label = strict ? chalk.red.bold('Warnings (strict mode):') : chalk.yellow.bold('Warnings:');
    console.log(`\n${label} ${chalk.yellow(`(${result.warnings.length})`)}${strict ? chalk.red(' — treated as errors') : ''}`);
    for (const warn of result.warnings) {
      const icon = strict ? chalk.red('✖') : chalk.yellow('⚠');
      console.log(`  ${icon} ${chalk.bold(warn.skill)} [${warn.field}]: ${warn.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function register(program: Command): void {
  program
    .command('validate')
    .description('Validate skill files for correctness and completeness')
    .option('--skill <name>', 'Validate a single skill by name')
    .option('--strict', 'Treat warnings as errors (exit 1)')
    .action(async (opts) => {
      try {
        const projectRoot = await resolveProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a DomainKit project. Run "dk init" first.');
          process.exit(1);
        }

        const config = await loadConfig(projectRoot);
        const skillsRoot = join(projectRoot, config.skillsDir);

        let skills: Skill[];

        if (opts.skill) {
          const skillDir = join(skillsRoot, opts.skill as string);
          try {
            const skill = await readSkill(skillDir);
            skills = [skill];
          } catch {
            logger.error(`Could not read skill "${opts.skill}". Does the directory exist?`);
            process.exit(1);
          }
        } else {
          skills = await readAllSkills(skillsRoot);
        }

        if (skills.length === 0) {
          logger.info('No skills found to validate.');
          return;
        }

        logger.info(`Validating ${skills.length} skill(s)…\n`);

        const perSkillResults = skills.map((skill) => validateSkill(skill));
        const combined = mergeResults(perSkillResults);

        printResults(combined, opts.strict ?? false);

        // Summary line
        const errorCount = combined.errors.length;
        const warnCount = combined.warnings.length;

        if (errorCount === 0 && warnCount === 0) {
          // already printed by printResults
        } else {
          console.log(
            `\nValidated ${skills.length} skill(s): ` +
              chalk.red(`${errorCount} error(s)`) +
              ', ' +
              chalk.yellow(`${warnCount} warning(s)`),
          );
        }

        // Exit code
        const hasErrors = errorCount > 0 || (opts.strict && warnCount > 0);
        if (hasErrors) {
          process.exit(1);
        }
      } catch (err) {
        logger.error(`Validate failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
