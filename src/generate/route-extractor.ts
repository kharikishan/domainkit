import { extractExpressRoutes, extractNextjsRoutes } from '../drift/api-routes.js';
import { dirExists } from '../utils/fs.js';
import { join } from 'node:path';

export interface ExtractedRoute {
  method: string;
  path: string;
  source: 'express' | 'nextjs';
}

export async function extractRoutes(
  modulePath: string,
  sourceRoot: string,
): Promise<ExtractedRoute[]> {
  const routes: ExtractedRoute[] = [];

  // Try Express routes from route/controller files
  const fg = (await import('fast-glob')).default;
  const routeFiles = await fg(
    '**/*.{ts,js}',
    {
      cwd: modulePath,
      onlyFiles: true,
      absolute: true,
    },
  );

  for (const file of routeFiles) {
    if (file.includes('route') || file.includes('controller')) {
      const expressRoutes = await extractExpressRoutes(file);
      for (const r of expressRoutes) {
        const [method, path] = r.split(' ');
        routes.push({ method, path, source: 'express' });
      }
    }
  }

  // Try Next.js app router
  const appDir = join(sourceRoot, 'app');
  if (await dirExists(appDir)) {
    const nextRoutes = await extractNextjsRoutes(appDir);
    for (const path of nextRoutes) {
      routes.push({ method: 'ALL', path, source: 'nextjs' });
    }
  }

  return routes;
}
