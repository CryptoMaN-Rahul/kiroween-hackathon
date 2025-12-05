/**
 * Property-Based Tests for Freshness Monitor
 * 
 * Tests correctness properties for content freshness and staleness detection.
 * 
 * @module freshness.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  analyzeFreshness,
  calculateVelocity,
  getStalePages,
  injectDateModified,
  calculateAgeInDays,
  determineRefreshPriority,
  createFreshnessMonitor
} from '../../src/lib/freshness-monitor';

/**
 * Generators for freshness testing
 */

// Generate a date within the last 2 years (using integer days to avoid invalid dates)
const recentDateGen = fc.integer({ min: 0, max: 730 }).map(daysAgo => 
  new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
);

// Generate a path
const pathGen = fc.stringMatching(/^\/[a-z0-9\-\/]{1,50}$/);

// Generate page data
const pageGen = fc.record({
  path: pathGen,
  lastModified: recentDateGen
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 15: Staleness Detection and Queue Ordering**
 * **Validates: Requirements 7.1, 7.3**
 * 
 * For any page with lastModified date more than 90 days ago,
 * the page SHALL be flagged as stale AND appear in the refresh queue
 * ordered by staleness (oldest first).
 */
describe('Property 15: Staleness Detection and Queue Ordering', () => {
  it('pages older than threshold are flagged as stale', () => {
    fc.assert(
      fc.property(
        pathGen,
        fc.integer({ min: 91, max: 365 }),
        (path, daysAgo) => {
          const lastModified = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const result = analyzeFreshness(path, lastModified);
          
          expect(result.isStale).toBe(true);
          expect(result.ageInDays).toBeGreaterThanOrEqual(90);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pages newer than threshold are not stale', () => {
    fc.assert(
      fc.property(
        pathGen,
        fc.integer({ min: 0, max: 89 }),
        (path, daysAgo) => {
          const lastModified = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const result = analyzeFreshness(path, lastModified);
          
          expect(result.isStale).toBe(false);
          expect(result.ageInDays).toBeLessThanOrEqual(90);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stale pages are ordered by staleness (oldest first)', () => {
    fc.assert(
      fc.property(
        fc.array(pageGen, { minLength: 2, maxLength: 20 }),
        (pages) => {
          const stalePages = getStalePages(pages);
          
          // Verify ordering: oldest (highest ageInDays) first
          for (let i = 1; i < stalePages.length; i++) {
            expect(stalePages[i].ageInDays).toBeLessThanOrEqual(stalePages[i - 1].ageInDays);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only stale pages appear in stale queue', () => {
    fc.assert(
      fc.property(
        fc.array(pageGen, { minLength: 1, maxLength: 20 }),
        (pages) => {
          const stalePages = getStalePages(pages);
          
          for (const page of stalePages) {
            expect(page.isStale).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('custom threshold is respected', () => {
    const path = '/test-page';
    const lastModified = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
    
    // With default 90-day threshold, not stale
    const defaultResult = analyzeFreshness(path, lastModified);
    expect(defaultResult.isStale).toBe(false);
    
    // With 30-day threshold, is stale
    const customResult = analyzeFreshness(path, lastModified, { staleThresholdDays: 30, velocityWindowMonths: 3 });
    expect(customResult.isStale).toBe(true);
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 16: Schema DateModified Injection**
 * **Validates: Requirements 7.2**
 * 
 * For any page with a known lastModified date,
 * the generated Schema.org markup SHALL include a dateModified property.
 */
describe('Property 16: Schema DateModified Injection', () => {
  it('dateModified is added to schema', () => {
    fc.assert(
      fc.property(
        fc.record({
          '@type': fc.constantFrom('Article', 'Product', 'WebPage'),
          name: fc.string({ minLength: 1, maxLength: 100 })
        }),
        recentDateGen,
        (schema, lastModified) => {
          const result = injectDateModified(schema, lastModified);
          
          expect(result.dateModified).toBeDefined();
          expect(typeof result.dateModified).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dateModified is in ISO date format', () => {
    fc.assert(
      fc.property(
        fc.record({ name: fc.string({ minLength: 1, maxLength: 50 }) }),
        fc.integer({ min: 0, max: 365 }),
        (schema, daysAgo) => {
          const lastModified = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const result = injectDateModified(schema, lastModified);
          
          // Should be YYYY-MM-DD format
          expect(result.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('original schema properties are preserved', () => {
    fc.assert(
      fc.property(
        fc.record({
          '@type': fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 1, maxLength: 100 })
        }),
        fc.integer({ min: 0, max: 365 }),
        (schema, daysAgo) => {
          const lastModified = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const result = injectDateModified(schema, lastModified);
          
          expect(result['@type']).toBe(schema['@type']);
          expect(result.name).toBe(schema.name);
          expect(result.description).toBe(schema.description);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 17: Content Velocity Calculation**
 * **Validates: Requirements 7.4**
 * 
 * For any page with N updates over M months (M > 0),
 * the calculated velocity SHALL equal N/M updates per month.
 */
describe('Property 17: Content Velocity Calculation', () => {
  it('velocity is calculated correctly', () => {
    // Create updates over 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const updates = [
      threeMonthsAgo,
      new Date(threeMonthsAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      new Date(threeMonthsAgo.getTime() + 60 * 24 * 60 * 60 * 1000),
      now
    ];
    
    const velocity = calculateVelocity(updates);
    
    // 3 updates (excluding baseline) over ~3 months = ~1 update/month
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThan(2);
  });

  it('empty or single update returns 0 velocity', () => {
    expect(calculateVelocity([])).toBe(0);
    expect(calculateVelocity([new Date()])).toBe(0);
  });

  it('velocity is non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 365 }), { minLength: 0, maxLength: 20 }),
        (daysAgoArray) => {
          const updates = daysAgoArray.map(d => new Date(Date.now() - d * 24 * 60 * 60 * 1000));
          const velocity = calculateVelocity(updates);
          expect(velocity).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('more updates in same period = higher velocity', () => {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const fewUpdates = [monthAgo, now];
    const manyUpdates = [
      monthAgo,
      new Date(monthAgo.getTime() + 7 * 24 * 60 * 60 * 1000),
      new Date(monthAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
      new Date(monthAgo.getTime() + 21 * 24 * 60 * 60 * 1000),
      now
    ];
    
    const fewVelocity = calculateVelocity(fewUpdates);
    const manyVelocity = calculateVelocity(manyUpdates);
    
    expect(manyVelocity).toBeGreaterThan(fewVelocity);
  });
});

/**
 * Additional freshness tests
 */
describe('Freshness Monitor Utilities', () => {
  it('calculateAgeInDays is accurate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        (daysAgo) => {
          const lastModified = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const age = calculateAgeInDays(lastModified);
          
          // Allow 1 day tolerance for edge cases
          expect(Math.abs(age - daysAgo)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('refresh priority increases with age', () => {
    const threshold = 90;
    
    expect(determineRefreshPriority(30, threshold)).toBe('low');
    expect(determineRefreshPriority(60, threshold)).toBe('medium');
    expect(determineRefreshPriority(100, threshold)).toBe('high');
    expect(determineRefreshPriority(200, threshold)).toBe('critical');
  });

  it('freshness monitor tracks updates', () => {
    const monitor = createFreshnessMonitor();
    const path = '/test-page';
    
    // Record some updates
    const now = new Date();
    monitor.recordUpdate(path, new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000));
    monitor.recordUpdate(path, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    monitor.recordUpdate(path, now);
    
    const velocity = monitor.getVelocity(path);
    expect(velocity).toBeGreaterThan(0);
  });

  it('analyzeFreshness returns complete metrics', () => {
    fc.assert(
      fc.property(
        pathGen,
        recentDateGen,
        (path, lastModified) => {
          const result = analyzeFreshness(path, lastModified);
          
          expect(result.path).toBe(path);
          expect(result.lastModified).toEqual(lastModified);
          expect(typeof result.ageInDays).toBe('number');
          expect(typeof result.isStale).toBe('boolean');
          expect(typeof result.velocity).toBe('number');
          expect(['critical', 'high', 'medium', 'low']).toContain(result.refreshPriority);
        }
      ),
      { numRuns: 100 }
    );
  });
});
