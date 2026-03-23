import { join } from 'node:path';
import fg from 'fast-glob';
import type { PersonaDefinition, PersonaSection } from './types.js';
import { BUILTIN_PERSONAS } from './builtin.js';
import { fileExists, readFileContent } from '../utils/fs.js';
import { parseYaml } from '../utils/yaml.js';

const builtinMap = new Map<string, PersonaDefinition>(
  BUILTIN_PERSONAS.map((p) => [p.id, p]),
);

export function loadBuiltinPersonas(): Map<string, PersonaDefinition> {
  return new Map(builtinMap);
}

export async function loadCustomPersonas(
  projectRoot: string,
): Promise<Map<string, PersonaDefinition>> {
  const personasDir = join(projectRoot, '.domainkit', 'personas');
  const custom = new Map<string, PersonaDefinition>();

  try {
    const files = await fg('*.yaml', {
      cwd: personasDir,
      onlyFiles: true,
      absolute: true,
    });

    for (const filePath of files) {
      const content = await readFileContent(filePath);
      const persona = parseYaml<PersonaDefinition>(content);
      if (persona && persona.id) {
        custom.set(persona.id, persona);
      }
    }
  } catch {
    // No custom personas directory — that's fine
  }

  return custom;
}

export async function getAllPersonas(
  projectRoot?: string,
): Promise<Map<string, PersonaDefinition>> {
  const all = loadBuiltinPersonas();

  if (projectRoot) {
    const custom = await loadCustomPersonas(projectRoot);
    for (const [id, persona] of custom) {
      all.set(id, persona);
    }
  }

  return all;
}

export async function getPersona(
  id: string,
  projectRoot?: string,
): Promise<PersonaDefinition | undefined> {
  // Check built-in first
  if (builtinMap.has(id)) {
    return builtinMap.get(id);
  }

  // Check custom
  if (projectRoot) {
    const customPath = join(projectRoot, '.domainkit', 'personas', `${id}.yaml`);
    if (await fileExists(customPath)) {
      const content = await readFileContent(customPath);
      return parseYaml<PersonaDefinition>(content);
    }
  }

  return undefined;
}

export async function listPersonas(
  projectRoot?: string,
): Promise<PersonaDefinition[]> {
  const all = await getAllPersonas(projectRoot);
  return Array.from(all.values());
}

export function mergePersonas(personas: PersonaDefinition[]): PersonaDefinition {
  if (personas.length === 0) {
    throw new Error('Cannot merge zero personas');
  }

  if (personas.length === 1) {
    return personas[0];
  }

  const mergedSections: PersonaSection[] = [];
  const seenHeadings = new Set<string>();

  for (const persona of personas) {
    for (const section of persona.sections) {
      if (!seenHeadings.has(section.heading)) {
        seenHeadings.add(section.heading);
        mergedSections.push(section);
      }
    }
  }

  const mergedFocusAreas = [
    ...new Set(personas.flatMap((p) => p.focusAreas)),
  ];

  return {
    id: personas.map((p) => p.id).join('+'),
    name: personas.map((p) => p.name).join(' + '),
    description: `Merged persona: ${personas.map((p) => p.name).join(', ')}`,
    focusAreas: mergedFocusAreas,
    sections: mergedSections,
    promptContext: personas.map((p) => p.promptContext).join('\n\n'),
    priority: 'primary',
  };
}
