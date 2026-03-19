import { requireOptional } from '../utils/optional-import.js';
import type { Contract, DriftIssue } from '../core/types.js';

export interface ModelField {
  name: string;
  type: string;
}

export interface ModelDiff {
  modelName: string;
  addedFields: ModelField[];
  removedFields: ModelField[];
  changedFields: Array<{ name: string; contractType: string; codeType: string }>;
}

export async function diffModels(
  contract: Contract,
  sourceFiles: string[],
): Promise<ModelDiff[]> {
  const tsMorph = await requireOptional<typeof import('ts-morph')>(
    'ts-morph',
    'model diff detection',
  );

  const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });
  const diffs: ModelDiff[] = [];

  // Build map of code interfaces
  const codeModels = new Map<string, Map<string, string>>();
  for (const filePath of sourceFiles) {
    try {
      const sourceFile = project.addSourceFileAtPath(filePath);
      for (const iface of sourceFile.getInterfaces()) {
        const fields = new Map<string, string>();
        for (const prop of iface.getProperties()) {
          fields.set(prop.getName(), prop.getType().getText());
        }
        codeModels.set(iface.getName(), fields);
      }
    } catch {
      // Skip unparseable files
    }
  }

  // Compare contract models against code
  for (const model of contract.models ?? []) {
    const codeFields = codeModels.get(model.name);
    if (!codeFields) continue;

    const contractFields = new Map(
      model.fields.map((f) => [f.name, f.type]),
    );

    const addedFields: ModelField[] = [];
    const removedFields: ModelField[] = [];
    const changedFields: ModelDiff['changedFields'] = [];

    for (const [name, type] of codeFields) {
      if (!contractFields.has(name)) {
        addedFields.push({ name, type });
      } else if (contractFields.get(name) !== type) {
        changedFields.push({
          name,
          contractType: contractFields.get(name)!,
          codeType: type,
        });
      }
    }

    for (const [name, type] of contractFields) {
      if (!codeFields.has(name)) {
        removedFields.push({ name, type });
      }
    }

    if (addedFields.length || removedFields.length || changedFields.length) {
      diffs.push({ modelName: model.name, addedFields, removedFields, changedFields });
    }
  }

  return diffs;
}

export function modelDiffToIssues(diffs: ModelDiff[]): DriftIssue[] {
  const issues: DriftIssue[] = [];

  for (const diff of diffs) {
    for (const field of diff.addedFields) {
      issues.push({
        type: 'model-mismatch',
        severity: 'info',
        message: `Field "${field.name}" (${field.type}) exists in code for "${diff.modelName}" but not in contract.`,
      });
    }
    for (const field of diff.removedFields) {
      issues.push({
        type: 'model-mismatch',
        severity: 'warning',
        message: `Field "${field.name}" is documented in contract for "${diff.modelName}" but not found in code.`,
      });
    }
    for (const field of diff.changedFields) {
      issues.push({
        type: 'model-mismatch',
        severity: 'warning',
        message: `Field "${field.name}" in "${diff.modelName}" has type "${field.codeType}" in code but "${field.contractType}" in contract.`,
      });
    }
  }

  return issues;
}
