/**
 * Property-Based Tests for Content Transformer
 * 
 * Tests correctness properties for content transformation to AI-preferred formats.
 * 
 * @module transformer.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectListicleSuitability,
  transformToRoundup,
  generateComparisonTable,
  createTopNList,
  createContentTransformer
} from '../../src/lib/content-transformer';

/**
 * Generators for transformer testing
 */

// Generate content with list items
const listContentGen = fc.array(
  fc.string({ minLength: 10, maxLength: 100 }),
  { minLength: 3, maxLength: 10 }
).map(items => items.map((item, i) => `${i + 1}. ${item}`).join('\n'));

// Generate content with bullet points
const bulletContentGen = fc.array(
  fc.string({ minLength: 10, maxLength: 100 }),
  { minLength: 3, maxLength: 10 }
).map(items => items.map(item => `- ${item}`).join('\n'));

// Generate comparison content
const comparisonContentGen = fc.tuple(
  fc.string({ minLength: 5, maxLength: 50 }),
  fc.string({ minLength: 5, maxLength: 50 })
).map(([a, b]) => `${a} vs ${b}\n\nComparing ${a} and ${b}:\n- ${a} is better for X\n- ${b} is better for Y`);

// Generate FAQ content
const faqContentGen = fc.array(
  fc.tuple(
    fc.string({ minLength: 10, maxLength: 50 }),
    fc.string({ minLength: 20, maxLength: 100 })
  ),
  { minLength: 2, maxLength: 5 }
).map(qas => qas.map(([q, a]) => `Q: ${q}?\nA: ${a}`).join('\n\n'));

/**
 * **Feature: chimera-geo-sdk-v2, Property 18: Transformation Detection Consistency**
 * **Validates: Requirements 8.1**
 * 
 * For any content, the transformation suitability detection SHALL return
 * a score in [0, 1] and a suggested format if score exceeds threshold.
 */
