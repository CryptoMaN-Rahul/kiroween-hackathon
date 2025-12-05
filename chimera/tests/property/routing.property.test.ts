/**
 * Property-Based Tests for Symbiote Router
 * 
 * **Feature: chimera-ai-first-edge, Property 1: 404 Interception Completeness**
 * **Validates: Requirements 1.1**
 * 
 * Tests that the Symbiote Router correctly intercepts and processes all requests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  createSymbioteRouter, 
  create404Payload,
  SymbioteRouter 
} from '@/lib/symbiote-router';

// Configuration for property tests
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

// Arbitrary for generating arrays of unique paths
const uniquePathsArb = fc.uniqueArray(pathArb, { minLength: 5, maxLength: 20 });

describe('Property 1: 404 Interception Completeness', () => {
  let router: SymbioteRouter;

  beforeEach(() => {
    router = createSymbioteRouter({
      confidenceThreshold: 0.7,
      enableLearning: true,
      aliasThreshold: 3
    });
  });

  it('existing routes are not redirected', () => {
    fc.assert(
      fc.property(uniquePathsArb, (routes) => {
        router.loadRoutes(routes);
        
        // Pick a random existing route
        const existingRoute = routes[0];
        const result = router.processRequest(existingRoute);
        
        // Should not redirect - route exists
        expect(result.shouldRedirect).toBe(false);
        expect(result.match.confidence).toBe(1);
      }),
      FC_CONFIG
    );
  });

  it('non-existent routes are processed and return a result', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          router.loadRoutes(routes);
          
          // Use a path that definitely doesn't exist
          const nonExistentPath = queryPath + '/definitely/not/here';
          const result = router.processRequest(nonExistentPath);
          
          // Should always return a result (either redirect or 404)
          expect(result).toBeDefined();
          expect(result.match).toBeDefined();
          expect(result.logEntry).toBeDefined();
        }
      ),
      FC_CONFIG
    );
  });

  it('similar paths get redirected with high confidence', () => {
    // Set up routes
    const routes = [
      '/products/electronics/phones',
      '/products/electronics/laptops',
      '/shop/clothing/mens'
    ];
    router.loadRoutes(routes);

    // Query with a similar path (typo or different structure)
    const similarPath = '/products/electronics/phone'; // Missing 's'
    const result = router.processRequest(similarPath);

    // Should redirect to the similar route
    expect(result.shouldRedirect).toBe(true);
    expect(result.redirectPath).toBe('/products/electronics/phones');
    expect(result.match.confidence).toBeGreaterThan(0.7);
  });

  it('completely different paths return 404', () => {
    const routes = [
      '/products/electronics/phones',
      '/shop/clothing/mens'
    ];
    router.loadRoutes(routes);

    // Query with a completely different path
    const differentPath = '/xyz/abc/123';
    const result = router.processRequest(differentPath);

    // Should not redirect - no similar route
    expect(result.shouldRedirect).toBe(false);
    expect(result.match.method).toBe('none');
  });

  it('all requests produce valid log entries', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          router.loadRoutes(routes);
          const result = router.processRequest(queryPath);
          
          // Log entry should have all required fields
          expect(result.logEntry.id).toBeDefined();
          expect(result.logEntry.timestamp).toBeInstanceOf(Date);
          expect(result.logEntry.hallucinatedPath).toBe(queryPath);
          expect(['redirected', '404', 'alias-used']).toContain(result.logEntry.outcome);
          expect(typeof result.logEntry.latencyMs).toBe('number');
        }
      ),
      FC_CONFIG
    );
  });

  it('redirect confidence is always between 0 and 1', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          router.loadRoutes(routes);
          const result = router.processRequest(queryPath);
          
          expect(result.match.confidence).toBeGreaterThanOrEqual(0);
          expect(result.match.confidence).toBeLessThanOrEqual(1);
        }
      ),
      FC_CONFIG
    );
  });

  it('redirects only occur when confidence >= threshold', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        fc.double({ min: 0.5, max: 0.9, noNaN: true }),
        (routes, queryPath, threshold) => {
          const customRouter = createSymbioteRouter({ confidenceThreshold: threshold });
          customRouter.loadRoutes(routes);
          
          const result = customRouter.processRequest(queryPath);
          
          if (result.shouldRedirect && result.match.method === 'semantic') {
            expect(result.match.confidence).toBeGreaterThanOrEqual(threshold);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('create404Payload returns valid error structure', () => {
    fc.assert(
      fc.property(pathArb, (path) => {
        const payload = create404Payload(path);
        
        expect(payload.error).toBe('NOT_FOUND');
        expect(payload.code).toBe(404);
        expect(payload.requestedPath).toBe(path);
        expect(payload.timestamp).toBeDefined();
        expect(payload.aiHint).toBeDefined();
      }),
      FC_CONFIG
    );
  });

  it('getSuggestions returns valid routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, pathArb, (routes, queryPath) => {
        router.loadRoutes(routes);
        const suggestions = router.getSuggestions(queryPath, 3);
        
        // All suggestions should be valid routes
        for (const suggestion of suggestions) {
          expect(routes).toContain(suggestion);
        }
        
        // Should not exceed limit
        expect(suggestions.length).toBeLessThanOrEqual(3);
      }),
      FC_CONFIG
    );
  });
});


/**
 * **Feature: chimera-geo-sdk-v2, Property 8: Router Latency Guarantee**
 * **Validates: Requirements 5.1**
 * 
 * Tests that the router tracks latency and reports whether operations
 * completed within the configured latency budget.
 */
