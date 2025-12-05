/**
 * Property-Based Tests for Semantic Synonym Dictionary
 *
 * **Feature: ai-search-optimization, Property 3: Synonym Expansion Completeness**
 * **Validates: Requirements 2.1**
 *
 * **Feature: ai-search-optimization, Property 4: Synonym Match Weighting**
 * **Validates: Requirements 2.5**
 *
 * Tests that synonym expansion returns all synonyms and weighting is correct.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createSynonymDictionary,
  SYNONYM_WEIGHT,
  EXACT_MATCH_WEIGHT,
} from '@/lib/ai-search/synonym-dictionary';
import { BUILTIN_SYNONYMS, SynonymGroup } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// Arbitrary for generating valid tokens (lowercase alphanumeric)
const tokenArb = fc
  .string({ minLength: 1, maxLength: 15, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) })
  .filter(s => s.length > 0);

// Arbitrary for selecting a random built-in synonym group
const builtinGroupArb = fc.constantFrom(...BUILTIN_SYNONYMS);

// Arbitrary for selecting a random token from a synonym group (canonical or synonym)
const tokenFromGroupArb = (group: SynonymGroup) =>
  fc.constantFrom(group.canonical, ...group.synonyms);

describe('Property 3: Synonym Expansion Completeness', () => {
  /**
   * **Feature: ai-search-optimization, Property 3: Synonym Expansion Completeness**
   * **Validates: Requirements 2.1**
   *
   * For any token that exists in the synonym dictionary, calling expand()
   * SHALL return all synonyms in that token's group including the canonical term.
   */

  it('expand() returns all synonyms including canonical for any token in a group', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test with canonical term
        const expandedFromCanonical = dictionary.expand(group.canonical);

        // Should contain canonical
        expect(expandedFromCanonical).toContain(group.canonical.toLowerCase());

        // Should contain all synonyms
        for (const synonym of group.synonyms) {
          expect(expandedFromCanonical).toContain(synonym.toLowerCase());
        }

        // Total count should be canonical + all synonyms
        expect(expandedFromCanonical.length).toBe(1 + group.synonyms.length);
      }),
      FC_CONFIG
    );
  });

  it('expand() returns all synonyms when called with any synonym from the group', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test with each synonym in the group
        for (const synonym of group.synonyms) {
          // Find which group this synonym actually belongs to (first match wins)
          const actualGroup = dictionary.findGroup(synonym);
          if (!actualGroup) continue;

          const expanded = dictionary.expand(synonym);

          // Should contain the actual group's canonical
          expect(expanded).toContain(actualGroup.canonical.toLowerCase());

          // Should contain all synonyms from the actual group
          for (const syn of actualGroup.synonyms) {
            expect(expanded).toContain(syn.toLowerCase());
          }

          // Total count should be canonical + all synonyms from actual group
          expect(expanded.length).toBe(1 + actualGroup.synonyms.length);
        }
      }),
      FC_CONFIG
    );
  });

  it('expand() is case-insensitive', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        const lowerExpanded = dictionary.expand(group.canonical.toLowerCase());
        const upperExpanded = dictionary.expand(group.canonical.toUpperCase());
        const mixedExpanded = dictionary.expand(
          group.canonical.charAt(0).toUpperCase() + group.canonical.slice(1).toLowerCase()
        );

        // All should return the same results
        expect(lowerExpanded.sort()).toEqual(upperExpanded.sort());
        expect(lowerExpanded.sort()).toEqual(mixedExpanded.sort());
      }),
      FC_CONFIG
    );
  });

  it('expand() returns only the token itself for unknown tokens', () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        const dictionary = createSynonymDictionary();

        // Skip if token happens to be in a built-in group
        if (dictionary.findGroup(token) !== null) {
          return;
        }

        const expanded = dictionary.expand(token);

        expect(expanded).toHaveLength(1);
        expect(expanded[0]).toBe(token.toLowerCase());
      }),
      FC_CONFIG
    );
  });

  it('findGroup() returns a group for any token in that group', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test canonical - should always return its own group
        const foundFromCanonical = dictionary.findGroup(group.canonical);
        expect(foundFromCanonical).not.toBeNull();
        expect(foundFromCanonical!.canonical).toBe(group.canonical);

        // Test each synonym - should return SOME group containing it
        // (may not be this group if synonym appears in multiple groups)
        for (const synonym of group.synonyms) {
          const found = dictionary.findGroup(synonym);
          expect(found).not.toBeNull();
          // The found group should contain this synonym
          const allTerms = [found!.canonical, ...found!.synonyms].map(t => t.toLowerCase());
          expect(allTerms).toContain(synonym.toLowerCase());
        }
      }),
      FC_CONFIG
    );
  });

  it('addSynonym() extends existing group with new synonyms', () => {
    fc.assert(
      fc.property(builtinGroupArb, tokenArb, (group, newSynonym) => {
        const dictionary = createSynonymDictionary();

        // Skip if newSynonym is already in the group
        const existingExpanded = dictionary.expand(group.canonical);
        if (existingExpanded.includes(newSynonym.toLowerCase())) {
          return;
        }

        // Add new synonym
        dictionary.addSynonym(group.canonical, [newSynonym]);

        // Verify it's now included
        const expanded = dictionary.expand(group.canonical);
        expect(expanded).toContain(newSynonym.toLowerCase());
      }),
      FC_CONFIG
    );
  });

  it('addSynonym() creates new group for unknown tokens', () => {
    fc.assert(
      fc.property(tokenArb, tokenArb, (word, synonym) => {
        const dictionary = createSynonymDictionary();

        // Skip if word is already in a built-in group
        if (dictionary.findGroup(word) !== null) {
          return;
        }

        // Add new synonym group
        dictionary.addSynonym(word, [synonym]);

        // Verify group was created
        const group = dictionary.findGroup(word);
        expect(group).not.toBeNull();
        expect(group!.canonical).toBe(word.toLowerCase());

        // Verify expansion works
        const expanded = dictionary.expand(word);
        expect(expanded).toContain(word.toLowerCase());
        expect(expanded).toContain(synonym.toLowerCase());
      }),
      FC_CONFIG
    );
  });
});


