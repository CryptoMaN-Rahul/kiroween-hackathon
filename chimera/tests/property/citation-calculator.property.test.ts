/**
 * Property-Based Tests for Citation Score Calculator
 *
 * Tests citation score calculation, weighting, recommendations, and page ranking.
 *
 * **Feature: ai-search-optimization, Property 14: Citation Score Range**
 * **Validates: Requirements 6.1**
 *
 * **Feature: ai-search-optimization, Property 15: Citation Score Weighting**
 * **Validates: Requirements 6.2**
 *
 * **Feature: ai-search-optimization, Property 16: Low Score Recommendations**
 * **Validates: Requirements 6.3**
 *
 * **Feature: ai-search-optimization, Property 17: Page Ranking Consistency**
 * **Validates: Requirements 6.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculate,
  rankPages,
  getRecommendations,
  SCORE_WEIGHTS,
  LOW_SCORE_THRESHOLD,
} from '@/lib/ai-search/citation-calculator';
import { PageContent } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random URL
const urlArb = fc.webUrl();

// Generate a random title
const titleArb = fc.string({ minLength: 5, maxLength: 100 });

// Generate a random description
const descriptionArb = fc.string({ minLength: 10, maxLength: 200 });

// Generate content with statistics
const contentWithStatsArb = fc.constantFrom(
  'Our platform achieved 95% customer satisfaction. Revenue grew by $2 million last quarter.',
  'Users reported 3x faster performance. The system processed 10 million requests.',
  'According to Gartner, market share increased by 25%. We serve 5 million customers.',
  'Sales increased by 40% year over year. Customer retention reached 92%.',
  'The API handles 50,000 requests per second. Latency decreased by 60%.'
);

// Generate content without statistics
const contentWithoutStatsArb = fc.constantFrom(
  'Our team is dedicated to excellence. We believe in customer satisfaction.',
  'The product offers many features. Quality is our top priority.',
  'We strive for continuous improvement. Innovation drives our success.',
  'Customer focus is at our core. We deliver value every day.',
  'Our mission is to help businesses grow. We are committed to quality.'
);

// Generate content with Q&A patterns (for schema coverage)
const contentWithQAArb = fc.constantFrom(
  'Q: How does the product work?\nA: The product uses advanced algorithms to process data efficiently.',
  'Q: What is the pricing?\nA: Our pricing starts at $99 per month for basic features.',
  'Question: How do I get started?\nAnswer: Sign up on our website and follow the setup wizard.'
);

// Generate content with steps (for schema coverage)
const contentWithStepsArb = fc.constantFrom(
  '1. Open the application\n2. Click settings\n3. Configure your preferences\n4. Save changes',
  'Step 1: Create an account\nStep 2: Verify your email\nStep 3: Complete your profile',
  '1. Download the installer\n2. Run the setup\n3. Follow the prompts\n4. Launch the app'
);

// Generate content with attribution
const contentWithAttributionArb = fc.constantFrom(
  'According to McKinsey, digital transformation increased by 50%. Source: 2024 Report.',
  'A study by Harvard found that productivity improved by 30%. Research from MIT confirms this.',
  'Data from Nielsen shows market growth of 25%. Per industry reports, adoption is rising.'
);

// Generate a random PageContent
const pageContentArb = fc.record({
  url: urlArb,
  title: titleArb,
  description: descriptionArb,
  content: fc.oneof(
    contentWithStatsArb,
    contentWithoutStatsArb,
    contentWithQAArb,
    contentWithStepsArb,
    contentWithAttributionArb
  ),
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate PageContent with high citation potential
const highCitationPageArb = fc.record({
  url: urlArb,
  title: titleArb,
  description: descriptionArb,
  content: fc.constant(
    'According to Gartner, our platform achieved 95% customer satisfaction in 2024. ' +
    'Revenue grew by $2 million last quarter. Source: Annual Report. ' +
    'Q: How does it work?\nA: The system uses AI to optimize performance. ' +
    '1. Sign up\n2. Configure\n3. Launch'
  ),
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate PageContent with low citation potential
const lowCitationPageArb = fc.record({
  url: urlArb,
  title: titleArb,
  description: descriptionArb,
  content: fc.constant(
    'Our team is dedicated to excellence. We believe in customer satisfaction. ' +
    'Quality is our top priority. We strive for continuous improvement.'
  ),
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate array of pages
const pagesArb = fc.array(pageContentArb, { minLength: 1, maxLength: 10 });

// =============================================================================
// Property 14: Citation Score Range
// =============================================================================

describe('Property 14: Citation Score Range', () => {
  /**
   * **Feature: ai-search-optimization, Property 14: Citation Score Range**
   * **Validates: Requirements 6.1**
   *
   * For any page content, the Citation_Calculator SHALL compute a total score
   * between 0 and 100 inclusive.
   */

  it('calculate() returns total score between 0 and 100', () => {
    fc.assert(
      fc.property(pageContentArb, (page) => {
        const score = calculate(page);
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      }),
      FC_CONFIG
    );
  });

  it('calculate() returns breakdown scores within their weight limits', () => {
    fc.assert(
      fc.property(pageContentArb, (page) => {
        const score = calculate(page);
        
        expect(score.breakdown.uniqueData).toBeGreaterThanOrEqual(0);
        expect(score.breakdown.uniqueData).toBeLessThanOrEqual(SCORE_WEIGHTS.uniqueData);
        
        expect(score.breakdown.sourceAttribution).toBeGreaterThanOrEqual(0);
        expect(score.breakdown.sourceAttribution).toBeLessThanOrEqual(SCORE_WEIGHTS.sourceAttribution);
        
        expect(score.breakdown.quotableSnippets).toBeGreaterThanOrEqual(0);
        expect(score.breakdown.quotableSnippets).toBeLessThanOrEqual(SCORE_WEIGHTS.quotableSnippets);
        
        expect(score.breakdown.schemaCoverage).toBeGreaterThanOrEqual(0);
        expect(score.breakdown.schemaCoverage).toBeLessThanOrEqual(SCORE_WEIGHTS.schemaCoverage);
      }),
      FC_CONFIG
    );
  });

  it('calculate() total equals sum of breakdown components', () => {
    fc.assert(
      fc.property(pageContentArb, (page) => {
        const score = calculate(page);
        const expectedTotal = 
          score.breakdown.uniqueData +
          score.breakdown.sourceAttribution +
          score.breakdown.quotableSnippets +
          score.breakdown.schemaCoverage;
        
        expect(score.total).toBe(expectedTotal);
      }),
      FC_CONFIG
    );
  });

  it('calculate() returns 0 for empty content', () => {
    const emptyPage: PageContent = {
      url: 'https://example.com',
      title: 'Test',
      description: 'Test',
      content: '',
      headings: [],
      statistics: [],
      lastModified: new Date(),
    };
    
    const score = calculate(emptyPage);
    expect(score.total).toBe(0);
  });
});

