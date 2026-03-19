import type { Skill, MatchResult } from './types.js';
import { requireOptional } from '../utils/optional-import.js';

// ---------------------------------------------------------------------------
// Stop words list used in the keyword-overlap fallback
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'as', 'if', 'so', 'up', 'out', 'not',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function classifyScore(score: number): 'strong' | 'weak' | 'none' {
  if (score > 0.3) return 'strong';
  if (score > 0.1) return 'weak';
  return 'none';
}

function skillCorpusText(skill: Skill): string {
  return `${skill.metadata.name} ${skill.metadata.description} ${skill.body}`;
}

// ---------------------------------------------------------------------------
// Keyword-overlap fallback matcher
// ---------------------------------------------------------------------------

function keywordMatch(task: string, skills: Skill[]): MatchResult[] {
  const taskTokens = new Set(tokenize(task));
  if (taskTokens.size === 0) return [];

  const results: MatchResult[] = [];

  for (const skill of skills) {
    const corpusTokens = new Set(tokenize(skillCorpusText(skill)));
    if (corpusTokens.size === 0) continue;

    let overlap = 0;
    for (const token of taskTokens) {
      if (corpusTokens.has(token)) overlap++;
    }

    const union = new Set([...taskTokens, ...corpusTokens]).size;
    const score = union > 0 ? overlap / union : 0;
    const strength = classifyScore(score);

    if (strength !== 'none') {
      results.push({
        skill: skill.metadata.name,
        domain: skill.metadata.domain ?? skill.metadata['domainkit-domain'] ?? 'unknown',
        score,
        strength,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// TF-IDF matcher using the `natural` package
// ---------------------------------------------------------------------------

interface NaturalModule {
  TfIdf: new () => {
    addDocument(text: string): void;
    tfidfs(query: string, cb: (i: number, measure: number) => void): void;
  };
}

async function tfidfMatch(task: string, skills: Skill[]): Promise<MatchResult[]> {
  const natural = await requireOptional<NaturalModule>('natural', 'intelligent task-to-domain matching');
  const tfidf = new natural.TfIdf();

  for (const skill of skills) {
    tfidf.addDocument(skillCorpusText(skill));
  }

  const scores: number[] = new Array(skills.length).fill(0);
  tfidf.tfidfs(task, (i: number, measure: number) => {
    scores[i] = measure;
  });

  // Normalise so max score = 1.0 (avoids absolute-value dependency on corpus size)
  const maxScore = Math.max(...scores, 1);

  const results: MatchResult[] = [];
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i]!;
    const score = scores[i]! / maxScore;
    const strength = classifyScore(score);

    if (strength !== 'none') {
      results.push({
        skill: skill.metadata.name,
        domain: skill.metadata.domain ?? skill.metadata['domainkit-domain'] ?? 'unknown',
        score,
        strength,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function matchTaskToDomains(task: string, skills: Skill[]): Promise<MatchResult[]> {
  try {
    return await tfidfMatch(task, skills);
  } catch {
    // `natural` is not installed — fall back to keyword overlap
    return keywordMatch(task, skills);
  }
}