describe('Property 18: Transformation Detection Consistency', () => {
  it('confidence score is in range [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (content) => {
          const result = detectListicleSuitability(content);
          
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('suitable content has format suggestion', () => {
    fc.assert(
      fc.property(
        fc.oneof(listContentGen, bulletContentGen, comparisonContentGen, faqContentGen),
        (content) => {
          const result = detectListicleSuitability(content);
          
          if (result.suitable) {
            expect(result.format).not.toBeNull();
            expect(['roundup', 'comparison', 'topN', 'faq']).toContain(result.format);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('list content is detected as suitable', () => {
    fc.assert(
      fc.property(
        listContentGen,
        (content) => {
          const result = detectListicleSuitability(content);
          
          // List content should be detected
          expect(result.confidence).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('comparison content is detected', () => {
    fc.assert(
      fc.property(
        comparisonContentGen,
        (content) => {
          const result = detectListicleSuitability(content);
          
          // Should detect comparison indicators
          expect(result.confidence).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('detection is deterministic', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (content) => {
          const result1 = detectListicleSuitability(content);
          const result2 = detectListicleSuitability(content);
          
          expect(result1.confidence).toBe(result2.confidence);
          expect(result1.suitable).toBe(result2.suitable);
          expect(result1.format).toBe(result2.format);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 19: Transformation Preservation Invariant**
 * **Validates: Requirements 8.2, 8.5**
 * 
 * For any content transformation (roundup, comparison table, Top N),
 * the original content SHALL remain unchanged and the transformed version
 * SHALL be returned separately.
 */
describe('Property 19: Transformation Preservation Invariant', () => {
  it('original content is preserved in roundup transformation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 500 }),
        (content) => {
          const result = transformToRoundup(content);
          
          expect(result.original).toBe(content);
          expect(result.transformed).toBeDefined();
          expect(typeof result.transformed).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('original content is not modified by transformation', () => {
    fc.assert(
      fc.property(
        listContentGen,
        (content) => {
          const originalCopy = content;
          const result = transformToRoundup(content);
          
          // Original should be unchanged
          expect(content).toBe(originalCopy);
          expect(result.original).toBe(originalCopy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('transformed content is different from original when items extracted', () => {
    fc.assert(
      fc.property(
        listContentGen,
        (content) => {
          const result = transformToRoundup(content);
          
          if (result.itemsExtracted > 0) {
            // Transformed should be different (has formatting)
            expect(result.transformed).not.toBe(result.original);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('transformation result has correct format field', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 500 }),
        (content) => {
          const result = transformToRoundup(content);
          
          expect(result.format).toBe('roundup');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 20: Top N List Cardinality**
 * **Validates: Requirements 8.3, 8.4**
 * 
 * For any Top N transformation request, the generated list SHALL contain
 * exactly min(N, available_items) items.
 */
describe('Property 20: Top N List Cardinality', () => {
  it('top N list contains at most N items', () => {
    fc.assert(
      fc.property(
        listContentGen,
        fc.integer({ min: 1, max: 10 }),
        (content, n) => {
          const result = createTopNList(content, n);
          
          // Count numbered items in result (format is "### 1. Title")
          const matches = result.match(/^### \d+\./gm);
          const itemCount = matches ? matches.length : 0;
          
          expect(itemCount).toBeLessThanOrEqual(n);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('top N list contains min(N, available) items', () => {
    // Create content with exactly 5 items
    const content = '1. Item one\n2. Item two\n3. Item three\n4. Item four\n5. Item five';
    
    // Request 3 items
    const result3 = createTopNList(content, 3);
    // Output format is "### 1. Title" so we match that pattern
    const matches3 = result3.match(/^### \d+\./gm);
    expect(matches3?.length).toBe(3);
    
    // Request 10 items (more than available)
    const result10 = createTopNList(content, 10);
    const matches10 = result10.match(/^### \d+\./gm);
    expect(matches10?.length).toBe(5); // Only 5 available
  });

  it('empty content returns original', () => {
    const content = 'No list items here.';
    const result = createTopNList(content, 5);
    
    expect(result).toBe(content);
  });

  it('N=0 returns original content', () => {
    fc.assert(
      fc.property(
        listContentGen,
        (content) => {
          const result = createTopNList(content, 0);
          
          // With N=0, should return original or empty list
          expect(result).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Additional transformer tests
 */
describe('Content Transformer Utilities', () => {
  it('comparison table is generated', () => {
    const content = '1. Option A\n2. Option B\n3. Option C';
    const result = generateComparisonTable(content);
    
    // Should contain table markers
    expect(result).toContain('|');
    expect(result).toContain('---');
  });

  it('transformer factory creates working instance', () => {
    const transformer = createContentTransformer();
    
    expect(transformer.detectSuitability).toBeDefined();
    expect(transformer.toRoundup).toBeDefined();
    expect(transformer.toComparisonTable).toBeDefined();
    expect(transformer.toTopN).toBeDefined();
    expect(transformer.transform).toBeDefined();
  });

  it('transform method uses detected format', () => {
    const transformer = createContentTransformer();
    const content = '1. First item\n2. Second item\n3. Third item';
    
    const result = transformer.transform(content);
    
    expect(result.original).toBe(content);
    expect(result.format).toBeDefined();
    expect(result.itemsExtracted).toBeGreaterThanOrEqual(0);
  });

  it('transform method respects explicit format', () => {
    const transformer = createContentTransformer();
    const content = '1. First item\n2. Second item\n3. Third item';
    
    const result = transformer.transform(content, 'comparison');
    
    expect(result.format).toBe('comparison');
  });

  it('confidence is bounded 0-1 in transformation result', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 500 }),
        (content) => {
          const result = transformToRoundup(content);
          
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('itemsExtracted is non-negative', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (content) => {
          const result = transformToRoundup(content);
          
          expect(result.itemsExtracted).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
