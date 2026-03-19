import yaml from 'js-yaml';
import matter from 'gray-matter';

export function parseYaml<T>(content: string): T {
  return yaml.load(content) as T;
}

export function stringifyYaml(data: unknown): string {
  return yaml.dump(data);
}

export function parseFrontmatter<T>(content: string): { data: T; content: string } {
  const result = matter(content);
  return {
    data: result.data as T,
    content: result.content,
  };
}
