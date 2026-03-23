import { encode } from 'gpt-tokenizer';
import type { Skill, TokenBudget, ContextDepth } from './types.js';

export function countTokens(text: string): number {
  return encode(text).length;
}

export function createBudget(total: number): TokenBudget {
  return { total, used: 0, remaining: total };
}

export function fitsInBudget(budget: TokenBudget, tokens: number): boolean {
  return tokens <= budget.remaining;
}

export function consumeBudget(budget: TokenBudget, tokens: number): TokenBudget {
  const used = budget.used + tokens;
  const remaining = budget.total - used;
  return { total: budget.total, used, remaining };
}

export function estimateSkillTokens(skill: Skill, depth: ContextDepth): number {
  const BASE = 50;
  const nameTokens = countTokens(skill.metadata.name);
  const descTokens = countTokens(skill.metadata.description);

  switch (depth) {
    case 'index':
      return BASE + nameTokens + descTokens;

    case 'contract': {
      const metaTokens = BASE + nameTokens + descTokens;
      if (!skill.hasContract) return metaTokens;
      // Contract content is not pre-loaded here; estimate based on typical contract size
      const contractEstimate = 200;
      return metaTokens + contractEstimate;
    }

    case 'full': {
      const metaTokens = BASE + nameTokens + descTokens;
      const bodyTokens = countTokens(skill.body);
      return metaTokens + bodyTokens;
    }

    default:
      return BASE + nameTokens + descTokens;
  }
}