// =============================================================================
// Property 15: Citation Score Weighting
// =============================================================================

describe('Property 15: Citation Score Weighting', () => {
  /**
   * **Feature: ai-search-optimization, Property 15: Citation Score Weighting**
   * **Validates: Requirements 6.2**
   *
   * For any page content, the Citation_Calculator SHALL compute the score using
   * exactly: unique data (40%), source attribution (20%), quotable snippets (20%),
   * schema coverage (20%).
   */

  it('SCORE_WEIGHTS sum to 100', () => {
    const totalWeight = 
      SCORE_WEIGHTS.uniqueData +
      SCORE_WEIGHTS.sourceAttribution +
      SCORE_WEIGHTS.quotableSnippets +
      SCORE_WEIGHTS.schemaCoverage;
    
    expect(totalWeight).toBe(100);
  });

  it('SCORE_WEIGHTS has correct individual values', () => {
    expect(SCORE_WEIGHTS.uniqueData).toBe(40);
    expect(SCORE_WEIGHTS.sourceAttribution).toBe(20);
    expect(SCORE_WEIGHTS.quotableSnippets).toBe(20);
    expect(SCORE_WEIGHTS.schemaCoverage).toBe(20);
  });

  it('calculate() respects weight distribution', () => {
    fc.assert(
      fc.property(pageContentArb, (page) => {
        const score = calculate(page);
        
        // Each component should not exceed its weight
        expect(score.breakdown.uniqueData).toBeLessThanOrEqual(40);
        expect(score.breakdown.sourceAttribution).toBeLessThanOrEqual(20);
        expect(score.breakdown.quotableSnippets).toBeLessThanOrEqual(20);
        expect(score.breakdown.schemaCoverage).toBeLessThanOrEqual(20);
      }),
      FC_CONFIG
    );
  });

  it('content with statistics scores higher on uniqueData', () => {
    fc.assert(
      fc.property(contentWithStatsArb, contentWithoutStatsArb, (withStats, withoutStats) => {
        const pageWithStats: PageContent = {
          url: 'https://example.com/stats',
          title: 'With Stats',
          description: 'Page with statistics',
          content: withStats,
          headings: [],
          statistics: [],
          lastModified: new Date(),
        };
        
        const pageWithoutStats: PageContent = {
          url: 'https://example.com/no-stats',
          title: 'Without Stats',
          description: 'Page without statistics',
          content: withoutStats,
          headings: [],
          statistics: [],
          lastModified: new Date(),
        };
        
        const scoreWithStats = calculate(pageWithStats);
        const scoreWithoutStats = calculate(pageWithoutStats);
        
        expect(scoreWithStats.breakdown.uniqueData).toBeGreaterThanOrEqual(
          scoreWithoutStats.breakdown.uniqueData
        );
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 16: Low Score Recommendations
// =============================================================================

describe('Property 16: Low Score Recommendations', () => {
  /**
   * **Feature: ai-search-optimization, Property 16: Low Score Recommendations**
   * **Validates: Requirements 6.3**
   *
   * For any page with a citation score below 50, the Citation_Calculator SHALL
   * provide at least one specific recommendation for improvement.
   */

  it('getRecommendations() provides recommendations for scores below 50', () => {
    fc.assert(
      fc.property(lowCitationPageArb, (page) => {
        const score = calculate(page);
        
        if (score.total < LOW_SCORE_THRESHOLD) {
          expect(score.recommendations.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('getRecommendations() returns empty array for scores >= 50', () => {
    fc.assert(
      fc.property(highCitationPageArb, (page) => {
        const score = calculate(page);
        
        if (score.total >= LOW_SCORE_THRESHOLD) {
          expect(score.recommendations.length).toBe(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('recommendations are specific and actionable strings', () => {
    fc.assert(
      fc.property(pageContentArb, (page) => {
        const score = calculate(page);
        
        for (const rec of score.recommendations) {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(10); // Should be meaningful
        }
      }),
      FC_CONFIG
    );
  });

  it('LOW_SCORE_THRESHOLD is 50', () => {
    expect(LOW_SCORE_THRESHOLD).toBe(50);
  });
});

// =============================================================================
// Property 17: Page Ranking Consistency
// =============================================================================

describe('Property 17: Page Ranking Consistency', () => {
  /**
   * **Feature: ai-search-optimization, Property 17: Page Ranking Consistency**
   * **Validates: Requirements 6.5**
   *
   * For any set of pages, the Citation_Calculator SHALL rank them in descending
   * order by citation score.
   */

  it('rankPages() returns pages in descending order by citation score', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const ranked = rankPages(pages);
        
        // Check descending order
        for (let i = 1; i < ranked.length; i++) {
          expect(ranked[i - 1].citationScore).toBeGreaterThanOrEqual(ranked[i].citationScore);
        }
      }),
      FC_CONFIG
    );
  });

  it('rankPages() returns same number of pages as input', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const ranked = rankPages(pages);
        expect(ranked.length).toBe(pages.length);
      }),
      FC_CONFIG
    );
  });

  it('rankPages() includes all input URLs', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const ranked = rankPages(pages);
        const inputUrls = new Set(pages.map(p => p.url));
        const outputUrls = new Set(ranked.map(r => r.url));
        
        expect(outputUrls.size).toBe(inputUrls.size);
      }),
      FC_CONFIG
    );
  });

  it('rankPages() includes citationScore and topSnippet for each page', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const ranked = rankPages(pages);
        
        for (const page of ranked) {
          expect(typeof page.url).toBe('string');
          expect(typeof page.citationScore).toBe('number');
          expect(typeof page.topSnippet).toBe('string');
          expect(page.citationScore).toBeGreaterThanOrEqual(0);
          expect(page.citationScore).toBeLessThanOrEqual(100);
        }
      }),
      FC_CONFIG
    );
  });

  it('rankPages() returns empty array for empty input', () => {
    const ranked = rankPages([]);
    expect(ranked).toEqual([]);
  });

  it('high citation pages rank higher than low citation pages', () => {
    fc.assert(
      fc.property(highCitationPageArb, lowCitationPageArb, (highPage, lowPage) => {
        const ranked = rankPages([lowPage, highPage]);
        
        // High citation page should be first (or tied)
        const highRank = ranked.findIndex(r => r.url === highPage.url);
        const lowRank = ranked.findIndex(r => r.url === lowPage.url);
        
        expect(highRank).toBeLessThanOrEqual(lowRank);
      }),
      FC_CONFIG
    );
  });
});
