import { requireOptional } from '../utils/optional-import.js';

export interface ExtractedType {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  fields: Array<{ name: string; type: string; required: boolean }>;
  filePath: string;
}

export async function extractTypes(filePaths: string[]): Promise<ExtractedType[]> {
  const tsMorph = await requireOptional<typeof import('ts-morph')>(
    'ts-morph',
    'type extraction',
  );

  const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });
  const types: ExtractedType[] = [];

  for (const filePath of filePaths) {
    try {
      const sourceFile = project.addSourceFileAtPath(filePath);

      for (const iface of sourceFile.getInterfaces()) {
        types.push({
          name: iface.getName(),
          kind: 'interface',
          fields: iface.getProperties().map((p) => ({
            name: p.getName(),
            type: p.getType().getText(),
            required: !p.hasQuestionToken(),
          })),
          filePath,
        });
      }

      for (const enumDecl of sourceFile.getEnums()) {
        types.push({
          name: enumDecl.getName(),
          kind: 'enum',
          fields: enumDecl.getMembers().map((m) => ({
            name: m.getName(),
            type: m.getValue()?.toString() ?? 'string',
            required: true,
          })),
          filePath,
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return types;
}
