/**
 * Property-Based Tests for Deduplication Detector
 *
 * Tests commodity phrase detection, low differentiation flagging, and citation anchor highlighting.
 *
 * **Feature: ai-search-optimization, Property 18: Commodity Phrase Detection**
 * **Validates: Requirements 7.1**
 *
 * **Feature: ai-search-optimization, Property 19: Low Differentiation Threshold**
 * **Validates: Requirements 7.2**
 *
 * **Feature: ai-search-optimization, Property 20: Unique Content Highlighting**
 * **Validates: Requirements 7.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  analyze,
  identifyCommodityPhrases,
  findCitationAnchors,
  calculateCommodityPercentage,
  LOW_DIFFERENTIATION_THRESHOLD,
} from '@/lib/ai-search/dedup-detector';
import { COMMODITY_PHRASES } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random commodity phrase
const commodityPhraseArb = fc.constantFrom(...COMMODITY_PHRASES);

// Generate content with commodity phrases
const contentWithCommodityArb = fc.tuple(
  commodityPhraseArb,
  fc.constantFrom(
    'Our approach delivers results.',
    'solution helps businesses grow.',
    'platform enables success.',
    'service provides value.'
  )
).map(([phrase, suffix]) => `Our ${phrase} ${suffix}`);

// Generate content without commodity phrases
const contentWithoutCommodityArb = fc.constantFrom(
  'Our API handles 10,000 requests per second with 99.99% uptime.',
  'Customer retention improved to 92% after implementing our solution.',
  'The algorithm reduced processing time from 5 seconds to 200 milliseconds.',
  'Revenue increased by $2.5 million in Q3 2024.',
  'We serve 5 million active users across 120 countries.'
);

// Generate content with statistics (citation anchors)
const contentWithStatsArb = fc.constantFrom(
  'Our platform achieved 95% customer satisfaction.',
  'Revenue grew by $2 million last quarter.',
  'Users reported 3x faster performance.',
  'The system processed 10 million requests.',
  'Customer retention reached 92%.'
);

// Generate content without statistics
const contentWithoutStatsArb = fc.constantFrom(
  'Our team is dedicated to excellence.',
  'We believe in customer satisfaction.',
  'Quality is our top priority.',
  'We strive for continuous improvement.',
  'Innovation drives our success.'
);

// Generate high commodity content (>30% commodity phrases)
const highCommodityContentArb = fc.array(commodityPhraseArb, { minLength: 3, maxLength: 6 }).map(
  phrases => phrases.map(p => `Our ${p} approach.`).join(' ')
);

// Generate low commodity content (<30% commodity phrases)
const lowCommodityContentArb = fc.tuple(
  contentWithStatsArb,
  contentWithStatsArb,
  contentWithStatsArb,
  fc.constantFrom('', `Our ${COMMODITY_PHRASES[0]} solution.`)
).map(parts => parts.filter(p => p).join(' '));

// =============================================================================
// Property 18: Commodity Phrase Detection
// =============================================================================

describe('Property 18: Commodity Phrase Detection', () => {
  /**
   * **Feature: ai-search-optimization, Property 18: Commodity Phrase Detection**
   * **Validates: Requirements 7.1**
   *
   * For any content containing known commodity phrases, the Dedup_Detector
   * SHALL identify and list those phrases.
   */

  it('identifyCommodityPhrases() detects known commodity phrases', () => {
    fc.assert(
      fc.property(commodityPhraseArb, (phrase) => {
        const content = `Our ${phrase} solution delivers results.`;
        const found = identifyCommodityPhrases(content);
        
        expect(found).toContain(phrase);
      }),
      FC_CONFIG
    );
  });

  it('identifyCommodityPhrases() returns empty array for content without commodity phrases', () => {
    fc.assert(
      fc.property(contentWithoutCommodityArb, (content) => {
        const found = identifyCommodityPhrases(content);
        expect(found.length).toBe(0);
      }),
      FC_CONFIG
    );
  });

  it('identifyCommodityPhrases() detects multiple commodity phrases', () => {
    fc.assert(
      fc.property(
        fc.array(commodityPhraseArb, { minLength: 2, maxLength: 5 }),
        (phrases) => {
          // Create content with unique phrases
          const uniquePhrases = Array.from(new Set(phrases));
          const content = uniquePhrases.map(p => `Our ${p} approach.`).join(' ');
          const found = identifyCommodityPhrases(content);
          
          // Should find all unique phrases
          for (const phrase of uniquePhrases) {
            expect(found).toContain(phrase);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('identifyCommodityPhrases() is case-insensitive', () => {
    fc.assert(
      fc.property(commodityPhraseArb, (phrase) => {
        const upperContent = `Our ${phrase.toUpperCase()} solution.`;
        const lowerContent = `Our ${phrase.toLowerCase()} solution.`;
        const mixedContent = `Our ${phrase} solution.`;
        
        const upperFound = identifyCommodityPhrases(upperContent);
        const lowerFound = identifyCommodityPhrases(lowerContent);
        const mixedFound = identifyCommodityPhrases(mixedContent);
        
        expect(upperFound.length).toBe(lowerFound.length);
        expect(lowerFound.length).toBe(mixedFound.length);
      }),
      FC_CONFIG
    );
  });

  it('analyze() includes commodity phrases in result', () => {
    fc.assert(
      fc.property(contentWithCommodityArb, (content) => {
        const result = analyze(content);
        
        expect(Array.isArray(result.commodityPhrases)).toBe(true);
        expect(result.commodityPhrases.length).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 19: Low Differentiation Threshold
// =============================================================================

describe('Property 19: Low Differentiation Threshold', () => {
  /**
   * **Feature: ai-search-optimization, Property 19: Low Differentiation Threshold**
   * **Validates: Requirements 7.2**
   *
   * For any content where commodity phrases exceed 30% of total content,
   * the Dedup_Detector SHALL flag it as low differentiation.
   */

  it('LOW_DIFFERENTIATION_THRESHOLD is 0.3 (30%)', () => {
    expect(LOW_DIFFERENTIATION_THRESHOLD).toBe(0.3);
  });

  it('analyze() flags content as low differentiation when commodity phrases exceed 30%', () => {
    fc.assert(
      fc.property(highCommodityContentArb, (content) => {
        const result = analyze(content);
        
        if (result.commodityPhrasePercentage > LOW_DIFFERENTIATION_THRESHOLD) {
          expect(result.isLowDifferentiation).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });

  it('analyze() does not flag content when commodity phrases are below 30%', () => {
    fc.assert(
      fc.property(lowCommodityContentArb, (content) => {
        const result = analyze(content);
        
        if (result.commodityPhrasePercentage <= LOW_DIFFERENTIATION_THRESHOLD) {
          expect(result.isLowDifferentiation).toBe(false);
        }
      }),
      FC_CONFIG
    );
  });

  it('calculateCommodityPercentage() returns value between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.oneof(contentWithCommodityArb, contentWithoutCommodityArb, highCommodityContentArb),
        (content) => {
          const phrases = identifyCommodityPhrases(content);
          const percentage = calculateCommodityPercentage(content, phrases);
          
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('calculateCommodityPercentage() returns 0 for empty content', () => {
    const percentage = calculateCommodityPercentage('', []);
    expect(percentage).toBe(0);
  });

  it('analyze() provides suggestions for low differentiation content', () => {
    fc.assert(
      fc.property(highCommodityContentArb, (content) => {
        const result = analyze(content);
        
        if (result.isLowDifferentiation) {
          expect(result.suggestions.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 20: Unique Content Highlighting
// =============================================================================

describe('Property 20: Unique Content Highlighting', () => {
  /**
   * **Feature: ai-search-optimization, Property 20: Unique Content Highlighting**
   * **Validates: Requirements 7.4**
   *
   * For any content containing unique statistics or claims not found in the
   * commodity phrase list, the Dedup_Detector SHALL highlight them as citation anchors.
   */

  it('findCitationAnchors() identifies sentences with statistics', () => {
    fc.assert(
      fc.property(contentWithStatsArb, (content) => {
        const anchors = findCitationAnchors(content);
        
        // Content with stats should have citation anchors
        expect(anchors.length).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });

  it('findCitationAnchors() excludes sentences without statistics', () => {
    fc.assert(
      fc.property(contentWithoutStatsArb, (content) => {
        const anchors = findCitationAnchors(content);
        
        // Content without stats should have no citation anchors
        expect(anchors.length).toBe(0);
      }),
      FC_CONFIG
    );
  });

  it('findCitationAnchors() excludes commodity content even with statistics', () => {
    fc.assert(
      fc.property(commodityPhraseArb, (phrase) => {
        // Create content with both a commodity phrase AND a statistic
        const content = `Our ${phrase} solution achieved 50% growth.`;
        const anchors = findCitationAnchors(content);
        
        // Should NOT be a citation anchor because it contains commodity phrase
        expect(anchors.length).toBe(0);
      }),
      FC_CONFIG
    );
  });

  it('analyze() includes citation anchors in result', () => {
    fc.assert(
      fc.property(contentWithStatsArb, (content) => {
        const result = analyze(content);
        
        expect(Array.isArray(result.citationAnchors)).toBe(true);
        expect(result.citationAnchors.length).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });

  it('findCitationAnchors() returns empty array for empty content', () => {
    const anchors = findCitationAnchors('');
    expect(anchors).toEqual([]);
  });

  it('citation anchors are unique sentences with data', () => {
    fc.assert(
      fc.property(contentWithoutCommodityArb, (content) => {
        const anchors = findCitationAnchors(content);
        
        // Each anchor should be a non-empty string
        for (const anchor of anchors) {
          expect(typeof anchor).toBe('string');
          expect(anchor.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Additional Tests
// =============================================================================

describe('Dedup Detector Result Structure', () => {
  it('analyze() returns complete DedupResult structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(contentWithCommodityArb, contentWithoutCommodityArb, highCommodityContentArb),
        (content) => {
          const result = analyze(content);
          
          expect(typeof result.commodityPhrasePercentage).toBe('number');
          expect(typeof result.isLowDifferentiation).toBe('boolean');
          expect(Array.isArray(result.commodityPhrases)).toBe(true);
          expect(Array.isArray(result.citationAnchors)).toBe(true);
          expect(Array.isArray(result.suggestions)).toBe(true);
        }
      ),
      FC_CONFIG
    );
  });

  it('analyze() returns 0 percentage for empty content', () => {
    const result = analyze('');
    expect(result.commodityPhrasePercentage).toBe(0);
    expect(result.isLowDifferentiation).toBe(false);
  });
});
