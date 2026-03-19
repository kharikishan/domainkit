import { join, relative, sep } from 'node:path';
import fg from 'fast-glob';
import { requireOptional } from '../utils/optional-import.js';
import type { Skill, Contract, DriftIssue } from '../core/types.js';

// ---------------------------------------------------------------------------
// ts-morph type shims — only imported at runtime when available
// ---------------------------------------------------------------------------

interface TsMorphProject {
  addSourceFileAtPath(path: string): TsMorphSourceFile;
}

interface TsMorphSourceFile {
  getDescendantsOfKind(kind: number): TsMorphNode[];
}

interface TsMorphNode {
  getExpression(): TsMorphNode;
  getArguments(): TsMorphNode[];
  getText(): string;
  getKind(): number;
}

interface TsMorphModule {
  Project: new (opts?: Record<string, unknown>) => TsMorphProject;
  SyntaxKind: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Express route extraction
// ---------------------------------------------------------------------------

const EXPRESS_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

/**
 * Use ts-morph to parse `filePath` and extract route strings from Express-style
 * calls like `router.get('/path', ...)` or `app.post('/path', ...)`.
 *
 * Returns an array of strings in the format "METHOD /path".
 * Gracefully returns an empty array when ts-morph is not installed.
 */
export async function extractExpressRoutes(filePath: string): Promise<string[]> {
  let tsMorph: TsMorphModule;
  try {
    tsMorph = await requireOptional<TsMorphModule>('ts-morph', 'API route extraction');
  } catch (err: unknown) {
    console.warn(`[domainkit/drift] Skipping Express route extraction: ${String(err)}`);
    return [];
  }

  const routes: string[] = [];

  try {
    const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });
    const sourceFile = project.addSourceFileAtPath(filePath);

    // SyntaxKind.CallExpression = 213
    const callExpressions = sourceFile.getDescendantsOfKind(
      tsMorph.SyntaxKind['CallExpression'] as number,
    );

    for (const call of callExpressions) {
      // We want: <expr>.<method>(<firstArg>, ...)
      // The expression of a CallExpression is a PropertyAccessExpression when using dot notation
      let expr: TsMorphNode;
      try {
        expr = call.getExpression();
      } catch {
        continue;
      }

      // Check whether this is a property access (e.g. router.get)
      if (expr.getKind() !== tsMorph.SyntaxKind['PropertyAccessExpression']) continue;

      const exprText = expr.getText(); // e.g. "router.get"
      const dotIdx = exprText.lastIndexOf('.');
      if (dotIdx === -1) continue;

      const method = exprText.slice(dotIdx + 1).toLowerCase();
      if (!EXPRESS_METHODS.has(method)) continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const firstArg = args[0];
      // Extract string literal value — getText() returns the quoted form
      const rawText = firstArg.getText();
      const routePath = unquoteStringLiteral(rawText);
      if (routePath !== null) {
        routes.push(`${method.toUpperCase()} ${routePath}`);
      }
    }
  } catch (err: unknown) {
    console.warn(`[domainkit/drift] Error parsing "${filePath}" for Express routes: ${String(err)}`);
  }

  return routes;
}

/** Remove surrounding quotes from a TypeScript string literal. */
function unquoteStringLiteral(raw: string): string | null {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Next.js App Router route extraction
// ---------------------------------------------------------------------------

/**
 * Scan `appDir` for Next.js App Router route files (`route.ts` / `route.js`)
 * and convert their directory paths into route strings.
 *
 * For example: `app/api/users/[id]/route.ts` → `/api/users/[id]`
 *
 * Dynamic segments are kept as-is (e.g. `[id]`, `[...slug]`).
 */
export async function extractNextjsRoutes(appDir: string): Promise<string[]> {
  const pattern = `${appDir.replace(/\\/g, '/')}/**/route.{ts,js,tsx,jsx}`;
  let routeFiles: string[];

  try {
    routeFiles = await fg(pattern, { onlyFiles: true, absolute: true });
  } catch (err: unknown) {
    console.warn(`[domainkit/drift] Error scanning Next.js app dir: ${String(err)}`);
    return [];
  }

  return routeFiles.map((filePath) => {
    // Remove the appDir prefix and the trailing /route.<ext>
    const rel = relative(appDir, filePath);
    // Strip the filename ("route.ts" / "route.js" etc.)
    const segments = rel.split(sep).slice(0, -1);
    // Convert to POSIX path with a leading slash
    return '/' + segments.join('/');
  });
}

// ---------------------------------------------------------------------------
// Skill / contract route extraction
// ---------------------------------------------------------------------------

/**
 * Return the documented API routes from a skill's `domainkit-api-routes`
 * metadata field.  Values are expected to already be formatted as "METHOD /path".
 */
export function extractSkillRoutes(skill: Skill): string[] {
  return skill.metadata['domainkit-api-routes'] ?? [];
}

/**
 * Return the documented API routes from a contract's `api.routes` array,
 * formatted as "METHOD /path".
 */
export function extractContractRoutes(contract: Contract): string[] {
  if (!contract.api?.routes) return [];

  return contract.api.routes.map((r) => `${r.method.toUpperCase()} ${r.path}`);
}

// ---------------------------------------------------------------------------
// Route diffing
// ---------------------------------------------------------------------------

/**
 * Compare the actual routes found in code against the routes documented in the
 * skill / contract metadata and produce DriftIssues:
 *
 *  - Routes in `actual` but not in `documented` → 'route-mismatch' / info
 *    (new undocumented route)
 *  - Routes in `documented` but not in `actual` → 'route-mismatch' / warning
 *    (documented route no longer found in code)
 */
export function diffRoutes(actual: string[], documented: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];

  const actualSet = new Set(actual.map(normaliseRoute));
  const documentedSet = new Set(documented.map(normaliseRoute));

  // Undocumented routes (present in code, absent in docs)
  for (const route of actualSet) {
    if (!documentedSet.has(route)) {
      issues.push({
        type: 'route-mismatch',
        severity: 'info',
        message: `Route "${route}" exists in code but is not documented in the skill/contract.`,
        details: { route, direction: 'undocumented' },
      });
    }
  }

  // Missing routes (documented but not found in code)
  for (const route of documentedSet) {
    if (!actualSet.has(route)) {
      issues.push({
        type: 'route-mismatch',
        severity: 'warning',
        message: `Route "${route}" is documented but was not found in the codebase.`,
        details: { route, direction: 'missing' },
      });
    }
  }

  return issues;
}

/** Normalise a route string for comparison (uppercase method, trimmed path). */
function normaliseRoute(route: string): string {
  const spaceIdx = route.indexOf(' ');
  if (spaceIdx === -1) return route.toUpperCase().trim();
  const method = route.slice(0, spaceIdx).toUpperCase();
  const path = route.slice(spaceIdx + 1).trim();
  return `${method} ${path}`;
}
