import type { Skill } from './types.js';

// ---------------------------------------------------------------------------
// Metadata field name constants
// ---------------------------------------------------------------------------

export const METADATA_DOMAIN = 'domainkit-domain' as const;
export const METADATA_VERSION = 'domainkit-version' as const;
export const METADATA_DEPENDENCIES = 'domainkit-dependencies' as const;
export const METADATA_CODE_PATHS = 'domainkit-code-paths' as const;
export const METADATA_LAST_VERIFIED = 'domainkit-last-verified' as const;
export const METADATA_API_ROUTES = 'domainkit-api-routes' as const;

// ---------------------------------------------------------------------------
// Scoring & threshold constants
// ---------------------------------------------------------------------------

export const SCORE_THRESHOLD_FRESH = 80;
export const SCORE_THRESHOLD_STALE = 50;
export const DEFAULT_STALENESS_THRESHOLD = 30;
export const DEFAULT_TOKEN_BUDGET = 8000;

/** TF-IDF / keyword match strength thresholds */
export const MATCH_STRONG_THRESHOLD = 0.3;
export const MATCH_WEAK_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective domain for a skill, checking domainkit-domain first,
 * then falling back to the standard domain field, then a default value.
 */
export function getSkillDomain(skill: Skill, fallback = ''): string {
  return skill.metadata[METADATA_DOMAIN] ?? skill.metadata.domain ?? fallback;
}

/**
 * Resolve the effective dependencies for a skill, checking domainkit-dependencies
 * first, then falling back to the standard dependencies field.
 */
export function getSkillDependencies(skill: Skill): string[] {
  return skill.metadata[METADATA_DEPENDENCIES] ?? skill.metadata.dependencies ?? [];
}

/**
 * Resolve the code paths for a skill from metadata.
 */
export function getSkillCodePaths(skill: Skill): string[] {
  return skill.metadata[METADATA_CODE_PATHS] ?? [];
}
