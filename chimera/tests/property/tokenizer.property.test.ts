/**
 * Property-Based Tests for URL Tokenizer
 * 
 * **Feature: chimera-ai-first-edge, Property 3: URL Tokenization Consistency**
 * **Validates: Requirements 1.6**
 * 
 * Tests that URL tokenization is consistent regardless of separator type.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  tokenizePath, 
  joinTokens, 
  extractSemanticTokens,
  haveSameSemantics,
  calculateTokenOverlap 
} from '@/lib/tokenizer';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// Arbitrary for generating valid URL path segments (alphanumeric, no separators)
const pathSegmentArb = fc.string({ 
  minLength: 1, 
  maxLength: 15,
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
});

// Arbitrary for generating arrays of path segments
const pathSegmentsArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 5 });

// Arbitrary for separator characters
const separatorArb = fc.constantFrom('/', '-', '_');

describe('Property 3: URL Tokenization Consistency', () => {
  
  it('tokenizing a path is deterministic - same input always produces same output', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        separatorArb,
        (segments, sep) => {
          const path = '/' + segments.join(sep);
          const result1 = tokenizePath(path);
          const result2 = tokenizePath(path);
          
          expect(result1).toEqual(result2);
        }
      ),
      FC_CONFIG
    );
  });

  it('different separators produce same tokens for same words', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        (segments) => {
          // Create paths with different separators
          const pathSlash = '/' + segments.join('/');
          const pathHyphen = '/' + segments.join('-');
          const pathUnderscore = '/' + segments.join('_');
          
          const tokensSlash = tokenizePath(pathSlash);
          const tokensHyphen = tokenizePath(pathHyphen);
          const tokensUnderscore = tokenizePath(pathUnderscore);
          
          // All should produce the same tokens (lowercased segments)
          const expected = segments.map(s => s.toLowerCase());
          
          expect(tokensSlash).toEqual(expected);
          expect(tokensHyphen).toEqual(expected);
          expect(tokensUnderscore).toEqual(expected);
        }
      ),
      FC_CONFIG
    );
  });

  it('empty paths return empty arrays', () => {
    expect(tokenizePath('')).toEqual([]);
    expect(tokenizePath('/')).toEqual([]);
    expect(tokenizePath('///')).toEqual([]);
    expect(tokenizePath('   ')).toEqual([]);
  });

  it('tokens are always lowercase', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ 
            minLength: 1, 
            maxLength: 10,
            unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''))
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (segments) => {
          const path = '/' + segments.join('/');
          const tokens = tokenizePath(path);
          
          tokens.forEach(token => {
            expect(token).toBe(token.toLowerCase());
          });
        }
      ),
      FC_CONFIG
    );
  });

  it('trailing and leading slashes do not affect tokens', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        fc.nat({ max: 3 }),
        fc.nat({ max: 3 }),
        (segments, leadingSlashes, trailingSlashes) => {
          const basePath = segments.join('/');
          const pathWithSlashes = '/'.repeat(leadingSlashes + 1) + basePath + '/'.repeat(trailingSlashes);
          const pathClean = '/' + basePath;
          
          expect(tokenizePath(pathWithSlashes)).toEqual(tokenizePath(pathClean));
        }
      ),
      FC_CONFIG
    );
  });

  it('token count equals segment count for simple paths', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        (segments) => {
          const path = '/' + segments.join('/');
          const tokens = tokenizePath(path);
          
          expect(tokens.length).toBe(segments.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('extractSemanticTokens returns sorted unique tokens', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        (segments) => {
          // Add some duplicates
          const withDupes = [...segments, ...segments.slice(0, 1)];
          const path = '/' + withDupes.join('/');
          
          const semantic = extractSemanticTokens(path);
          
          // Should be sorted
          const sorted = [...semantic].sort();
          expect(semantic).toEqual(sorted);
          
          // Should be unique
          const unique = Array.from(new Set(semantic));
          expect(semantic).toEqual(unique);
        }
      ),
      FC_CONFIG
    );
  });

  it('haveSameSemantics is symmetric', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        pathSegmentsArb,
        (segments1, segments2) => {
          const path1 = '/' + segments1.join('/');
          const path2 = '/' + segments2.join('-');
          
          expect(haveSameSemantics(path1, path2)).toBe(haveSameSemantics(path2, path1));
        }
      ),
      FC_CONFIG
    );
  });

  it('calculateTokenOverlap returns 1 for identical paths', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        (segments) => {
          const path = '/' + segments.join('/');
          
          expect(calculateTokenOverlap(path, path)).toBe(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('calculateTokenOverlap is symmetric', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        pathSegmentsArb,
        (segments1, segments2) => {
          const path1 = '/' + segments1.join('/');
          const path2 = '/' + segments2.join('/');
          
          expect(calculateTokenOverlap(path1, path2)).toBe(calculateTokenOverlap(path2, path1));
        }
      ),
      FC_CONFIG
    );
  });

  it('calculateTokenOverlap is between 0 and 1', () => {
    fc.assert(
      fc.property(
        pathSegmentsArb,
        pathSegmentsArb,
        (segments1, segments2) => {
          const path1 = '/' + segments1.join('/');
          const path2 = '/' + segments2.join('/');
          
          const overlap = calculateTokenOverlap(path1, path2);
          
          expect(overlap).toBeGreaterThanOrEqual(0);
          expect(overlap).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });
});
