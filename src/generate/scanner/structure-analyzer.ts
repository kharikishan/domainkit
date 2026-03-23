import { join, basename, relative } from 'node:path';
import fg from 'fast-glob';
import { dirExists, fileExists } from '../../utils/fs.js';
import type { ProjectClassification } from './project-classifier.js';
import { sourceFileGlob, entryPointFiles } from './project-classifier.js';

export interface CandidateModule {
  name: string;
  path: string;
  depth: number;
  totalScore: number;
  hasBarrelExport: boolean;
  hasRoutes: boolean;
  files: string[];
  indicators: string[];
}

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.domainkit', '.skills', '.claude', '.specify',
  'dist', 'build', 'out', '.next', '.nuxt', '.output', 'target',
  'coverage', '.nyc_output', '__pycache__', '.mypy_cache', '.pytest_cache',
  '__tests__', '__mocks__', '__fixtures__', '__snapshots__',
  'test', 'tests', 'spec', 'specs',
  'scripts', 'bin',
  'public', 'static', 'assets', 'images', 'fonts', 'styles',
  '.github', '.vscode', '.idea',
  'docs', 'documentation',
  'config', 'configs', '.config',
  'templates', 'examples',
  'migrations', 'alembic',
  'venv', '.venv', 'env', '.env',
  '.gradle', '.mvn', '.settings',
]);

const UTILITY_NAMES = new Set([
  'utils', 'util', 'utilities',
  'helpers', 'helper',
  'shared', 'common', 'lib',
  'types', 'typings',
  'config', 'configs', 'constants',
]);

const CONVENTION_FILE_PATTERNS = [
  'controller', 'service', 'model', 'repository',
  'handler', 'resolver', 'routes', 'route',
  'schema', 'entity', 'middleware', 'guard',
  'pipe', 'interceptor', 'filter', 'gateway',
  'provider', 'factory', 'strategy',
  // Python patterns
  'views', 'serializers', 'serializer', 'forms',
  'admin', 'managers', 'signals', 'tasks',
  // Java patterns
  'dto', 'dao', 'mapper', 'converter',
];

export async function analyzeStructure(
  scanRoot: string,
  classification: ProjectClassification,
  maxDepth = 4,
): Promise<CandidateModule[]> {
  const lang = classification.language;

  switch (classification.type) {
    case 'monorepo':
      return analyzeMonorepo(scanRoot, classification, lang);
    case 'nextjs':
      return analyzeNextjs(scanRoot, lang);
    case 'nestjs':
      return analyzeNestjs(scanRoot, lang);
    case 'django':
      return analyzeDjango(scanRoot);
    case 'flask':
    case 'fastapi':
      return analyzePythonApp(scanRoot);
    case 'spring':
      return analyzeSpring(scanRoot);
    case 'maven':
    case 'gradle':
      return analyzeJava(scanRoot);
    default:
      return analyzeGeneric(scanRoot, maxDepth, lang);
  }
}

async function analyzeGeneric(
  scanRoot: string,
  maxDepth: number,
  lang: string,
): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const glob = sourceFileGlob(lang as any);
  const entryPoints = entryPointFiles(lang as any);

  const pattern = Array.from({ length: maxDepth }, (_, i) =>
    '*' + '/*'.repeat(i),
  ).join(',');

  const dirs = await fg(`{${pattern}}`, {
    cwd: scanRoot,
    onlyDirectories: true,
    absolute: true,
    ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}`),
  });

  for (const dir of dirs) {
    const name = basename(dir);
    if (EXCLUDED_DIRS.has(name)) continue;

    const relPath = relative(scanRoot, dir);
    const depth = relPath.split('/').length;

    const candidate = await scoreDirectory(dir, name, depth, glob, entryPoints);
    if (candidate && candidate.totalScore >= 0.3) {
      candidates.push(candidate);
    }
  }

  return deduplicateCandidates(candidates);
}

async function analyzeMonorepo(
  projectRoot: string,
  classification: ProjectClassification,
  lang: string,
): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const workspaceRoots = classification.workspaceRoots ?? [];
  const glob = sourceFileGlob(lang as any);
  const entryPoints = entryPointFiles(lang as any);

  for (const wsRoot of workspaceRoots) {
    const name = basename(wsRoot);
    const files = await fg(glob, {
      cwd: wsRoot,
      onlyFiles: true,
      ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}/**`),
    });

    if (files.length === 0) continue;

    const hasBarrelExport = entryPoints.length > 0 && files.some((f) =>
      entryPoints.some((ep) => f === ep || f === `src/${ep}`),
    );
    const hasPkg = await fileExists(join(wsRoot, 'package.json'));

    const indicators: string[] = ['workspace package'];
    let score = 0.5;
    if (hasPkg) { score += 0.25; indicators.push('own package.json'); }
    if (hasBarrelExport) { score += 0.15; indicators.push('barrel export'); }

    candidates.push({
      name,
      path: wsRoot,
      depth: 1,
      totalScore: Math.min(score, 1),
      hasBarrelExport,
      hasRoutes: false,
      files,
      indicators,
    });
  }

  return candidates;
}

