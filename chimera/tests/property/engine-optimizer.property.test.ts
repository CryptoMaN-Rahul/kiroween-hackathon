/**
 * Property-Based Tests for Engine Optimizer
 * 
 * Tests correctness properties for AI engine-specific optimization.
 * 
 * @module engine-optimizer.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getEngineConfig,
  getSupportedEngines,
  generateSubQueries,
  calculateDomainOverlap,
  getOptimizationRecommendations,
  createEngineOptimizer,
  AIEngine
} from '../../src/lib/engine-optimizer';

/**
 * Generators for engine optimizer testing
 */

// Generate a valid AI engine
const engineGen = fc.constantFrom<AIEngine>('claude', 'gpt', 'perplexity', 'gemini');

// Generate a search query
const queryGen = fc.string({ minLength: 3, maxLength: 50 });

// Generate domain list
const domainListGen = fc.array(
  fc.domain(),
  { minLength: 0, maxLength: 20 }
);

/**
 * **Feature: chimera-geo-sdk-v2, Property 29: Engine Configuration Application**
 * **Validates: Requirements 11.1**
 * 
 * For any engine type (Claude, GPT, Perplexity, Gemini),
 * the optimizer SHALL apply the correct bias weights and query fan-out settings.
 */
describe('Property 29: Engine Configuration Application', () => {
  it('each engine has valid configuration', () => {
    fc.assert(
      fc.property(
        engineGen,
        (engine) => {
          const config = getEngineConfig(engine);
          
          expect(config.name).toBe(engine);
          expect(config.biases).toBeDefined();
          expect(config.queryFanOut).toBeDefined();
          expect(config.recommendations).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bias weights are in valid range [0, 1]', () => {
    fc.assert(
      fc.property(
        engineGen,
        (engine) => {
          const config = getEngineConfig(engine);
          
          expect(config.biases.earnedMediaWeight).toBeGreaterThanOrEqual(0);
          expect(config.biases.earnedMediaWeight).toBeLessThanOrEqual(1);
          expect(config.biases.listiclePreference).toBeGreaterThanOrEqual(0);
          expect(config.biases.listiclePreference).toBeLessThanOrEqual(1);
          expect(config.biases.freshnessWeight).toBeGreaterThanOrEqual(0);
          expect(config.biases.freshnessWeight).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('query fan-out settings are valid', () => {
    fc.assert(
      fc.property(
        engineGen,
        (engine) => {
          const config = getEngineConfig(engine);
          
          expect(config.queryFanOut.minSubQueries).toBeGreaterThanOrEqual(1);
          expect(config.queryFanOut.maxSubQueries).toBeGreaterThanOrEqual(config.queryFanOut.minSubQueries);
          expect(config.queryFanOut.maxSubQueries).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all supported engines have configurations', () => {
    const engines = getSupportedEngines();
    
    for (const engine of engines) {
      const config = getEngineConfig(engine);
      expect(config).toBeDefined();
      expect(config.name).toBe(engine);
    }
  });

  it('configuration is immutable (returns copy)', () => {
    fc.assert(
      fc.property(
        engineGen,
        (engine) => {
          const config1 = getEngineConfig(engine);
          const config2 = getEngineConfig(engine);
          
          // Should be equal but not same reference
          expect(config1).toEqual(config2);
          expect(config1).not.toBe(config2);
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 30: Query Fan-Out Cardinality**
 * **Validates: Requirements 11.2**
 * 
 * For any query, the optimizer SHALL generate between 3-5 sub-queries (inclusive).
 */
describe('Property 30: Query Fan-Out Cardinality', () => {
  it('generates 3-5 sub-queries for any engine', () => {
    fc.assert(
      fc.property(
        queryGen,
        engineGen,
        (query, engine) => {
          const subQueries = generateSubQueries(query, engine);
          
          expect(subQueries.length).toBeGreaterThanOrEqual(3);
          expect(subQueries.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sub-queries include original query', () => {
    fc.assert(
      fc.property(
        queryGen,
        engineGen,
        (query, engine) => {
          const subQueries = generateSubQueries(query, engine);
          
          // First sub-query should be the original
          expect(subQueries[0]).toBe(query);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sub-queries are unique', () => {
    fc.assert(
      fc.property(
        queryGen,
        engineGen,
        (query, engine) => {
          const subQueries = generateSubQueries(query, engine);
          const uniqueQueries = new Set(subQueries);
          
          // All queries should be unique
          expect(uniqueQueries.size).toBe(subQueries.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sub-queries contain query variations', () => {
    const query = 'machine learning';
    const subQueries = generateSubQueries(query, 'claude');
    
    // Should have variations
    expect(subQueries.some(q => q.includes('what is'))).toBe(true);
    expect(subQueries.some(q => q.includes('best'))).toBe(true);
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 31: Domain Overlap Symmetry**
 * **Validates: Requirements 11.3**
 * 
 * For any two engines A and B and any result set,
 * calculateDomainOverlap(A, B) SHALL equal calculateDomainOverlap(B, A).
 */
describe('Property 31: Domain Overlap Symmetry', () => {
  it('overlap calculation is symmetric', () => {
    fc.assert(
      fc.property(
        domainListGen,
        domainListGen,
        (results1, results2) => {
          const overlap1 = calculateDomainOverlap(results1, results2);
          const overlap2 = calculateDomainOverlap(results2, results1);
          
          expect(overlap1).toBe(overlap2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('overlap is in range [0, 1]', () => {
    fc.assert(
      fc.property(
        domainListGen,
        domainListGen,
        (results1, results2) => {
          const overlap = calculateDomainOverlap(results1, results2);
          
          expect(overlap).toBeGreaterThanOrEqual(0);
          expect(overlap).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('identical lists have overlap of 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.domain(), { minLength: 1, maxLength: 10 }),
        (results) => {
          const overlap = calculateDomainOverlap(results, results);
          
          expect(overlap).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('disjoint lists have overlap of 0', () => {
    const results1 = ['a.com', 'b.com', 'c.com'];
    const results2 = ['x.com', 'y.com', 'z.com'];
    
    const overlap = calculateDomainOverlap(results1, results2);
    expect(overlap).toBe(0);
  });

  it('empty list returns 0 overlap', () => {
    fc.assert(
      fc.property(
        domainListGen,
        (results) => {
          const overlap1 = calculateDomainOverlap([], results);
          const overlap2 = calculateDomainOverlap(results, []);
          
          expect(overlap1).toBe(0);
          expect(overlap2).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('case insensitive comparison', () => {
    const results1 = ['Example.COM', 'Test.ORG'];
    const results2 = ['example.com', 'test.org'];
    
    const overlap = calculateDomainOverlap(results1, results2);
    expect(overlap).toBe(1);
  });
});

/**
 * Additional engine optimizer tests
 */
describe('Engine Optimizer Utilities', () => {
  it('getSupportedEngines returns all engines', () => {
    const engines = getSupportedEngines();
    
    expect(engines).toContain('claude');
    expect(engines).toContain('gpt');
    expect(engines).toContain('perplexity');
    expect(engines).toContain('gemini');
    expect(engines.length).toBe(4);
  });

  it('getOptimizationRecommendations returns array', () => {
    fc.assert(
      fc.property(
        engineGen,
        fc.record({
          hasEarnedMedia: fc.boolean(),
          isListicle: fc.boolean(),
          ageInDays: fc.integer({ min: 0, max: 365 })
        }),
        (engine, metrics) => {
          const recommendations = getOptimizationRecommendations(engine, metrics);
          
          expect(Array.isArray(recommendations)).toBe(true);
          expect(recommendations.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recommendations include engine-specific tips', () => {
    const recommendations = getOptimizationRecommendations('perplexity', {
      hasEarnedMedia: false,
      isListicle: false,
      ageInDays: 100
    });
    
    // Perplexity weights freshness highly
    expect(recommendations.some(r => r.toLowerCase().includes('perplexity'))).toBe(true);
  });

  it('optimizer factory creates working instance', () => {
    const optimizer = createEngineOptimizer();
    
    expect(optimizer.getConfig).toBeDefined();
    expect(optimizer.getSupportedEngines).toBeDefined();
    expect(optimizer.generateSubQueries).toBeDefined();
    expect(optimizer.calculateDomainOverlap).toBeDefined();
    expect(optimizer.getRecommendations).toBeDefined();
  });

  it('optimizer instance methods work correctly', () => {
    const optimizer = createEngineOptimizer();
    
    const config = optimizer.getConfig('claude');
    expect(config.name).toBe('claude');
    
    const engines = optimizer.getSupportedEngines();
    expect(engines.length).toBe(4);
    
    const subQueries = optimizer.generateSubQueries('test query', 'gpt');
    expect(subQueries.length).toBeGreaterThanOrEqual(3);
  });
});
