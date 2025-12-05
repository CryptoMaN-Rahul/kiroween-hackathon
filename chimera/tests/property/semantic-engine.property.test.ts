/**
 * Property-Based Tests for Semantic Similarity Engine
 * 
 * **Feature: chimera-ai-first-edge, Property 2: Semantic Match Confidence Threshold**
 * **Validates: Requirements 1.3, 1.4**
 * 
 * Tests that semantic matching correctly applies confidence thresholds.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  findBestMatch, 
  calculateSimilarity, 
  rankRoutes,
  createSemanticEngine,
  DEFAULT_CONFIG,
  jaroWinklerDistance,
  jaroSimilarity,
  levenshteinDistance,
  nGramSimilarity,
  soundexMatch,
  soundexCode,
  cosineSimilarity,
  combineAlgorithmScores,
  normalizeWithWhitelist,
  DEFAULT_WHITELIST,
  batchFindMatches
} from '@/lib/semantic-engine';
import { createSynonymDictionary } from '@/lib/ai-search/synonym-dictionary';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// Arbitrary for generating valid URL path segments
const pathSegmentArb = fc.string({ 
  minLength: 1, 
  maxLength: 10,
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
});

// Arbitrary for generating URL paths
const pathArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 4 })
  .map(segments => '/' + segments.join('/'));

// Arbitrary for generating arrays of valid routes
const routesArb = fc.array(pathArb, { minLength: 1, maxLength: 10 });

describe('Property 2: Semantic Match Confidence Threshold', () => {

  it('findBestMatch returns null when no routes provided', () => {
    fc.assert(
      fc.property(pathArb, (path) => {
        const result = findBestMatch(path, []);
        expect(result).toBeNull();
      }),
      FC_CONFIG
    );
  });

  it('findBestMatch returns exact match with confidence 1.0', () => {
    fc.assert(
      fc.property(pathArb, routesArb, (path, otherRoutes) => {
        // Include the exact path in routes
        const routes = [path, ...otherRoutes];
        const result = findBestMatch(path, routes);
        
        expect(result).not.toBeNull();
        expect(result!.confidence).toBe(1);
        expect(result!.route).toBe(path);
      }),
      FC_CONFIG
    );
  });

  it('matches above minConfidence threshold are returned', () => {
    fc.assert(
      fc.property(
        pathArb,
        routesArb,
        fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        (path, routes, threshold) => {
          const engine = createSemanticEngine({ minConfidence: threshold });
          const result = engine.findBestMatch(path, routes);
          
          if (result !== null) {
            expect(result.confidence).toBeGreaterThanOrEqual(threshold);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('calculateSimilarity is symmetric', () => {
    fc.assert(
      fc.property(pathArb, pathArb, (path1, path2) => {
        const sim1 = calculateSimilarity(path1, path2);
        const sim2 = calculateSimilarity(path2, path1);
        
        // Allow small floating point differences
        expect(Math.abs(sim1 - sim2)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('calculateSimilarity returns 1 for identical paths', () => {
    fc.assert(
      fc.property(pathArb, (path) => {
        const similarity = calculateSimilarity(path, path);
        expect(similarity).toBe(1);
      }),
      FC_CONFIG
    );
  });

  it('calculateSimilarity is between 0 and 1', () => {
    fc.assert(
      fc.property(pathArb, pathArb, (path1, path2) => {
        const similarity = calculateSimilarity(path1, path2);
        
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
      }),
      FC_CONFIG
    );
  });

  it('rankRoutes returns routes sorted by confidence descending', () => {
    fc.assert(
      fc.property(pathArb, routesArb, (path, routes) => {
        const ranked = rankRoutes(path, routes);
        
        // Check sorted order
        for (let i = 1; i < ranked.length; i++) {
          expect(ranked[i - 1].confidence).toBeGreaterThanOrEqual(ranked[i].confidence);
        }
      }),
      FC_CONFIG
    );
  });

  it('findBestMatch returns the highest confidence match', () => {
    fc.assert(
      fc.property(pathArb, routesArb, (path, routes) => {
        if (routes.length === 0) return;
        
        const bestMatch = findBestMatch(path, routes);
        const ranked = rankRoutes(path, routes);
        
        if (bestMatch !== null && ranked.length > 0) {
          expect(bestMatch.confidence).toBe(ranked[0].confidence);
        }
      }),
      FC_CONFIG
    );
  });

  it('similar paths have higher confidence than dissimilar paths', () => {
    // Test with controlled paths where we know the relationship
    const basePath = '/products/electronics/phones';
    const similarPath = '/products/electronics/smartphones';
    const dissimilarPath = '/about/company/history';
    
    const simSimilar = calculateSimilarity(basePath, similarPath);
    const simDissimilar = calculateSimilarity(basePath, dissimilarPath);
    
    expect(simSimilar).toBeGreaterThan(simDissimilar);
  });

  it('paths with shared tokens have non-zero similarity', () => {
    fc.assert(
      fc.property(
        pathSegmentArb,
        pathSegmentArb,
        pathSegmentArb,
        (shared, unique1, unique2) => {
          const path1 = `/${shared}/${unique1}`;
          const path2 = `/${shared}/${unique2}`;
          
          const similarity = calculateSimilarity(path1, path2);
          
          // Should have some similarity due to shared token
          expect(similarity).toBeGreaterThan(0);
        }
      ),
      FC_CONFIG
    );
  });

  it('completely different paths have low similarity', () => {
    // Use paths with no overlapping tokens
    const path1 = '/aaa/bbb/ccc';
    const path2 = '/xxx/yyy/zzz';
    
    const similarity = calculateSimilarity(path1, path2);
    
    // Should be very low (possibly 0 with strict matching)
    expect(similarity).toBeLessThan(0.5);
  });

  it('fuzzy matching catches typos', () => {
    const engine = createSemanticEngine({ 
      useFuzzyTokens: true, 
      maxEditDistance: 2,
      minConfidence: 0.3
    });
    
    // "prodcts" is a typo of "products"
    const typoPath = '/prodcts/iphone';
    const correctPath = '/products/iphone';
    
    const similarity = engine.calculateSimilarity(typoPath, correctPath);
    
    // Should still have high similarity due to fuzzy matching
    expect(similarity).toBeGreaterThan(0.5);
  });

  it('matchedTokens contains tokens that appear in both paths', () => {
    fc.assert(
      fc.property(
        pathSegmentArb,
        pathSegmentArb,
        pathSegmentArb,
        (shared, unique1, unique2) => {
          const path1 = `/${shared}/${unique1}`;
          const routes = [`/${shared}/${unique2}`];
          
          const result = findBestMatch(path1, routes);
          
          if (result !== null) {
            // The shared token should be in matchedTokens
            expect(result.matchedTokens).toContain(shared.toLowerCase());
          }
        }
      ),
      FC_CONFIG
    );
  });
});


describe('Synonym Integration', () => {
  /**
   * Tests that synonym expansion is integrated into the semantic engine
   * and that synonym matches are weighted at 0.8x exact match.
   * **Validates: Requirements 2.5, 2.6**
   */

  it('synonym paths have higher similarity than unrelated paths', () => {
    // "phone" and "smartphone" are synonyms
    const basePath = '/shop/electronics/phone';
    const synonymPath = '/shop/electronics/smartphone';
    const unrelatedPath = '/about/company/history';

    const synonymSimilarity = calculateSimilarity(basePath, synonymPath);
    const unrelatedSimilarity = calculateSimilarity(basePath, unrelatedPath);

    expect(synonymSimilarity).toBeGreaterThan(unrelatedSimilarity);
  });

  it('synonym matches are weighted at 0.8x exact match', () => {
    // Create paths where only the synonym differs
    const exactPath = '/products/phone';
    const synonymPath = '/products/smartphone';

    const exactSimilarity = calculateSimilarity(exactPath, exactPath);
    const synonymSimilarity = calculateSimilarity(exactPath, synonymPath);

    // Exact match should be 1.0
    expect(exactSimilarity).toBe(1);

    // Synonym match should be less than exact but significant
    // With 2 tokens (products, phone/smartphone), one exact (1.0) and one synonym (0.8)
    // Average weight per token = (1.0 + 0.8) / 2 = 0.9
    expect(synonymSimilarity).toBeGreaterThan(0.8);
    expect(synonymSimilarity).toBeLessThan(1);
  });

  it('findBestMatch returns synonym routes when no exact match exists', () => {
    const hallucinatedPath = '/shop/mobile'; // "mobile" is synonym of "phone"
    const validRoutes = [
      '/shop/phone',
      '/about/company',
      '/contact/support',
    ];

    const result = findBestMatch(hallucinatedPath, validRoutes);

    expect(result).not.toBeNull();
    expect(result!.route).toBe('/shop/phone');
  });

  it('custom synonym can be added at runtime without restart', () => {
    // This tests Requirement 2.6
    const dictionary = createSynonymDictionary();

    // Add a custom synonym
    dictionary.addSynonym('widget', ['gadget', 'device']);

    // Create engine with custom dictionary
    const engine = createSemanticEngine({
      synonymDictionary: dictionary,
      useSynonyms: true,
    });

    const path1 = '/products/widget';
    const path2 = '/products/gadget';

    const similarity = engine.calculateSimilarity(path1, path2);

    // Should have high similarity due to custom synonym
    expect(similarity).toBeGreaterThan(0.8);
  });
});