async function analyzeNextjs(projectRoot: string, lang: string): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const glob = sourceFileGlob(lang as any);

  const appDir = join(projectRoot, 'app');
  if (await dirExists(appDir)) {
    const appDirs = await fg('*', { cwd: appDir, onlyDirectories: true, absolute: true });
    for (const dir of appDirs) {
      const name = basename(dir);
      if (EXCLUDED_DIRS.has(name) || name.startsWith('(') || name.startsWith('_')) continue;

      const files = await fg(glob, { cwd: dir, onlyFiles: true });
      if (files.length === 0) continue;

      const isApi = name === 'api';
      candidates.push({
        name,
        path: dir,
        depth: 1,
        totalScore: isApi ? 0.8 : 0.7,
        hasBarrelExport: false,
        hasRoutes: true,
        files,
        indicators: [isApi ? 'Next.js API routes' : 'Next.js app route'],
      });
    }
  }

  for (const dir of ['lib', 'components', 'hooks', 'services', 'modules', 'features']) {
    for (const prefix of ['src', '']) {
      const fullPath = join(projectRoot, prefix, dir);
      if (await dirExists(fullPath)) {
        const subdirs = await fg('*', { cwd: fullPath, onlyDirectories: true, absolute: true });
        for (const subdir of subdirs) {
          const name = basename(subdir);
          const files = await fg(glob, { cwd: subdir, onlyFiles: true });
          if (files.length === 0) continue;

          candidates.push({
            name,
            path: subdir,
            depth: 2,
            totalScore: 0.5,
            hasBarrelExport: files.some((f) => f === 'index.ts' || f === 'index.js'),
            hasRoutes: false,
            files,
            indicators: [`Next.js ${dir}/ module`],
          });
        }
      }
    }
  }

  return deduplicateCandidates(candidates);
}

async function analyzeNestjs(projectRoot: string, lang: string): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const srcDir = join(projectRoot, 'src');
  const glob = sourceFileGlob(lang as any);
  if (!(await dirExists(srcDir))) return candidates;

  const moduleFiles = await fg('**/*.module.ts', {
    cwd: srcDir,
    onlyFiles: true,
    absolute: true,
    ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}/**`),
  });

  for (const modFile of moduleFiles) {
    const dir = join(modFile, '..');
    const name = basename(dir);
    if (name === 'src') continue;

    const files = await fg(glob, { cwd: dir, onlyFiles: true });

    candidates.push({
      name,
      path: dir,
      depth: relative(srcDir, dir).split('/').length,
      totalScore: 0.85,
      hasBarrelExport: files.some((f) => f === 'index.ts'),
      hasRoutes: files.some((f) => f.includes('controller')),
      files,
      indicators: ['NestJS module file'],
    });
  }

  return deduplicateCandidates(candidates);
}

// ── Python Strategies ──

async function analyzeDjango(projectRoot: string): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const glob = sourceFileGlob('python');

  // Django apps have models.py, views.py, urls.py etc.
  // Scan all top-level and second-level directories for Django app markers
  const dirs = await fg('{*,*/*}', {
    cwd: projectRoot,
    onlyDirectories: true,
    absolute: true,
    ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}`),
  });

  for (const dir of dirs) {
    const name = basename(dir);
    if (EXCLUDED_DIRS.has(name)) continue;

    const files = await fg(glob, {
      cwd: dir,
      onlyFiles: true,
      ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}/**`),
    });

    if (files.length === 0) continue;

    // Django app detection: has models.py or views.py or apps.py
    const hasModels = files.some((f) => f === 'models.py' || f.startsWith('models/'));
    const hasViews = files.some((f) => f === 'views.py' || f.startsWith('views/'));
    const hasAppsConfig = files.some((f) => f === 'apps.py');
    const hasUrls = files.some((f) => f === 'urls.py');
    const hasInit = files.some((f) => f === '__init__.py');

    const isDjangoApp = hasInit && (hasModels || hasViews || hasAppsConfig);
    if (!isDjangoApp) continue;

    const indicators: string[] = ['Django app'];
    let score = 0.6;
    if (hasModels) { score += 0.15; indicators.push('models.py'); }
    if (hasViews) { score += 0.10; indicators.push('views.py'); }
    if (hasUrls) { score += 0.05; indicators.push('urls.py'); }

    candidates.push({
      name,
      path: dir,
      depth: relative(projectRoot, dir).split('/').length,
      totalScore: Math.min(score, 1),
      hasBarrelExport: hasInit,
      hasRoutes: hasUrls || hasViews,
      files,
      indicators,
    });
  }

  return deduplicateCandidates(candidates);
}

