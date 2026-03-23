import { join } from 'node:path';
import fg from 'fast-glob';
import { dirExists, fileExists, readFileContent } from '../../utils/fs.js';

export type ProjectType =
  | 'monorepo'
  | 'nextjs'
  | 'nestjs'
  | 'express'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'spring'
  | 'maven'
  | 'gradle'
  | 'library'
  | 'generic';

export type ProjectLanguage = 'typescript' | 'javascript' | 'python' | 'java' | 'mixed' | 'unknown';

export interface SpecKitInfo {
  detected: boolean;
  specifyDir?: string;
  hasConstitution?: boolean;
  features?: string[];
}

export interface ProjectClassification {
  type: ProjectType;
  language: ProjectLanguage;
  confidence: number;
  indicators: string[];
  workspaceRoots?: string[];
  specKit?: SpecKitInfo;
}

/**
 * Returns the source file glob pattern for a given language.
 */
export function sourceFileGlob(language: ProjectLanguage): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return '**/*.{ts,tsx,js,jsx}';
    case 'python':
      return '**/*.py';
    case 'java':
      return '**/*.java';
    case 'mixed':
      return '**/*.{ts,tsx,js,jsx,py,java,kt,go,rb}';
    default:
      return '**/*.{ts,tsx,js,jsx,py,java}';
  }
}

/**
 * Returns entry point file patterns for barrel export detection.
 */
export function entryPointFiles(language: ProjectLanguage): string[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return ['index.ts', 'index.js'];
    case 'python':
      return ['__init__.py'];
    case 'java':
      return []; // Java doesn't have barrel exports
    case 'mixed':
      return ['index.ts', 'index.js', '__init__.py'];
    default:
      return ['index.ts', 'index.js', '__init__.py'];
  }
}

export async function classifyProject(
  projectRoot: string,
): Promise<ProjectClassification> {
  // Detect language first
  const language = await detectLanguage(projectRoot);

  // Detect spec-kit
  const specKit = await detectSpecKit(projectRoot);

  // Check for monorepo indicators
  const monorepoResult = await detectMonorepo(projectRoot);
  if (monorepoResult) {
    return {
      type: 'monorepo',
      language,
      confidence: monorepoResult.confidence,
      indicators: monorepoResult.indicators,
      workspaceRoots: monorepoResult.workspaceRoots,
      specKit,
    };
  }

  // Check for framework-specific indicators (JS/TS)
  if (language === 'typescript' || language === 'javascript' || language === 'mixed') {
    const nextjs = await detectNextjs(projectRoot);
    if (nextjs) {
      return { type: 'nextjs', language, confidence: nextjs.confidence, indicators: nextjs.indicators, specKit };
    }

    const nestjs = await detectNestjs(projectRoot);
    if (nestjs) {
      return { type: 'nestjs', language, confidence: nestjs.confidence, indicators: nestjs.indicators, specKit };
    }

    const express = await detectExpress(projectRoot);
    if (express) {
      return { type: 'express', language, confidence: express.confidence, indicators: express.indicators, specKit };
    }
  }

  // Check for Python frameworks
  if (language === 'python' || language === 'mixed') {
    const django = await detectDjango(projectRoot);
    if (django) {
      return { type: 'django', language, confidence: django.confidence, indicators: django.indicators, specKit };
    }

    const fastapi = await detectFastAPI(projectRoot);
    if (fastapi) {
      return { type: 'fastapi', language, confidence: fastapi.confidence, indicators: fastapi.indicators, specKit };
    }

    const flask = await detectFlask(projectRoot);
    if (flask) {
      return { type: 'flask', language, confidence: flask.confidence, indicators: flask.indicators, specKit };
    }
  }

  // Check for Java build systems
  if (language === 'java' || language === 'mixed') {
    const spring = await detectSpring(projectRoot);
    if (spring) {
      return { type: 'spring', language, confidence: spring.confidence, indicators: spring.indicators, specKit };
    }

    const maven = await detectMaven(projectRoot);
    if (maven) {
      return { type: 'maven', language, confidence: maven.confidence, indicators: maven.indicators, specKit };
    }

    const gradle = await detectGradle(projectRoot);
    if (gradle) {
      return { type: 'gradle', language, confidence: gradle.confidence, indicators: gradle.indicators, specKit };
    }
  }

  // Check for library pattern (JS/TS only)
  if (language === 'typescript' || language === 'javascript') {
    const library = await detectLibrary(projectRoot);
    if (library) {
      return { type: 'library', language, confidence: library.confidence, indicators: library.indicators, specKit };
    }
  }

  return { type: 'generic', language, confidence: 0.5, indicators: ['No specific framework detected'], specKit };
}

