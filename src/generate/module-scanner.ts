import { join, basename } from 'node:path';
import fg from 'fast-glob';
import { requireOptional } from '../utils/optional-import.js';
import { dirExists } from '../utils/fs.js';

export interface DiscoveredModule {
  name: string;
  path: string;
  confidence: number;
  hasBarrelExport: boolean;
  hasRoutes: boolean;
  files: string[];
}

const MODULE_DIRS = ['modules', 'features', 'domains', 'services'];

export async function scanForModules(
  sourceRoot: string,
  filterModules?: string[],
): Promise<DiscoveredModule[]> {
  const modules: DiscoveredModule[] = [];

  for (const dir of MODULE_DIRS) {
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

      const files = await fg('**/*.{ts,tsx,js,jsx}', {
        cwd: subdir,
        onlyFiles: true,
      });

      const hasBarrelExport = files.some(
        (f) => f === 'index.ts' || f === 'index.js',
      );
      const hasRoutes = files.some(
        (f) =>
          f.includes('route') ||
          f.includes('controller') ||
          f.includes('handler'),
      );

      let confidence = 0.3;
      if (hasBarrelExport) confidence += 0.3;
      if (hasRoutes) confidence += 0.2;
      if (files.length >= 3) confidence += 0.2;

      modules.push({
        name,
        path: subdir,
        confidence: Math.min(confidence, 1),
        hasBarrelExport,
        hasRoutes,
        files,
      });
    }
  }

  return modules.sort((a, b) => b.confidence - a.confidence);
}