async function analyzePythonApp(projectRoot: string): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const glob = sourceFileGlob('python');

  // FastAPI/Flask: scan for routers/, api/, modules/, etc.
  const scanDirs = ['routers', 'api', 'modules', 'services', 'domains', 'features', 'apps'];

  for (const scanDir of scanDirs) {
    const dirPath = join(projectRoot, scanDir);
    if (!(await dirExists(dirPath))) continue;

    const subdirs = await fg('*', { cwd: dirPath, onlyDirectories: true, absolute: true });
    for (const subdir of subdirs) {
      const name = basename(subdir);
      if (EXCLUDED_DIRS.has(name)) continue;

      const files = await fg(glob, { cwd: subdir, onlyFiles: true });
      if (files.length === 0) continue;

      const hasInit = files.some((f) => f === '__init__.py');

      candidates.push({
        name,
        path: subdir,
        depth: 2,
        totalScore: 0.6,
        hasBarrelExport: hasInit,
        hasRoutes: files.some((f) => f.includes('route') || f.includes('endpoint')),
        files,
        indicators: [`Python ${scanDir}/ module`],
      });
    }
  }

  // Also do generic scan as fallback
  const generic = await analyzeGeneric(projectRoot, 3, 'python');
  for (const c of generic) {
    if (!candidates.some((existing) => existing.path === c.path)) {
      candidates.push(c);
    }
  }

  return deduplicateCandidates(candidates);
}

// ── Java Strategies ──

async function analyzeSpring(projectRoot: string): Promise<CandidateModule[]> {
  return analyzeJava(projectRoot);
}