// ── Language Detection ──

async function detectLanguage(root: string): Promise<ProjectLanguage> {
  const hasPackageJson = await fileExists(join(root, 'package.json'));
  const hasTsConfig = await fileExists(join(root, 'tsconfig.json'));
  const hasPyProject = await fileExists(join(root, 'pyproject.toml'));
  const hasRequirements = await fileExists(join(root, 'requirements.txt'));
  const hasSetupPy = await fileExists(join(root, 'setup.py'));
  const hasPomXml = await fileExists(join(root, 'pom.xml'));
  const hasBuildGradle =
    (await fileExists(join(root, 'build.gradle'))) ||
    (await fileExists(join(root, 'build.gradle.kts')));

  const isJs = hasPackageJson;
  const isTs = hasTsConfig;
  const isPython = hasPyProject || hasRequirements || hasSetupPy;
  const isJava = hasPomXml || hasBuildGradle;

  const count = [isTs || isJs, isPython, isJava].filter(Boolean).length;

  if (count > 1) return 'mixed';
  if (isTs) return 'typescript';
  if (isJs) return 'javascript';
  if (isPython) return 'python';
  if (isJava) return 'java';
  return 'unknown';
}

// ── Spec-Kit Detection ──

async function detectSpecKit(root: string): Promise<SpecKitInfo> {
  const specifyDir = join(root, '.specify');
  if (!(await dirExists(specifyDir))) {
    return { detected: false };
  }

  const hasConstitution = await fileExists(join(specifyDir, 'constitution.md'));

  // Find feature directories (NNN-feature-name pattern)
  const featureDirs = await fg('*', {
    cwd: specifyDir,
    onlyDirectories: true,
  });
  const features = featureDirs.filter((d) => /^\d{3}-/.test(d));

  return {
    detected: true,
    specifyDir,
    hasConstitution,
    features: features.length > 0 ? features : undefined,
  };
}

// ── Detection Helpers ──

interface DetectionResult {
  confidence: number;
  indicators: string[];
  workspaceRoots?: string[];
}

async function detectMonorepo(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  const workspaceIndicators = [
    { file: 'pnpm-workspace.yaml', label: 'pnpm workspace' },
    { file: 'lerna.json', label: 'Lerna config' },
    { file: 'turbo.json', label: 'Turborepo config' },
    { file: 'nx.json', label: 'Nx config' },
  ];

  for (const { file, label } of workspaceIndicators) {
    if (await fileExists(join(root, file))) {
      indicators.push(label);
      confidence += 0.3;
    }
  }

  const pkgPath = join(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFileContent(pkgPath));
      if (pkg.workspaces) {
        indicators.push('workspaces in package.json');
        confidence += 0.3;
      }
    } catch {
      // ignore
    }
  }

  for (const dir of ['packages', 'apps']) {
    if (await dirExists(join(root, dir))) {
      indicators.push(`${dir}/ directory`);
      confidence += 0.2;
    }
  }

  if (confidence === 0) return null;

  const workspaceRoots: string[] = [];
  for (const dir of ['packages', 'apps', 'libs']) {
    const dirPath = join(root, dir);
    if (await dirExists(dirPath)) {
      const subdirs = await fg('*', { cwd: dirPath, onlyDirectories: true, absolute: true });
      workspaceRoots.push(...subdirs);
    }
  }

  return { confidence: Math.min(confidence, 1), indicators, workspaceRoots };
}

