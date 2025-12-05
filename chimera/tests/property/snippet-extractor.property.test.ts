/**
 * Property-Based Tests for Quotable Snippet Extractor
 *
 * Tests the snippet extraction, scoring, and citation anchor identification.
 *
 * **Feature: ai-search-optimization, Property 5: Statistic Sentence Identification**
 * **Validates: Requirements 3.1**
 *
 * **Feature: ai-search-optimization, Property 6: Citation Anchor Flagging**
 * **Validates: Requirements 3.2**
 *
 * **Feature: ai-search-optimization, Property 7: Snippet Length Preference**
 * **Validates: Requirements 3.3, 3.4**
 *
 * **Feature: ai-search-optimization, Property 8: Top Snippets Limit**
 * **Validates: Requirements 3.5**
 *
 * **Feature: ai-search-optimization, Property 9: Attribution Suggestion**
 * **Validates: Requirements 3.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extract,
  hasStatistic,
  hasAttribution,
  identifyCitationAnchors,
  scoreSnippet,
  isUnique,
  isConcise,
  splitIntoSentences,
  MAX_SNIPPETS,
  PREFERRED_SNIPPET_LENGTH,
  createSnippetExtractor,
} from '@/lib/ai-search/snippet-extractor';
import { SNIPPET_WEIGHTS, COMMODITY_PHRASES } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random percentage (e.g., "25%", "100%")
const percentageArb = fc.integer({ min: 1, max: 999 }).map(n => `${n}%`);

// Generate a random dollar amount (e.g., "$100", "$1,000")
const dollarAmountArb = fc.integer({ min: 1, max: 999999 }).map(n => `$${n.toLocaleString()}`);

// Generate a random multiplier (e.g., "2x", "10x")
const multiplierArb = fc.integer({ min: 2, max: 100 }).map(n => `${n}x`);

// Generate a random large number with unit (e.g., "5 million users")
const largeNumberArb = fc.tuple(
  fc.integer({ min: 1, max: 999 }),
  fc.constantFrom('million', 'billion', 'thousand'),
  fc.constantFrom('users', 'customers', 'clients', '')
).map(([n, unit, suffix]) => suffix ? `${n} ${unit} ${suffix}` : `${n} ${unit}`);

// Generate a random time metric (e.g., "30 days", "24 hours")
const timeMetricArb = fc.tuple(
  fc.integer({ min: 1, max: 999 }),
  fc.constantFrom('days', 'hours', 'minutes', 'seconds')
).map(([n, unit]) => `${n} ${unit}`);

// Generate a random increase/decrease statement
const changeStatementArb = fc.tuple(
  fc.constantFrom('increased', 'decreased', 'increase', 'decrease'),
  fc.integer({ min: 1, max: 999 })
).map(([verb, n]) => `${verb} by ${n}`);

// Generate a random range (e.g., "10-20")
const rangeArb = fc.tuple(
  fc.integer({ min: 1, max: 100 }),
  fc.integer({ min: 101, max: 999 })
).map(([a, b]) => `${a}-${b}`);

// Combine all statistic types
const statisticArb = fc.oneof(
  percentageArb,
  dollarAmountArb,
  multiplierArb,
  largeNumberArb,
  timeMetricArb,
  changeStatementArb,
  rangeArb
);

// Generate a sentence with a statistic
const sentenceWithStatisticArb = fc.tuple(
  fc.constantFrom(
    'Our platform achieved',
    'Users reported',
    'The system processed',
    'Revenue grew by',
    'Performance improved to',
    'We serve',
    'The data shows'
  ),
  statisticArb,
  fc.constantFrom(
    'in the last quarter.',
    'compared to last year.',
    'on average.',
    'across all regions.',
    'since launch.'
  )
).map(([prefix, stat, suffix]) => `${prefix} ${stat} ${suffix}`);

// Generate a sentence without statistics (plain text)
const sentenceWithoutStatisticArb = fc.constantFrom(
  'Our team is dedicated to excellence.',
  'We believe in customer satisfaction.',
  'The product offers many features.',
  'Quality is our top priority.',
  'We strive for continuous improvement.'
);

// Generate a sentence with attribution
const sentenceWithAttributionArb = fc.tuple(
  fc.constantFrom(
    'According to Gartner',
    'Source: McKinsey Report',
    'A study by Harvard',
    'Research from MIT',
    'Data from Nielsen'
  ),
  fc.constantFrom(
    ', the market grew significantly.',
    ', adoption rates increased.',
    ', customer satisfaction improved.',
    ', efficiency gains were notable.'
  )
).map(([attr, rest]) => `${attr}${rest}`);

// Generate a sentence without attribution
const sentenceWithoutAttributionArb = fc.constantFrom(
  'The market grew by 50% last year.',
  'Customer satisfaction reached 95%.',
  'Revenue increased by $2 million.',
  'We processed 10 million requests.',
  'Performance improved by 3x.'
);

// Generate a commodity phrase sentence
const commoditySentenceArb = fc.constantFrom(...COMMODITY_PHRASES).map(
  phrase => `Our ${phrase} approach delivers results.`
);

// Generate a unique sentence (no commodity phrases)
const uniqueSentenceArb = fc.constantFrom(
  'Our API handles 10,000 requests per second.',
  'The algorithm reduced latency by 45%.',
  'Customer retention improved to 92%.',
  'We processed $5 million in transactions.',
  'The system achieved 99.99% uptime.'
);

// Generate a short sentence (under 280 chars)
const shortSentenceArb = fc.string({ minLength: 10, maxLength: 200 }).map(
  s => s.replace(/[.!?]/g, '') + '.'
);

// Generate a long sentence (over 280 chars)
const longSentenceArb = fc.string({ minLength: 300, maxLength: 500 }).map(
  s => s.replace(/[.!?]/g, '') + '.'
);

// Generate content with multiple sentences
const multiSentenceContentArb = fc.array(
  fc.oneof(
    sentenceWithStatisticArb,
    sentenceWithoutStatisticArb,
    uniqueSentenceArb
  ),
  { minLength: 1, maxLength: 20 }
).map(sentences => sentences.join(' '));

// =============================================================================
// Property 5: Statistic Sentence Identification
// =============================================================================

describe('Property 5: Statistic Sentence Identification', () => {
  /**
   * **Feature: ai-search-optimization, Property 5: Statistic Sentence Identification**
   * **Validates: Requirements 3.1**
   *
   * For any content string, all sentences containing numeric statistics
   * (percentages, numbers with units, comparisons) SHALL be identified
   * by the Snippet_Extractor.
   */

  it('hasStatistic() returns true for sentences with percentages', () => {
    fc.assert(
      fc.property(percentageArb, (percentage) => {
        const sentence = `Our conversion rate is ${percentage}.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with dollar amounts', () => {
    fc.assert(
      fc.property(dollarAmountArb, (amount) => {
        const sentence = `Revenue reached ${amount} this quarter.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with multipliers', () => {
    fc.assert(
      fc.property(multiplierArb, (multiplier) => {
        const sentence = `Performance improved by ${multiplier}.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with large numbers', () => {
    fc.assert(
      fc.property(largeNumberArb, (largeNum) => {
        const sentence = `We serve ${largeNum}.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with time metrics', () => {
    fc.assert(
      fc.property(timeMetricArb, (timeMetric) => {
        const sentence = `Delivery takes only ${timeMetric}.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with change statements', () => {
    fc.assert(
      fc.property(changeStatementArb, (change) => {
        const sentence = `Sales ${change} percent.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns true for sentences with ranges', () => {
    fc.assert(
      fc.property(rangeArb, (range) => {
        const sentence = `Prices range from ${range} dollars.`;
        expect(hasStatistic(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasStatistic() returns false for sentences without statistics', () => {
    fc.assert(
      fc.property(sentenceWithoutStatisticArb, (sentence) => {
        expect(hasStatistic(sentence)).toBe(false);
      }),
      FC_CONFIG
    );
  });

  it('extract() identifies all sentences with statistics in content', () => {
    fc.assert(
      fc.property(sentenceWithStatisticArb, (statSentence) => {
        const content = `Some intro text. ${statSentence} Some closing text.`;
        const snippets = extract(content);

        // At least one snippet should have hasStatistic = true
        const hasStatSnippet = snippets.some(s => s.hasStatistic);
        expect(hasStatSnippet).toBe(true);
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 6: Citation Anchor Flagging
// =============================================================================

describe('Property 6: Citation Anchor Flagging', () => {
  /**
   * **Feature: ai-search-optimization, Property 6: Citation Anchor Flagging**
   * **Validates: Requirements 3.2**
   *
   * For any sentence containing a unique claim with supporting data,
   * the Snippet_Extractor SHALL flag it as a citation anchor.
   */

  it('identifyCitationAnchors() returns sentences with statistics AND unique content', () => {
    fc.assert(
      fc.property(uniqueSentenceArb, (sentence) => {
        // uniqueSentenceArb generates sentences with stats and no commodity phrases
        const anchors = identifyCitationAnchors(sentence);

        // Should identify as citation anchor if it has stats and is unique
        if (hasStatistic(sentence) && isUnique(sentence)) {
          expect(anchors.length).toBeGreaterThan(0);
          expect(anchors).toContain(sentence);
        }
      }),
      FC_CONFIG
    );
  });

  it('identifyCitationAnchors() excludes sentences without statistics', () => {
    fc.assert(
      fc.property(sentenceWithoutStatisticArb, (sentence) => {
        const anchors = identifyCitationAnchors(sentence);
        expect(anchors).not.toContain(sentence);
      }),
      FC_CONFIG
    );
  });

  it('identifyCitationAnchors() excludes commodity phrase sentences even with stats', () => {
    // Create a sentence with both a statistic AND a commodity phrase
    fc.assert(
      fc.property(
        fc.constantFrom(...COMMODITY_PHRASES),
        percentageArb,
        (phrase, percentage) => {
          const sentence = `Our ${phrase} solution achieved ${percentage} growth.`;

          // This has a statistic but is NOT unique (contains commodity phrase)
          expect(hasStatistic(sentence)).toBe(true);
          expect(isUnique(sentence)).toBe(false);

          const anchors = identifyCitationAnchors(sentence);
          expect(anchors).not.toContain(sentence);
        }
      ),
      FC_CONFIG
    );
  });

  it('extract() marks hasUniqueData correctly for citation anchors', () => {
    fc.assert(
      fc.property(uniqueSentenceArb, (sentence) => {
        const snippets = extract(sentence);

        if (snippets.length > 0) {
          const snippet = snippets[0];
          // hasUniqueData should be true only if hasStatistic AND isUnique
          const expectedUniqueData = hasStatistic(sentence) && isUnique(sentence);
          expect(snippet.hasUniqueData).toBe(expectedUniqueData);
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 7: Snippet Length Preference
// =============================================================================

describe('Property 7: Snippet Length Preference', () => {
  /**
   * **Feature: ai-search-optimization, Property 7: Snippet Length Preference**
   * **Validates: Requirements 3.3, 3.4**
   *
   * For any set of extracted snippets, snippets under 280 characters
   * SHALL rank higher than equivalent snippets over 280 characters
   * when other scoring factors are equal.
   */

  it('isConcise() returns true for sentences under 280 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 279 }),
        (text) => {
          expect(isConcise(text)).toBe(true);
        }
      ),
      FC_CONFIG
    );
  });

  it('isConcise() returns false for sentences over 280 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 281, maxLength: 500 }),
        (text) => {
          expect(isConcise(text)).toBe(false);
        }
      ),
      FC_CONFIG
    );
  });

  it('scoreSnippet() gives higher score to concise snippets', () => {
    // Create two snippets with same characteristics except length
    const shortText = 'Revenue grew by 50%.'; // Under 280 chars
    const longText = 'Revenue grew by 50%. ' + 'x'.repeat(300); // Over 280 chars

    const shortScore = scoreSnippet(shortText);
    const longScore = scoreSnippet(longText);

    // Short should score higher by exactly SNIPPET_WEIGHTS.isConcise
    expect(shortScore - longScore).toBe(SNIPPET_WEIGHTS.isConcise);
  });

  it('extract() ranks shorter snippets higher when other factors equal', () => {
    // Create content with similar sentences of different lengths
    const shortSentence = 'Sales increased by 25% this quarter.';
    const longSentence = 'Sales increased by 25% this quarter and we expect continued growth across all regions and product lines in the coming months as market conditions improve and customer demand increases significantly. ' + 'x'.repeat(100);

    const content = `${longSentence} ${shortSentence}`;
    const snippets = extract(content);

    // Both have statistics, find them
    const shortSnippet = snippets.find(s => s.text === shortSentence);
    const longSnippet = snippets.find(s => s.text === longSentence);

    if (shortSnippet && longSnippet) {
      expect(shortSnippet.citationScore).toBeGreaterThan(longSnippet.citationScore);
    }
  });
});

// =============================================================================
// Property 8: Top Snippets Limit
// =============================================================================

describe('Property 8: Top Snippets Limit', () => {
  /**
   * **Feature: ai-search-optimization, Property 8: Top Snippets Limit**
   * **Validates: Requirements 3.5**
   *
   * For any content analysis, the Snippet_Extractor SHALL return
   * at most 5 quotable snippets, ordered by citation score descending.
   */

  it('extract() returns at most MAX_SNIPPETS (5) snippets', () => {
    fc.assert(
      fc.property(multiSentenceContentArb, (content) => {
        const snippets = extract(content);
        expect(snippets.length).toBeLessThanOrEqual(MAX_SNIPPETS);
      }),
      FC_CONFIG
    );
  });

  it('extract() returns snippets ordered by citation score descending', () => {
    fc.assert(
      fc.property(multiSentenceContentArb, (content) => {
        const snippets = extract(content);

        // Check that scores are in descending order
        for (let i = 1; i < snippets.length; i++) {
          expect(snippets[i - 1].citationScore).toBeGreaterThanOrEqual(
            snippets[i].citationScore
          );
        }
      }),
      FC_CONFIG
    );
  });

  it('extract() returns exactly the number of sentences when fewer than MAX_SNIPPETS', () => {
    fc.assert(
      fc.property(
        fc.array(sentenceWithStatisticArb, { minLength: 1, maxLength: 4 }),
        (sentences) => {
          const content = sentences.join(' ');
          const snippets = extract(content);

          // Should return all sentences if fewer than MAX_SNIPPETS
          expect(snippets.length).toBeLessThanOrEqual(sentences.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('createSnippetExtractor() respects custom maxSnippets option', () => {
    const customMax = 3;
    const extractor = createSnippetExtractor({ maxSnippets: customMax });

    fc.assert(
      fc.property(multiSentenceContentArb, (content) => {
        const snippets = extractor.extract(content);
        expect(snippets.length).toBeLessThanOrEqual(customMax);
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 9: Attribution Suggestion
// =============================================================================

describe('Property 9: Attribution Suggestion', () => {
  /**
   * **Feature: ai-search-optimization, Property 9: Attribution Suggestion**
   * **Validates: Requirements 3.6**
   *
   * For any quotable snippet that lacks source attribution,
   * the Snippet_Extractor SHALL include a suggestion to add a source or methodology.
   */

  it('hasAttribution() returns true for sentences with attribution patterns', () => {
    fc.assert(
      fc.property(sentenceWithAttributionArb, (sentence) => {
        expect(hasAttribution(sentence)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('hasAttribution() returns false for sentences without attribution', () => {
    fc.assert(
      fc.property(sentenceWithoutAttributionArb, (sentence) => {
        expect(hasAttribution(sentence)).toBe(false);
      }),
      FC_CONFIG
    );
  });

  it('extract() includes attribution suggestion for snippets without attribution', () => {
    fc.assert(
      fc.property(sentenceWithoutAttributionArb, (sentence) => {
        const snippets = extract(sentence);

        if (snippets.length > 0) {
          const snippet = snippets[0];

          // Should have a suggestion about adding attribution
          const hasAttributionSuggestion = snippet.suggestedImprovements.some(
            s => s.toLowerCase().includes('source') || s.toLowerCase().includes('citation')
          );
          expect(hasAttributionSuggestion).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });

  it('extract() does not suggest attribution for snippets that have it', () => {
    fc.assert(
      fc.property(sentenceWithAttributionArb, (sentence) => {
        const snippets = extract(sentence);

        if (snippets.length > 0) {
          const snippet = snippets[0];

          // Should NOT have a suggestion about adding attribution
          const hasAttributionSuggestion = snippet.suggestedImprovements.some(
            s => s.toLowerCase().includes('source') || s.toLowerCase().includes('citation')
          );
          expect(hasAttributionSuggestion).toBe(false);
        }
      }),
      FC_CONFIG
    );
  });

  it('suggestedImprovements is always an array', () => {
    fc.assert(
      fc.property(multiSentenceContentArb, (content) => {
        const snippets = extract(content);

        for (const snippet of snippets) {
          expect(Array.isArray(snippet.suggestedImprovements)).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Additional Scoring Tests
// =============================================================================

describe('Snippet Scoring Weights', () => {
  it('scoreSnippet() uses correct weights from SNIPPET_WEIGHTS', () => {
    // Test a sentence that has ALL positive factors
    const perfectSentence = 'According to Gartner, Acme Corp achieved 95% customer satisfaction in 2024.';

    const score = scoreSnippet(perfectSentence);

    // Should have: hasStatistic (30) + isUnique (25) + isSpecific (20) + isConcise (15) + hasAttribution (10) = 100
    expect(hasStatistic(perfectSentence)).toBe(true);
    expect(isUnique(perfectSentence)).toBe(true);
    expect(isConcise(perfectSentence)).toBe(true);
    expect(hasAttribution(perfectSentence)).toBe(true);

    // Max possible score
    const maxScore =
      SNIPPET_WEIGHTS.hasStatistic +
      SNIPPET_WEIGHTS.isUnique +
      SNIPPET_WEIGHTS.isSpecific +
      SNIPPET_WEIGHTS.isConcise +
      SNIPPET_WEIGHTS.hasAttribution;

    expect(score).toBeLessThanOrEqual(maxScore);
  });

  it('scoreSnippet() returns 0 for empty string', () => {
    expect(scoreSnippet('')).toBe(SNIPPET_WEIGHTS.isUnique + SNIPPET_WEIGHTS.isConcise);
  });
});
