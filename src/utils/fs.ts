import { stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

export async function readFileContent(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function writeFileContent(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, 'utf-8');
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function resolveProjectRoot(startDir?: string): Promise<string | null> {
  let current = startDir ?? process.cwd();

  while (true) {
    const hasDomainkit = await dirExists(join(current, '.domainkit'));
    if (hasDomainkit) return current;

    const hasGit = await dirExists(join(current, '.git'));
    if (hasGit) return current;

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