async function detectNextjs(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  const configFiles = await fg('next.config.*', { cwd: root, onlyFiles: true });
  if (configFiles.length > 0) {
    indicators.push('next.config found');
    confidence += 0.5;
  }

  if (await dirExists(join(root, 'app'))) {
    indicators.push('app/ directory (App Router)');
    confidence += 0.2;
  }

  if (await dirExists(join(root, 'pages'))) {
    indicators.push('pages/ directory (Pages Router)');
    confidence += 0.2;
  }

  const pkgPath = join(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFileContent(pkgPath));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) {
        indicators.push('next in dependencies');
        confidence += 0.3;
      }
    } catch {
      // ignore
    }
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function detectNestjs(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  if (await fileExists(join(root, 'nest-cli.json'))) {
    indicators.push('nest-cli.json found');
    confidence += 0.5;
  }

  const moduleFiles = await fg('src/**/*.module.ts', { cwd: root, onlyFiles: true });
  if (moduleFiles.length > 0) {
    indicators.push(`${moduleFiles.length} NestJS module file(s)`);
    confidence += 0.3;
  }

  const pkgPath = join(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFileContent(pkgPath));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@nestjs/core']) {
        indicators.push('@nestjs/core in dependencies');
        confidence += 0.3;
      }
    } catch {
      // ignore
    }
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function detectExpress(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  const pkgPath = join(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFileContent(pkgPath));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const frameworks = ['express', 'fastify', 'hono', 'koa'];
      for (const fw of frameworks) {
        if (deps[fw]) {
          indicators.push(`${fw} in dependencies`);
          confidence += 0.3;
        }
      }
    } catch {
      // ignore
    }
  }

  const entryFiles = await fg('{server,app}.{ts,js}', { cwd: join(root, 'src'), onlyFiles: true });
  if (entryFiles.length > 0) {
    indicators.push('server/app entry file in src/');
    confidence += 0.2;
  }

  if (await dirExists(join(root, 'src', 'routes'))) {
    indicators.push('src/routes/ directory');
    confidence += 0.2;
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

// ── Python Framework Detection ──

async function detectDjango(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  // manage.py is the hallmark of Django
  if (await fileExists(join(root, 'manage.py'))) {
    indicators.push('manage.py found');
    confidence += 0.5;
  }

  // Check for settings.py in common locations
  const settingsFiles = await fg('{*/settings.py,*/settings/*.py,config/settings.py}', {
    cwd: root,
    onlyFiles: true,
  });
  if (settingsFiles.length > 0) {
    indicators.push('Django settings found');
    confidence += 0.2;
  }

  // Check for urls.py
  const urlsFiles = await fg('**/urls.py', { cwd: root, onlyFiles: true });
  if (urlsFiles.length > 0) {
    indicators.push(`${urlsFiles.length} urls.py file(s)`);
    confidence += 0.2;
  }

  // Check requirements/pyproject for django
  const hasDjangoDep = await hasPythonDependency(root, 'django');
  if (hasDjangoDep) {
    indicators.push('django in dependencies');
    confidence += 0.3;
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function detectFastAPI(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  const hasFastAPIDep = await hasPythonDependency(root, 'fastapi');
  if (hasFastAPIDep) {
    indicators.push('fastapi in dependencies');
    confidence += 0.5;
  }

  // Check for main.py or app.py with FastAPI patterns
  const entryFiles = await fg('{main,app}.py', { cwd: root, onlyFiles: true });
  if (entryFiles.length > 0) {
    indicators.push('main/app entry point');
    confidence += 0.2;
  }

  // Check for routers directory
  if (await dirExists(join(root, 'routers')) || await dirExists(join(root, 'api'))) {
    indicators.push('routers/api directory');
    confidence += 0.2;
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function detectFlask(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  const hasFlaskDep = await hasPythonDependency(root, 'flask');
  if (hasFlaskDep) {
    indicators.push('flask in dependencies');
    confidence += 0.5;
  }

  const entryFiles = await fg('{app,wsgi,application}.py', { cwd: root, onlyFiles: true });
  if (entryFiles.length > 0) {
    indicators.push('Flask entry point');
    confidence += 0.2;
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function hasPythonDependency(root: string, pkg: string): Promise<boolean> {
  // Check requirements.txt
  const reqPath = join(root, 'requirements.txt');
  if (await fileExists(reqPath)) {
    try {
      const content = await readFileContent(reqPath);
      if (content.toLowerCase().includes(pkg.toLowerCase())) return true;
    } catch {
      // ignore
    }
  }

  // Check pyproject.toml
  const pyprojectPath = join(root, 'pyproject.toml');
  if (await fileExists(pyprojectPath)) {
    try {
      const content = await readFileContent(pyprojectPath);
      if (content.toLowerCase().includes(pkg.toLowerCase())) return true;
    } catch {
      // ignore
    }
  }

  // Check setup.py
  const setupPath = join(root, 'setup.py');
  if (await fileExists(setupPath)) {
    try {
      const content = await readFileContent(setupPath);
      if (content.toLowerCase().includes(pkg.toLowerCase())) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

// ── Java Detection ──

async function detectSpring(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  // Check for Spring Boot main class pattern
  const springBootFiles = await fg('**/src/**/*Application.java', { cwd: root, onlyFiles: true });
  if (springBootFiles.length > 0) {
    indicators.push('Spring Boot application class');
    confidence += 0.3;
  }

  // Check for application.properties or application.yml
  const springConfigFiles = await fg(
    '**/src/**/application.{properties,yml,yaml}',
    { cwd: root, onlyFiles: true },
  );
  if (springConfigFiles.length > 0) {
    indicators.push('Spring application config');
    confidence += 0.3;
  }

  // Check pom.xml or build.gradle for spring dependencies
  const pomPath = join(root, 'pom.xml');
  if (await fileExists(pomPath)) {
    try {
      const content = await readFileContent(pomPath);
      if (content.includes('spring-boot') || content.includes('springframework')) {
        indicators.push('Spring in pom.xml');
        confidence += 0.3;
      }
    } catch {
      // ignore
    }
  }

  for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
    const gradlePath = join(root, gradleFile);
    if (await fileExists(gradlePath)) {
      try {
        const content = await readFileContent(gradlePath);
        if (content.includes('spring-boot') || content.includes('springframework')) {
          indicators.push('Spring in build.gradle');
          confidence += 0.3;
        }
      } catch {
        // ignore
      }
    }
  }

  return confidence > 0 ? { confidence: Math.min(confidence, 1), indicators } : null;
}

async function detectMaven(root: string): Promise<DetectionResult | null> {
  if (!(await fileExists(join(root, 'pom.xml')))) return null;

  const indicators = ['pom.xml found'];
  let confidence = 0.5;

  // Check for standard Maven directory structure
  if (await dirExists(join(root, 'src', 'main', 'java'))) {
    indicators.push('Maven standard layout (src/main/java)');
    confidence += 0.3;
  }

  return { confidence: Math.min(confidence, 1), indicators };
}

async function detectGradle(root: string): Promise<DetectionResult | null> {
  const hasBuildGradle =
    (await fileExists(join(root, 'build.gradle'))) ||
    (await fileExists(join(root, 'build.gradle.kts')));

  if (!hasBuildGradle) return null;

  const indicators = ['build.gradle found'];
  let confidence = 0.5;

  if (await fileExists(join(root, 'settings.gradle')) || await fileExists(join(root, 'settings.gradle.kts'))) {
    indicators.push('settings.gradle found');
    confidence += 0.2;
  }

  if (await dirExists(join(root, 'src', 'main', 'java'))) {
    indicators.push('Gradle standard layout (src/main/java)');
    confidence += 0.2;
  }

  return { confidence: Math.min(confidence, 1), indicators };
}

async function detectLibrary(root: string): Promise<DetectionResult | null> {
  const indicators: string[] = [];
  let confidence = 0;

  if (await fileExists(join(root, 'src', 'index.ts')) || await fileExists(join(root, 'src', 'index.js'))) {
    indicators.push('src/index entry point');
    confidence += 0.2;
  }

  const pkgPath = join(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFileContent(pkgPath));
      if (pkg.main || pkg.exports || pkg.types || pkg.typings) {
        indicators.push('package exports configured');
        confidence += 0.2;
      }
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const hasFramework = ['next', 'express', 'fastify', '@nestjs/core', 'hono', 'koa'].some(
        (fw) => deps[fw],
      );
      if (!hasFramework) {
        indicators.push('no web framework dependency');
        confidence += 0.1;
      }
    } catch {
      // ignore
    }
  }

  const srcDir = join(root, 'src');
  if (await dirExists(srcDir)) {
    const subdirs = await fg('*', { cwd: srcDir, onlyDirectories: true });
    if (subdirs.length >= 2) {
      indicators.push(`${subdirs.length} subdirectories in src/`);
      confidence += 0.2;
    }
  }

  return confidence >= 0.4 ? { confidence: Math.min(confidence, 1), indicators } : null;
}