async function analyzeJava(projectRoot: string): Promise<CandidateModule[]> {
  const candidates: CandidateModule[] = [];
  const glob = sourceFileGlob('java');

  // Java standard source root
  const javaSourceRoots = [
    join(projectRoot, 'src', 'main', 'java'),
    join(projectRoot, 'src'),
  ];

  let sourceRoot: string | null = null;
  for (const root of javaSourceRoots) {
    if (await dirExists(root)) {
      sourceRoot = root;
      break;
    }
  }

  if (!sourceRoot) return candidates;

  // In Java, packages are deep — scan at depth up to 6
  // Look for directories with Java files that represent logical modules
  const dirs = await fg('{*,*/*,*/*/*,*/*/*/*,*/*/*/*/*,*/*/*/*/*/*}', {
    cwd: sourceRoot,
    onlyDirectories: true,
    absolute: true,
    ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}`),
  });

  for (const dir of dirs) {
    const name = basename(dir);
    if (EXCLUDED_DIRS.has(name)) continue;

    const files = await fg('*.java', { cwd: dir, onlyFiles: true });
    if (files.length === 0) continue;

    // Java module detection: directories with controllers, services, repositories
    const hasController = files.some((f) => f.toLowerCase().includes('controller'));
    const hasService = files.some((f) => f.toLowerCase().includes('service'));
    const hasRepository = files.some((f) => f.toLowerCase().includes('repository'));
    const hasModel = files.some((f) =>
      f.toLowerCase().includes('model') ||
      f.toLowerCase().includes('entity') ||
      f.toLowerCase().includes('dto'),
    );

    // Score based on Java conventions
    const indicators: string[] = [];
    let score = 0.15;

    if (hasController) { score += 0.2; indicators.push('controller'); }
    if (hasService) { score += 0.15; indicators.push('service'); }
    if (hasRepository) { score += 0.15; indicators.push('repository'); }
    if (hasModel) { score += 0.1; indicators.push('model/entity'); }
    if (files.length >= 3) { score += 0.1; indicators.push(`${files.length} Java files`); }

    const relDepth = relative(sourceRoot, dir).split('/').length;

    // In Java, meaningful modules are often at depth 3-4 (com/example/feature)
    // but domain packages can also be deeper
    if (score >= 0.3) {
      candidates.push({
        name,
        path: dir,
        depth: relDepth,
        totalScore: Math.min(score, 1),
        hasBarrelExport: false,
        hasRoutes: hasController,
        files: files.map((f) => join(relative(sourceRoot, dir), f)),
        indicators,
      });
    }
  }

  return deduplicateCandidates(candidates);
}

// ── Shared Scoring ──

async function scoreDirectory(
  dirPath: string,
  name: string,
  depth: number,
  glob: string,
  entryPoints: string[],
): Promise<CandidateModule | null> {
  const files = await fg(glob, {
    cwd: dirPath,
    onlyFiles: true,
    ignore: [...EXCLUDED_DIRS].map((d) => `**/${d}/**`),
  });

  if (files.length === 0) return null;

  const indicators: string[] = [];
  let score = 0.15;

  // Barrel export / entry point
  const hasBarrelExport = entryPoints.length > 0 && files.some((f) => entryPoints.includes(f));
  if (hasBarrelExport) {
    score += 0.25;
    indicators.push('barrel export');
  }

  // Convention file names
  let conventionHits = 0;
  for (const pattern of CONVENTION_FILE_PATTERNS) {
    if (files.some((f) => f.toLowerCase().includes(pattern))) {
      conventionHits++;
    }
  }
  const conventionBonus = Math.min(conventionHits * 0.05, 0.20);
  if (conventionBonus > 0) {
    score += conventionBonus;
    indicators.push(`${conventionHits} convention file(s)`);
  }

  // Has routes
  const hasRoutes = files.some(
    (f) =>
      f.toLowerCase().includes('route') ||
      f.toLowerCase().includes('controller') ||
      f.toLowerCase().includes('handler') ||
      f.toLowerCase().includes('views') ||
      f.toLowerCase().includes('urls'),
  );
  if (hasRoutes) {
    indicators.push('has routes/controllers');
  }

  // File count
  if (files.length >= 3) {
    score += 0.10;
    indicators.push(`${files.length} source files`);
  } else if (files.length === 1) {
    score -= 0.10;
    indicators.push('single file');
  }

  // Package boundary
  const hasPkgBoundary =
    (await fileExists(join(dirPath, 'package.json'))) ||
    (await fileExists(join(dirPath, 'pyproject.toml'))) ||
    (await fileExists(join(dirPath, 'setup.py'))) ||
    (await fileExists(join(dirPath, 'pom.xml'))) ||
    (await fileExists(join(dirPath, 'build.gradle')));
  if (hasPkgBoundary) {
    score += 0.25;
    indicators.push('own build config');
  }

  // Depth bonus
  if (depth <= 2) {
    score += 0.10;
    indicators.push(`depth ${depth}`);
  }

  // Has subdirectories
  const subdirs = await fg('*', { cwd: dirPath, onlyDirectories: true });
  const meaningfulSubdirs = subdirs.filter((d) => !EXCLUDED_DIRS.has(d));
  if (meaningfulSubdirs.length > 0) {
    score += 0.10;
    indicators.push(`${meaningfulSubdirs.length} subdirectory(ies)`);
  }

  // Utility penalty
  if (UTILITY_NAMES.has(name.toLowerCase())) {
    score -= 0.15;
    indicators.push('utility directory (lower priority)');
  }

  return {
    name,
    path: dirPath,
    depth,
    totalScore: Math.max(score, 0),
    hasBarrelExport,
    hasRoutes,
    files,
    indicators,
  };
}

function deduplicateCandidates(candidates: CandidateModule[]): CandidateModule[] {
  const sorted = candidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.depth - b.depth;
  });

  const accepted: CandidateModule[] = [];
  const acceptedPaths = new Set<string>();

  for (const candidate of sorted) {
    const isNested = Array.from(acceptedPaths).some(
      (p) => candidate.path.startsWith(p + '/'),
    );
    if (isNested) continue;

    accepted.push(candidate);
    acceptedPaths.add(candidate.path);
  }

  return accepted;
}
