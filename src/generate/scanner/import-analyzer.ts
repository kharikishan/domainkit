import { join, dirname, relative, resolve } from 'node:path';
import { requireOptional } from '../../utils/optional-import.js';
import type { CandidateModule } from './structure-analyzer.js';

export interface ImportAnalysisResult {
  moduleName: string;
  cohesionScore: number;
  intraModuleImports: number;
  totalImports: number;
}

export async function analyzeImports(
  candidates: CandidateModule[],
  projectRoot: string,
): Promise<Map<string, ImportAnalysisResult>> {
  const results = new Map<string, ImportAnalysisResult>();

  let tsMorph: typeof import('ts-morph');
  try {
    tsMorph = await requireOptional<typeof import('ts-morph')>(
      'ts-morph',
      'import analysis',
    );
  } catch {
    // ts-morph not available, return empty results
    return results;
  }

  const { Project } = tsMorph;
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Build a map of module path -> module name for fast lookup
  const pathToModule = new Map<string, string>();
  for (const candidate of candidates) {
    pathToModule.set(candidate.path, candidate.name);
  }

  for (const candidate of candidates) {
    const sourceFiles = candidate.files
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))
      .slice(0, 50) // limit for performance
      .map((f) => join(candidate.path, f));

    let intraModuleImports = 0;
    let totalImports = 0;

    for (const filePath of sourceFiles) {
      try {
        const sourceFile = project.addSourceFileAtPath(filePath);
        const importDeclarations = sourceFile.getImportDeclarations();

        for (const imp of importDeclarations) {
          const moduleSpecifier = imp.getModuleSpecifierValue();

          // Skip external packages
          if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
            continue;
          }

          totalImports++;

          // Resolve the import path
          const resolvedPath = resolve(dirname(filePath), moduleSpecifier);

          // Check if the import resolves to a file within the same module
          if (resolvedPath.startsWith(candidate.path)) {
            intraModuleImports++;
          }
        }

        project.removeSourceFile(sourceFile);
      } catch {
        // Skip files that can't be parsed
        continue;
      }
    }

    const cohesionScore =
      totalImports > 0 ? intraModuleImports / totalImports : 0;

    results.set(candidate.name, {
      moduleName: candidate.name,
      cohesionScore,
      intraModuleImports,
      totalImports,
    });
  }

  return results;
}