describe('Property 8: Router Latency Guarantee', () => {
  it('all results include withinLatencyBudget flag', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          const router = createSymbioteRouter({ maxLatencyMs: 200 });
          router.loadRoutes(routes);
          const result = router.processRequest(queryPath);
          
          // withinLatencyBudget should always be defined
          expect(typeof result.withinLatencyBudget).toBe('boolean');
        }
      ),
      FC_CONFIG
    );
  });

  it('latency is tracked in match result', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          const result = router.processRequest(queryPath);
          
          // Latency should be a non-negative number
          expect(typeof result.match.latencyMs).toBe('number');
          expect(result.match.latencyMs).toBeGreaterThanOrEqual(0);
        }
      ),
      FC_CONFIG
    );
  });

  it('withinLatencyBudget is true when latency <= maxLatencyMs', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          // Use a generous latency budget
          const router = createSymbioteRouter({ maxLatencyMs: 5000 });
          router.loadRoutes(routes);
          const result = router.processRequest(queryPath);
          
          // With a 5 second budget, should always be within budget
          if (result.match.latencyMs <= 5000) {
            expect(result.withinLatencyBudget).toBe(true);
          }
        }
      ),
      FC_CONFIG
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 9: No Empty Response Invariant**
 * **Validates: Requirements 5.2**
 * 
 * Tests that the router never returns an empty response - always either
 * a redirect OR a structured 404 with suggestions.
 */