describe('Property 4: Synonym Match Weighting', () => {
  /**
   * **Feature: ai-search-optimization, Property 4: Synonym Match Weighting**
   * **Validates: Requirements 2.5**
   *
   * For any two tokens where one is a synonym of the other,
   * the similarity weight SHALL be exactly 0.8x the weight of an exact match.
   */

  it('getSimilarityWeight() returns 1.0 for exact matches', () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        const dictionary = createSynonymDictionary();

        const weight = dictionary.getSimilarityWeight(token, token);

        expect(weight).toBe(EXACT_MATCH_WEIGHT);
      }),
      FC_CONFIG
    );
  });

  it('getSimilarityWeight() returns 0.8 for synonym matches', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test canonical vs each synonym
        for (const synonym of group.synonyms) {
          // Only test if this synonym actually belongs to this group
          const actualGroup = dictionary.findGroup(synonym);
          if (actualGroup?.canonical !== group.canonical) continue;

          const weight = dictionary.getSimilarityWeight(group.canonical, synonym);

          expect(weight).toBe(SYNONYM_WEIGHT);
          expect(weight).toBe(0.8 * EXACT_MATCH_WEIGHT);
        }
      }),
      FC_CONFIG
    );
  });

  it('getSimilarityWeight() returns 0.8 for any pair of synonyms in the same group', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test pairs of synonyms (not including canonical)
        // Only test synonyms that actually belong to this group
        const synonymsInThisGroup = group.synonyms.filter(syn => {
          const actualGroup = dictionary.findGroup(syn);
          return actualGroup?.canonical === group.canonical;
        });

        for (let i = 0; i < synonymsInThisGroup.length; i++) {
          for (let j = i + 1; j < synonymsInThisGroup.length; j++) {
            const weight = dictionary.getSimilarityWeight(
              synonymsInThisGroup[i],
              synonymsInThisGroup[j]
            );

            expect(weight).toBe(SYNONYM_WEIGHT);
          }
        }
      }),
      FC_CONFIG
    );
  });

  it('getSimilarityWeight() returns 0 for unrelated tokens', () => {
    fc.assert(
      fc.property(tokenArb, tokenArb, (token1, token2) => {
        const dictionary = createSynonymDictionary();

        // Skip if tokens are the same
        if (token1.toLowerCase() === token2.toLowerCase()) {
          return;
        }

        // Skip if either token is in a built-in group
        const group1 = dictionary.findGroup(token1);
        const group2 = dictionary.findGroup(token2);

        // Skip if both are in the same group
        if (group1 && group2 && group1 === group2) {
          return;
        }

        // If they're in different groups or not in any group, weight should be 0
        if (!group1 || !group2 || group1 !== group2) {
          const weight = dictionary.getSimilarityWeight(token1, token2);
          expect(weight).toBe(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('getSimilarityWeight() is symmetric', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        // Test canonical vs synonym in both directions
        for (const synonym of group.synonyms) {
          const weight1 = dictionary.getSimilarityWeight(group.canonical, synonym);
          const weight2 = dictionary.getSimilarityWeight(synonym, group.canonical);

          expect(weight1).toBe(weight2);
        }
      }),
      FC_CONFIG
    );
  });

  it('getSimilarityWeight() is case-insensitive', () => {
    fc.assert(
      fc.property(builtinGroupArb, (group) => {
        const dictionary = createSynonymDictionary();

        const synonym = group.synonyms[0];

        const weightLower = dictionary.getSimilarityWeight(
          group.canonical.toLowerCase(),
          synonym.toLowerCase()
        );
        const weightUpper = dictionary.getSimilarityWeight(
          group.canonical.toUpperCase(),
          synonym.toUpperCase()
        );
        const weightMixed = dictionary.getSimilarityWeight(
          group.canonical.toUpperCase(),
          synonym.toLowerCase()
        );

        expect(weightLower).toBe(weightUpper);
        expect(weightLower).toBe(weightMixed);
      }),
      FC_CONFIG
    );
  });

  it('synonym weight is exactly 0.8x exact match weight', () => {
    // This is a direct verification of the requirement
    expect(SYNONYM_WEIGHT).toBe(0.8);
    expect(EXACT_MATCH_WEIGHT).toBe(1.0);
    expect(SYNONYM_WEIGHT).toBe(0.8 * EXACT_MATCH_WEIGHT);
  });
});