/**
 * Property-Based Tests for Jaro-Winkler Distance Algorithm
 * 
 * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
 * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
 * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
 * **Validates: Requirements 4.1**
 */
describe('Jaro-Winkler Distance Algorithm Properties', () => {
  // Arbitrary for generating non-empty strings
  const stringArb = fc.string({ minLength: 1, maxLength: 20 });
  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 20 });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
   * **Validates: Requirements 4.1**
   */
  it('jaroWinklerDistance returns score in range [0, 1]', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score = jaroWinklerDistance(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
   * **Validates: Requirements 4.1**
   */
  it('jaroWinklerDistance returns 1.0 for identical strings', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (s) => {
        const score = jaroWinklerDistance(s, s);
        expect(score).toBe(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
   * **Validates: Requirements 4.1**
   */
  it('jaroWinklerDistance is symmetric', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score1 = jaroWinklerDistance(a, b);
        const score2 = jaroWinklerDistance(b, a);
        // Allow small floating point differences
        expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
   * **Validates: Requirements 4.1**
   */
  it('jaroSimilarity returns score in range [0, 1]', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score = jaroSimilarity(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
   * **Validates: Requirements 4.1**
   */
  it('jaroSimilarity returns 1.0 for identical strings', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (s) => {
        const score = jaroSimilarity(s, s);
        expect(score).toBe(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
   * **Validates: Requirements 4.1**
   */
  it('jaroSimilarity is symmetric', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score1 = jaroSimilarity(a, b);
        const score2 = jaroSimilarity(b, a);
        // Allow small floating point differences
        expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('jaroWinklerDistance >= jaroSimilarity (prefix bonus)', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const jaro = jaroSimilarity(a, b);
        const jaroWinkler = jaroWinklerDistance(a, b);
        // Jaro-Winkler should be >= Jaro due to prefix bonus
        expect(jaroWinkler).toBeGreaterThanOrEqual(jaro - 0.0001);
      }),
      FC_CONFIG
    );
  });

  it('jaroWinklerDistance with common prefix is higher than without', () => {
    // Strings with common prefix should score higher
    const base = 'MARTHA';
    const withPrefix = 'MARHTA'; // Same prefix "MAR"
    const withoutPrefix = 'XARHTA'; // Different prefix
    
    const scoreWithPrefix = jaroWinklerDistance(base, withPrefix);
    const scoreWithoutPrefix = jaroWinklerDistance(base, withoutPrefix);
    
    expect(scoreWithPrefix).toBeGreaterThan(scoreWithoutPrefix);
  });

  it('prefixScale is clamped to valid range [0, 0.25]', () => {
    fc.assert(
      fc.property(
        stringArb, 
        stringArb, 
        fc.double({ min: -1, max: 1, noNaN: true }),
        (a, b, prefixScale) => {
          const score = jaroWinklerDistance(a, b, prefixScale);
          // Score should always be in valid range regardless of prefixScale
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('empty strings return 0 similarity', () => {
    expect(jaroWinklerDistance('', 'test')).toBe(0);
    expect(jaroWinklerDistance('test', '')).toBe(0);
    expect(jaroSimilarity('', 'test')).toBe(0);
    expect(jaroSimilarity('test', '')).toBe(0);
  });

  it('both empty strings return 1 similarity', () => {
    expect(jaroWinklerDistance('', '')).toBe(1);
    expect(jaroSimilarity('', '')).toBe(1);
  });
});


/**
 * Property-Based Tests for N-Gram Similarity Algorithm
 * 
 * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
 * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
 * **Validates: Requirements 4.1**
 */
describe('N-Gram Similarity Algorithm Properties', () => {
  const stringArb = fc.string({ minLength: 0, maxLength: 20 });
  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 20 });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
   * **Validates: Requirements 4.1**
   */
  it('nGramSimilarity returns score in range [0, 1]', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score = nGramSimilarity(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
   * **Validates: Requirements 4.1**
   */
  it('nGramSimilarity returns 1.0 for identical strings', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (s) => {
        const score = nGramSimilarity(s, s);
        expect(score).toBe(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
   * **Validates: Requirements 4.1**
   */
  it('nGramSimilarity is symmetric', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score1 = nGramSimilarity(a, b);
        const score2 = nGramSimilarity(b, a);
        expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('nGramSimilarity with different n values still returns valid range', () => {
    fc.assert(
      fc.property(
        stringArb, 
        stringArb, 
        fc.integer({ min: 1, max: 5 }),
        (a, b, n) => {
          const score = nGramSimilarity(a, b, n);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('empty strings return expected values', () => {
    expect(nGramSimilarity('', '')).toBe(1);
    expect(nGramSimilarity('', 'test')).toBe(0);
    expect(nGramSimilarity('test', '')).toBe(0);
  });

  it('completely different strings return 0', () => {
    // Strings with no common bigrams
    expect(nGramSimilarity('abc', 'xyz')).toBe(0);
  });

  it('similar strings have higher score than dissimilar', () => {
    const base = 'hello';
    const similar = 'hallo'; // One character different
    const dissimilar = 'world';
    
    const scoreSimilar = nGramSimilarity(base, similar);
    const scoreDissimilar = nGramSimilarity(base, dissimilar);
    
    expect(scoreSimilar).toBeGreaterThan(scoreDissimilar);
  });
});


/**
 * Property-Based Tests for Soundex Phonetic Matching
 * 
 * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
 * **Validates: Requirements 4.1**
 */
describe('Soundex Phonetic Matching Properties', () => {
  // Arbitrary for generating alphabetic strings
  const alphaStringArb = fc.string({ 
    minLength: 1, 
    maxLength: 15,
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
   * **Validates: Requirements 4.1**
   */
  it('soundexMatch returns true for identical strings', () => {
    fc.assert(
      fc.property(alphaStringArb, (s) => {
        expect(soundexMatch(s, s)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('soundexMatch is symmetric', () => {
    fc.assert(
      fc.property(alphaStringArb, alphaStringArb, (a, b) => {
        expect(soundexMatch(a, b)).toBe(soundexMatch(b, a));
      }),
      FC_CONFIG
    );
  });

  it('soundexCode returns 4-character code for non-empty strings', () => {
    fc.assert(
      fc.property(alphaStringArb, (s) => {
        const code = soundexCode(s);
        if (code !== '') {
          expect(code.length).toBe(4);
          // First character is a letter
          expect(code[0]).toMatch(/[A-Z]/);
          // Remaining are digits
          expect(code.substring(1)).toMatch(/^[0-9]{3}$/);
        }
      }),
      FC_CONFIG
    );
  });

  it('soundexCode is deterministic', () => {
    fc.assert(
      fc.property(alphaStringArb, (s) => {
        const code1 = soundexCode(s);
        const code2 = soundexCode(s);
        expect(code1).toBe(code2);
      }),
      FC_CONFIG
    );
  });

  it('empty strings return empty code', () => {
    expect(soundexCode('')).toBe('');
    expect(soundexMatch('', '')).toBe(true);
    expect(soundexMatch('', 'test')).toBe(false);
    expect(soundexMatch('test', '')).toBe(false);
  });

  it('known phonetic matches work correctly', () => {
    // Classic Soundex examples
    expect(soundexMatch('Robert', 'Rupert')).toBe(true);
    expect(soundexMatch('Smith', 'Smyth')).toBe(true);
    expect(soundexMatch('Ashcraft', 'Ashcroft')).toBe(true);
  });

  it('case insensitive matching', () => {
    fc.assert(
      fc.property(alphaStringArb, (s) => {
        expect(soundexMatch(s.toLowerCase(), s.toUpperCase())).toBe(true);
      }),
      FC_CONFIG
    );
  });
});


/**
 * Property-Based Tests for Cosine Similarity Algorithm
 * 
 * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
 * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
 * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
 * **Validates: Requirements 4.1**
 */
describe('Cosine Similarity Algorithm Properties', () => {
  const stringArb = fc.string({ minLength: 0, maxLength: 50 });
  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 });
  
  // Arbitrary for generating word-like strings
  const wordArb = fc.string({ 
    minLength: 1, 
    maxLength: 10,
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''))
  });
  const sentenceArb = fc.array(wordArb, { minLength: 1, maxLength: 10 })
    .map(words => words.join(' '));

  /**
   * **Feature: chimera-geo-sdk-v2, Property 1: Algorithm Score Range Validity**
   * **Validates: Requirements 4.1**
   */
  it('cosineSimilarity returns score in range [0, 1]', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score = cosineSimilarity(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 2: Algorithm Identity Property**
   * **Validates: Requirements 4.1**
   */
  it('cosineSimilarity returns 1.0 for identical strings', () => {
    fc.assert(
      fc.property(sentenceArb, (s) => {
        const score = cosineSimilarity(s, s);
        expect(score).toBe(1);
      }),
      FC_CONFIG
    );
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 3: Algorithm Symmetry Property**
   * **Validates: Requirements 4.1**
   */
  it('cosineSimilarity is symmetric', () => {
    fc.assert(
      fc.property(stringArb, stringArb, (a, b) => {
        const score1 = cosineSimilarity(a, b);
        const score2 = cosineSimilarity(b, a);
        expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('empty strings return expected values', () => {
    expect(cosineSimilarity('', '')).toBe(1);
    expect(cosineSimilarity('', 'test')).toBe(0);
    expect(cosineSimilarity('test', '')).toBe(0);
  });

  it('completely different tokens return 0', () => {
    expect(cosineSimilarity('abc def', 'xyz uvw')).toBe(0);
  });

  it('strings with shared tokens have non-zero similarity', () => {
    fc.assert(
      fc.property(wordArb, wordArb, wordArb, (shared, unique1, unique2) => {
        const a = `${shared} ${unique1}`;
        const b = `${shared} ${unique2}`;
        const score = cosineSimilarity(a, b);
        expect(score).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });

  it('more shared tokens means higher similarity', () => {
    const base = 'hello world foo bar';
    const moreShared = 'hello world foo baz'; // 3 shared tokens
    const lessShared = 'hello xyz abc def';   // 1 shared token
    
    const scoreMore = cosineSimilarity(base, moreShared);
    const scoreLess = cosineSimilarity(base, lessShared);
    
    expect(scoreMore).toBeGreaterThan(scoreLess);
  });
});


/**
 * Property-Based Tests for Weighted Algorithm Combiner
 * 
 * **Feature: chimera-geo-sdk-v2, Property 4: Weighted Combiner Correctness**
 * **Validates: Requirements 4.2**
 */
describe('Weighted Algorithm Combiner Properties', () => {
  // Arbitrary for generating algorithm scores (0-1)
  const scoreArb = fc.double({ min: 0, max: 1, noNaN: true });
  
  // Arbitrary for generating weights (positive)
  const weightArb = fc.double({ min: 0.01, max: 1, noNaN: true });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 4: Weighted Combiner Correctness**
   * **Validates: Requirements 4.2**
   */
  it('combineAlgorithmScores returns weighted average', () => {
    fc.assert(
      fc.property(
        scoreArb, scoreArb, scoreArb,
        weightArb, weightArb, weightArb,
        (s1, s2, s3, w1, w2, w3) => {
          const scores = { algo1: s1, algo2: s2, algo3: s3 };
          const weights = { algo1: w1, algo2: w2, algo3: w3 };
          
          const result = combineAlgorithmScores(scores, weights);
          const totalWeight = w1 + w2 + w3;
          const expected = (s1 * w1 + s2 * w2 + s3 * w3) / totalWeight;
          
          expect(Math.abs(result - expected)).toBeLessThan(0.0001);
        }
      ),
      FC_CONFIG
    );
  });

  it('combineAlgorithmScores returns score in range [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), scoreArb, { minKeys: 1, maxKeys: 5 }),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), weightArb, { minKeys: 1, maxKeys: 5 }),
        (scores, weights) => {
          const result = combineAlgorithmScores(scores, weights);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('combineAlgorithmScores with single algorithm returns that score', () => {
    fc.assert(
      fc.property(scoreArb, weightArb, (score, weight) => {
        const result = combineAlgorithmScores({ algo: score }, { algo: weight });
        expect(Math.abs(result - score)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('combineAlgorithmScores with equal weights returns simple average', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (s1, s2) => {
        const result = combineAlgorithmScores(
          { algo1: s1, algo2: s2 },
          { algo1: 0.5, algo2: 0.5 }
        );
        const expected = (s1 + s2) / 2;
        expect(Math.abs(result - expected)).toBeLessThan(0.0001);
      }),
      FC_CONFIG
    );
  });

  it('combineAlgorithmScores ignores algorithms not in scores', () => {
    const scores = { algo1: 0.8 };
    const weights = { algo1: 0.5, algo2: 0.5 }; // algo2 not in scores
    
    const result = combineAlgorithmScores(scores, weights);
    expect(result).toBe(0.8); // Only algo1 contributes
  });

  it('combineAlgorithmScores returns 0 for empty inputs', () => {
    expect(combineAlgorithmScores({}, {})).toBe(0);
    expect(combineAlgorithmScores({ algo: 0.5 }, {})).toBe(0);
  });
});


/**
 * Property-Based Tests for Whitelist Normalization
 * 
 * **Feature: chimera-geo-sdk-v2, Property 6: Whitelist Normalization Invariant**
 * **Validates: Requirements 4.4**
 */
describe('Whitelist Normalization Properties', () => {
  const wordArb = fc.string({ 
    minLength: 1, 
    maxLength: 10,
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''))
  });

  /**
   * **Feature: chimera-geo-sdk-v2, Property 6: Whitelist Normalization Invariant**
   * **Validates: Requirements 4.4**
   */
  it('normalizeWithWhitelist removes whitelisted terms', () => {
    const whitelist = ['inc', 'corp', 'llc'];
    
    fc.assert(
      fc.property(wordArb, (base) => {
        // Add a whitelist term to the base
        const withSuffix = `${base} Inc`;
        const normalized = normalizeWithWhitelist(withSuffix, whitelist);
        
        // Should not contain 'Inc' after normalization
        expect(normalized.toLowerCase()).not.toContain('inc');
        // Should still contain the base word
        expect(normalized.toLowerCase()).toContain(base.toLowerCase());
      }),
      FC_CONFIG
    );
  });

  it('normalizeWithWhitelist is case-insensitive', () => {
    const whitelist = ['inc'];
    
    expect(normalizeWithWhitelist('Apple Inc', whitelist)).toBe('Apple');
    expect(normalizeWithWhitelist('Apple INC', whitelist)).toBe('Apple');
    expect(normalizeWithWhitelist('Apple inc', whitelist)).toBe('Apple');
  });

  it('normalizeWithWhitelist preserves non-whitelisted words', () => {
    fc.assert(
      fc.property(
        fc.array(wordArb, { minLength: 1, maxLength: 5 }),
        (words) => {
          const input = words.join(' ');
          const emptyWhitelist: string[] = [];
          const result = normalizeWithWhitelist(input, emptyWhitelist);
          
          // With empty whitelist, should return same content
          expect(result).toBe(input);
        }
      ),
      FC_CONFIG
    );
  });

  it('normalizeWithWhitelist handles empty input', () => {
    expect(normalizeWithWhitelist('', ['inc'])).toBe('');
    expect(normalizeWithWhitelist('   ', ['inc'])).toBe('');
  });

  it('strings differing only by whitelist terms normalize to same result', () => {
    const whitelist = ['inc', 'corp', 'llc'];
    
    const base = 'Apple';
    const variant1 = 'Apple Inc';
    const variant2 = 'Apple Corp';
    const variant3 = 'Apple LLC';
    
    const norm1 = normalizeWithWhitelist(variant1, whitelist);
    const norm2 = normalizeWithWhitelist(variant2, whitelist);
    const norm3 = normalizeWithWhitelist(variant3, whitelist);
    
    expect(norm1).toBe(base);
    expect(norm2).toBe(base);
    expect(norm3).toBe(base);
  });

  it('DEFAULT_WHITELIST contains common business suffixes', () => {
    expect(DEFAULT_WHITELIST).toContain('corp');
    expect(DEFAULT_WHITELIST).toContain('inc');
    expect(DEFAULT_WHITELIST).toContain('llc');
    expect(DEFAULT_WHITELIST).toContain('ltd');
  });
});


/**
 * Property-Based Tests for Batch Processing
 * 
 * **Feature: chimera-geo-sdk-v2, Property 7: Batch Processing Equivalence**
 * **Validates: Requirements 4.5**
 */
describe('Batch Processing Properties', () => {
  /**
   * **Feature: chimera-geo-sdk-v2, Property 7: Batch Processing Equivalence**
   * **Validates: Requirements 4.5**
   */
  it('batchFindMatches returns same results as sequential findBestMatch', async () => {
    const inputs = ['/products/iphone', '/about/company', '/contact/us'];
    const candidates = ['/products/iphone-15', '/about/us', '/contact', '/shop/phones'];
    
    // Get sequential results
    const sequentialResults = inputs.map(input => findBestMatch(input, candidates));
    
    // Get batch results
    const batchResults = await batchFindMatches(inputs, candidates);
    
    // Should be equivalent
    expect(batchResults.length).toBe(sequentialResults.length);
    for (let i = 0; i < inputs.length; i++) {
      if (sequentialResults[i] === null) {
        expect(batchResults[i]).toBeNull();
      } else {
        expect(batchResults[i]).not.toBeNull();
        expect(batchResults[i]!.route).toBe(sequentialResults[i]!.route);
        expect(batchResults[i]!.confidence).toBe(sequentialResults[i]!.confidence);
      }
    }
  });

  it('batchFindMatches preserves input order', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.array(pathArb, { minLength: 1, maxLength: 5 }),
        fc.array(pathArb, { minLength: 1, maxLength: 5 }),
        async (inputs, candidates) => {
          const results = await batchFindMatches(inputs, candidates);
          
          // Results should have same length as inputs
          expect(results.length).toBe(inputs.length);
          
          // Each result should correspond to its input
          for (let i = 0; i < inputs.length; i++) {
            const sequential = findBestMatch(inputs[i], candidates);
            if (sequential === null) {
              expect(results[i]).toBeNull();
            } else {
              expect(results[i]?.route).toBe(sequential.route);
            }
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('batchFindMatches handles empty inputs', async () => {
    const results = await batchFindMatches([], ['/products', '/about']);
    expect(results).toEqual([]);
  });

  it('batchFindMatches handles empty candidates', async () => {
    const results = await batchFindMatches(['/products', '/about'], []);
    expect(results).toEqual([null, null]);
  });

  it('batchFindMatches respects engine config', async () => {
    const inputs = ['/products/iphone'];
    const candidates = ['/products/iphone-15'];
    
    // With high threshold, should not match
    const highThresholdResults = await batchFindMatches(
      inputs, candidates, { minConfidence: 0.99 }
    );
    expect(highThresholdResults[0]).toBeNull();
    
    // With low threshold, should match
    const lowThresholdResults = await batchFindMatches(
      inputs, candidates, { minConfidence: 0.3 }
    );
    expect(lowThresholdResults[0]).not.toBeNull();
  });
});
