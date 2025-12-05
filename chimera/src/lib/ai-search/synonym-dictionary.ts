/**
 * Semantic Synonym Dictionary for AI Search Optimization
 *
 * Provides synonym expansion and similarity weighting for semantic matching.
 * Used by the Semantic Engine to understand that "phone" and "smartphone" mean the same thing.
 *
 * @module synonym-dictionary
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { SynonymGroup, BUILTIN_SYNONYMS } from './types';

/** Default weight for synonym matches (0.8x exact match) */
export const SYNONYM_WEIGHT = 0.8;

/** Exact match weight */
export const EXACT_MATCH_WEIGHT = 1.0;

/**
 * Synonym Dictionary for semantic token expansion
 */
export interface SynonymDictionary {
  /** All synonym groups in the dictionary */
  groups: SynonymGroup[];
  /** Expand a token to all its synonyms (including canonical) */
  expand(token: string): string[];
  /** Add a new synonym group or extend existing */
  addSynonym(word: string, synonyms: string[]): void;
  /** Get similarity weight between two tokens */
  getSimilarityWeight(token1: string, token2: string): number;
  /** Find the group containing a token */
  findGroup(token: string): SynonymGroup | null;
}

/**
 * Normalizes a token for comparison (lowercase, trimmed)
 */
function normalizeToken(token: string): string {
  return token.toLowerCase().trim();
}

/**
 * Creates a new Synonym Dictionary with built-in groups
 *
 * @param customGroups - Optional additional synonym groups to include
 * @returns A SynonymDictionary instance
 */
export function createSynonymDictionary(
  customGroups: SynonymGroup[] = []
): SynonymDictionary {
  // Combine built-in and custom groups
  const groups: SynonymGroup[] = [...BUILTIN_SYNONYMS, ...customGroups];

  /**
   * Find the synonym group containing a token
   */
  function findGroup(token: string): SynonymGroup | null {
    const normalized = normalizeToken(token);

    for (const group of groups) {
      // Check if token matches canonical
      if (normalizeToken(group.canonical) === normalized) {
        return group;
      }
      // Check if token matches any synonym
      if (group.synonyms.some(syn => normalizeToken(syn) === normalized)) {
        return group;
      }
    }

    return null;
  }

  /**
   * Expand a token to all its synonyms including the canonical term
   */
  function expand(token: string): string[] {
    const group = findGroup(token);

    if (!group) {
      // Token not in any group, return just the token itself
      return [normalizeToken(token)];
    }

    // Return canonical + all synonyms
    const allTerms = [group.canonical, ...group.synonyms];
    return allTerms.map(normalizeToken);
  }

  /**
   * Add a new synonym or extend an existing group
   */
  function addSynonym(word: string, synonyms: string[]): void {
    const normalized = normalizeToken(word);
    const existingGroup = findGroup(normalized);

    if (existingGroup) {
      // Extend existing group with new synonyms
      for (const syn of synonyms) {
        const normalizedSyn = normalizeToken(syn);
        if (
          normalizedSyn !== normalizeToken(existingGroup.canonical) &&
          !existingGroup.synonyms.some(s => normalizeToken(s) === normalizedSyn)
        ) {
          existingGroup.synonyms.push(normalizedSyn);
        }
      }
    } else {
      // Create new group
      groups.push({
        canonical: normalized,
        synonyms: synonyms.map(normalizeToken),
        weight: SYNONYM_WEIGHT,
      });
    }
  }

  /**
   * Get similarity weight between two tokens
   * Returns 1.0 for exact match, 0.8 for synonym match, 0 for no match
   */
  function getSimilarityWeight(token1: string, token2: string): number {
    const norm1 = normalizeToken(token1);
    const norm2 = normalizeToken(token2);

    // Exact match
    if (norm1 === norm2) {
      return EXACT_MATCH_WEIGHT;
    }

    // Check if they're in the same synonym group
    const group1 = findGroup(norm1);
    const group2 = findGroup(norm2);

    if (group1 && group2 && group1 === group2) {
      return group1.weight;
    }

    // No match
    return 0;
  }

  return {
    groups,
    expand,
    addSynonym,
    getSimilarityWeight,
    findGroup,
  };
}

// Export a default dictionary instance for convenience
export const defaultSynonymDictionary = createSynonymDictionary();