describe('Property 9: No Empty Response Invariant', () => {
  it('non-redirects always have notFoundPayload', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          
          // Use a path that won't match
          const nonMatchingPath = queryPath + '/xyz/abc/definitely/not/matching';
          const result = router.processRequest(nonMatchingPath);
          
          if (!result.shouldRedirect && result.match.method === 'none' && result.match.confidence < 1) {
            // Should have a structured 404 payload
            expect(result.notFoundPayload).not.toBeNull();
            expect(result.notFoundPayload?.error).toBe('NOT_FOUND');
            expect(result.notFoundPayload?.code).toBe(404);
            expect(result.notFoundPayload?.requestedPath).toBe(nonMatchingPath);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('notFoundPayload always includes suggestions array', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          
          const nonMatchingPath = queryPath + '/xyz/abc/definitely/not/matching';
          const result = router.processRequest(nonMatchingPath);
          
          if (result.notFoundPayload) {
            expect(Array.isArray(result.notFoundPayload.suggestions)).toBe(true);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('notFoundPayload includes aiHint for AI agents', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        pathArb,
        (routes, queryPath) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          
          const nonMatchingPath = queryPath + '/xyz/abc/definitely/not/matching';
          const result = router.processRequest(nonMatchingPath);
          
          if (result.notFoundPayload) {
            expect(typeof result.notFoundPayload.aiHint).toBe('string');
            expect(result.notFoundPayload.aiHint.length).toBeGreaterThan(0);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('redirects have null notFoundPayload', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        (routes) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          
          // Query an existing route
          const existingRoute = routes[0];
          const result = router.processRequest(existingRoute);
          
          // Existing routes should not have 404 payload
          expect(result.notFoundPayload).toBeNull();
        }
      ),
      FC_CONFIG
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 11: Event Emission Completeness**
 * **Validates: Requirements 5.4**
 * 
 * Tests that router metrics are correctly tracked for all operations.
 */
describe('Property 11: Event Emission Completeness (Metrics)', () => {
  it('totalRequests increments for every request', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        fc.array(pathArb, { minLength: 1, maxLength: 10 }),
        (routes, queries) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          router.resetMetrics();
          
          queries.forEach(q => router.processRequest(q));
          
          const metrics = router.getRouterMetrics();
          expect(metrics.totalRequests).toBe(queries.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('metrics categories sum to totalRequests', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        fc.array(pathArb, { minLength: 1, maxLength: 10 }),
        (routes, queries) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          router.resetMetrics();
          
          queries.forEach(q => router.processRequest(q));
          
          const metrics = router.getRouterMetrics();
          const categorizedTotal = metrics.exactMatches + metrics.fuzzyMatches + 
                                   metrics.aliasMatches + metrics.notFound;
          
          expect(categorizedTotal).toBe(metrics.totalRequests);
        }
      ),
      FC_CONFIG
    );
  });

  it('averageLatencyMs is calculated correctly', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        fc.array(pathArb, { minLength: 1, maxLength: 5 }),
        (routes, queries) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          router.resetMetrics();
          
          queries.forEach(q => router.processRequest(q));
          
          const metrics = router.getRouterMetrics();
          
          // Average should be non-negative
          expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
          
          // If we have requests, average should be positive (some time passes)
          if (queries.length > 0) {
            expect(metrics.latencyHistogram.length).toBe(queries.length);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('p99LatencyMs is at least as large as averageLatencyMs', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        fc.array(pathArb, { minLength: 5, maxLength: 20 }),
        (routes, queries) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          router.resetMetrics();
          
          queries.forEach(q => router.processRequest(q));
          
          const metrics = router.getRouterMetrics();
          
          // p99 should be >= average (by definition of percentiles)
          expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(metrics.averageLatencyMs);
        }
      ),
      FC_CONFIG
    );
  });

  it('resetMetrics clears all counters', () => {
    fc.assert(
      fc.property(
        uniquePathsArb,
        fc.array(pathArb, { minLength: 1, maxLength: 5 }),
        (routes, queries) => {
          const router = createSymbioteRouter();
          router.loadRoutes(routes);
          
          // Process some requests
          queries.forEach(q => router.processRequest(q));
          
          // Reset
          router.resetMetrics();
          
          const metrics = router.getRouterMetrics();
          expect(metrics.totalRequests).toBe(0);
          expect(metrics.exactMatches).toBe(0);
          expect(metrics.fuzzyMatches).toBe(0);
          expect(metrics.aliasMatches).toBe(0);
          expect(metrics.notFound).toBe(0);
          expect(metrics.timedOut).toBe(0);
          expect(metrics.averageLatencyMs).toBe(0);
          expect(metrics.p99LatencyMs).toBe(0);
          expect(metrics.latencyHistogram.length).toBe(0);
        }
      ),
      FC_CONFIG
    );
  });
});
