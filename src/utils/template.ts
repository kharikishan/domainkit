import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the package root.
// In source: src/utils/template.ts → go up 2 levels to reach repo root.
// In bundled dist: dist/chunk-XXX.js → go up 1 level to reach package root.
// We check both and use whichever has a templates/ directory.
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findTemplatesDir(): string {
  // Try going up 1 level (bundled dist/ scenario)
  const fromDist = join(__dirname, '..', 'templates');
  if (existsSync(fromDist)) return fromDist;

  // Try going up 2 levels (source src/utils/ scenario)
  const fromSrc = join(__dirname, '..', '..', 'templates');
  if (existsSync(fromSrc)) return fromSrc;

  // Fallback
  return fromDist;
}

const TEMPLATES_DIR = findTemplatesDir();

Handlebars.registerHelper('titleCase', (str: string): string => {
  if (typeof str !== 'string') return str;
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
});

export async function loadTemplate(name: string): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, name);
  return readFile(templatePath, 'utf-8');
}

export async function renderTemplate(
  templateName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const source = await loadTemplate(templateName);
  const compiled = Handlebars.compile(source);
  return compiled(data);
}
