import { join, basename } from 'node:path';
import fg from 'fast-glob';
import { dirExists } from '../utils/fs.js';
import { classifyProject, sourceFileGlob, entryPointFiles } from './scanner/project-classifier.js';
import type { SpecKitInfo } from './scanner/project-classifier.js';
import { analyzeStructure } from './scanner/structure-analyzer.js';
import { analyzeImports } from './scanner/import-analyzer.js';

export interface DiscoveredModule {
  name: string;
  path: string;
  confidence: number;
  hasBarrelExport: boolean;
  hasRoutes: boolean;
  files: string[];
  detectedBy: 'convention' | 'heuristic' | 'framework' | 'workspace';
  projectType?: string;
  language?: string;
  indicators?: string[];
  cohesionScore?: number;
  specKit?: SpecKitInfo;
}

export interface ScanOptions {
  projectRoot?: string;
  sourceRoot?: string;
  filterModules?: string[];
  maxDepth?: number;
  skipImportAnalysis?: boolean;
  minConfidence?: number;
}

const CONVENTION_DIRS = ['modules', 'features', 'domains', 'services'];

// Backward-compatible overload
export async function scanForModules(
  sourceRootOrOptions: string | ScanOptions,
  filterModules?: string[],
): Promise<DiscoveredModule[]> {
  const options: ScanOptions =
    typeof sourceRootOrOptions === 'string'
      ? { sourceRoot: sourceRootOrOptions, filterModules }
      : sourceRootOrOptions;

  const projectRoot = options.projectRoot ?? process.cwd();
  const sourceRoot = options.sourceRoot ?? join(projectRoot, 'src');
  const minConfidence = options.minConfidence ?? 0.3;
  const maxDepth = options.maxDepth ?? 4;

  const modules: DiscoveredModule[] = [];

  // Phase 1: Project classification
  const classification = await classifyProject(projectRoot);
  const lang = classification.language;
  const glob = sourceFileGlob(lang);
  const entryPoints = entryPointFiles(lang);

  // Phase 2: Convention scan (fast path)
  const conventionModules = await conventionScan(sourceRoot, options.filterModules, glob, entryPoints);
  modules.push(...conventionModules);

  // Phase 3: Structure-based discovery
  const scanRoot = await dirExists(sourceRoot) ? sourceRoot : projectRoot;
  const candidates = await analyzeStructure(scanRoot, classification, maxDepth);

  // Convert candidates to DiscoveredModule, avoiding duplicates with convention results
  const conventionPaths = new Set(modules.map((m) => m.path));
  for (const candidate of candidates) {
    if (conventionPaths.has(candidate.path)) continue;
    if (options.filterModules && !options.filterModules.includes(candidate.name)) continue;

    const detectedBy =
      classification.type === 'monorepo'
        ? 'workspace' as const
        : classification.type !== 'generic'
          ? 'framework' as const
          : 'heuristic' as const;

    modules.push({
      name: candidate.name,
      path: candidate.path,
      confidence: candidate.totalScore,
      hasBarrelExport: candidate.hasBarrelExport,
      hasRoutes: candidate.hasRoutes,
      files: candidate.files,
      detectedBy,
      projectType: classification.type,
      language: lang,
      indicators: candidate.indicators,
    });
  }

  // Phase 4: Import analysis (optional, TypeScript/JavaScript only)
  const canAnalyzeImports = lang === 'typescript' || lang === 'javascript' || lang === 'mixed';
  if (!options.skipImportAnalysis && canAnalyzeImports && modules.length > 0) {
    try {
      const allCandidates = modules.map((m) => ({
        name: m.name,
        path: m.path,
        depth: 1,
        totalScore: m.confidence,
        hasBarrelExport: m.hasBarrelExport,
        hasRoutes: m.hasRoutes,
        files: m.files,
        indicators: m.indicators ?? [],
      }));

      const importResults = await analyzeImports(allCandidates, projectRoot);

      for (const mod of modules) {
        const analysis = importResults.get(mod.name);
        if (analysis) {
          mod.cohesionScore = analysis.cohesionScore;
          if (analysis.cohesionScore > 0.5) {
            mod.confidence = Math.min(mod.confidence + 0.15, 1);
            mod.indicators = [...(mod.indicators ?? []), `high cohesion (${(analysis.cohesionScore * 100).toFixed(0)}%)`];
          }
        }
      }
    } catch {
      // ts-morph not available or analysis failed, continue without it
    }
  }

  // Attach spec-kit info to first module for display
  if (classification.specKit?.detected && modules.length > 0) {
    modules[0].specKit = classification.specKit;
  }

  // Phase 5: Filter, sort, deduplicate
  return modules
    .filter((m) => m.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

async function conventionScan(
  sourceRoot: string,
  filterModules: string[] | undefined,
  glob: string,
  entryPoints: string[],
): Promise<DiscoveredModule[]> {
  const modules: DiscoveredModule[] = [];

  for (const dir of CONVENTION_DIRS) {
    const modulesDir = join(sourceRoot, dir);
    if (!(await dirExists(modulesDir))) continue;

    const subdirs = await fg('*', {
      cwd: modulesDir,
      onlyDirectories: true,
      absolute: true,
    });

    for (const subdir of subdirs) {
      const name = basename(subdir);
      if (filterModules && !filterModules.includes(name)) continue;

      const files = await fg(glob, {
        cwd: subdir,
        onlyFiles: true,
      });

      const hasBarrelExport = entryPoints.length > 0 && files.some(
        (f) => entryPoints.includes(f),
      );
      const hasRoutes = files.some(
        (f) =>
          f.includes('route') ||
          f.includes('controller') ||
          f.includes('handler') ||
          f.includes('views') ||
          f.includes('urls'),
      );

      let confidence = 0.45;
      if (hasBarrelExport) confidence += 0.25;
      if (hasRoutes) confidence += 0.15;
      if (files.length >= 3) confidence += 0.15;

      modules.push({
        name,
        path: subdir,
        confidence: Math.min(confidence, 1),
        hasBarrelExport,
        hasRoutes,
        files,
        detectedBy: 'convention',
        indicators: [`found in ${dir}/`],
      });
    }
  }

  return modules;
}
