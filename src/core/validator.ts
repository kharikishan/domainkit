import { createRequire } from 'node:module';
import * as AjvModule from 'ajv';
import type { Skill, Contract, ValidationResult, ValidationError, ValidationWarning } from './types.js';
import { readContract } from './skill-reader.js';

const require = createRequire(import.meta.url);
const contractSchema = require('../schemas/contract.schema.json') as Record<string, unknown>;

// Ajv v8 may export its constructor as the default or as .default depending on the bundler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvConstructor: new (...args: unknown[]) => AjvModule.default = (
  (AjvModule as unknown as { default: typeof AjvModule.default }).default ?? AjvModule
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any;

const ajv = new AjvConstructor();
const validateContractSchema = ajv.compile(contractSchema);

const RECOMMENDED_SECTIONS = ['Data Models', 'Business Rules', 'API Surface'] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;

export function validateSkill(skill: Skill): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const skillName = skill.metadata.name || skill.filePath;

  // Required: name must be non-empty
  if (!skill.metadata.name || skill.metadata.name.trim().length === 0) {
    errors.push({
      skill: skillName,
      field: 'name',
      message: 'Skill name is required and must not be empty.',
    });
  }

  // Required: description must be non-empty
  if (!skill.metadata.description || skill.metadata.description.trim().length === 0) {
    errors.push({
      skill: skillName,
      field: 'description',
      message: 'Skill description is required and must not be empty.',
    });
  }

  // Optional: domainkit-last-verified must be a valid ISO date if present
  const lastVerified = skill.metadata['domainkit-last-verified'];
  if (lastVerified !== undefined) {
    if (!ISO_DATE_RE.test(lastVerified) || isNaN(Date.parse(lastVerified))) {
      errors.push({
        skill: skillName,
        field: 'domainkit-last-verified',
        message: `'domainkit-last-verified' must be a valid ISO 8601 date string (got: "${lastVerified}").`,
      });
    }
  }

  // Warning: body should be non-empty
  if (!skill.body || skill.body.trim().length === 0) {
    warnings.push({
      skill: skillName,
      field: 'body',
      message: 'Skill body is empty. Consider adding documentation content.',
    });
  }

  // Warning: recommended sections
  for (const section of RECOMMENDED_SECTIONS) {
    const sectionPattern = new RegExp(`^#{1,6}\\s+${section}`, 'm');
    if (!sectionPattern.test(skill.body)) {
      warnings.push({
        skill: skillName,
        field: 'body',
        message: `Recommended section "${section}" is missing from the skill body.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateContract(contract: Contract): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const isValid = validateContractSchema(contract);
  if (!isValid && validateContractSchema.errors) {
    for (const ajvError of validateContractSchema.errors) {
      errors.push({
        skill: '',
        field: ajvError.instancePath || ajvError.schemaPath,
        message: ajvError.message ?? 'Contract validation failed.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateAll(skills: Skill[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const skill of skills) {
    const skillResult = validateSkill(skill);
    results.push(skillResult);

    if (skill.hasContract) {
      const contract = await readContract(skill.dir);
      if (contract !== null) {
        const contractResult = validateContract(contract);
        // Annotate contract errors/warnings with the skill name
        const skillName = skill.metadata.name || skill.filePath;
        const annotatedErrors: ValidationError[] = contractResult.errors.map((e) => ({
          ...e,
          skill: skillName,
        }));
        const annotatedWarnings: ValidationWarning[] = contractResult.warnings.map((w) => ({
          ...w,
          skill: skillName,
        }));
        results.push({
          valid: contractResult.valid,
          errors: annotatedErrors,
          warnings: annotatedWarnings,
        });
      }
    }
  }

  return results;
}
