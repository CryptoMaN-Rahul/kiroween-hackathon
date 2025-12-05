/**
 * Property-Based Tests for Sitemap Management
 * 
 * **Feature: chimera-ai-first-edge, Property 19: Sitemap Route Completeness**
 * **Feature: chimera-ai-first-edge, Property 20: Sitemap Splitting Threshold**
 * **Validates: Requirements 7.1, 7.2, 7.4**
 * 
 * Tests that sitemap generation is complete and splits correctly.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  generateSitemap,
  generateSitemapXml,
  generateSitemapIndexXml,
  pathsToEntries,
  MAX_ROUTES_PER_SITEMAP,
  createSitemapGenerator
} from '@/lib/sitemap-generator';
import {
  parseSitemapXml,
  parseSitemapIndex,
  indexRoutes,
  createSitemapManager,
  routeExists,
  findCandidateRoutes
} from '@/lib/sitemap-manager';

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
const uniquePathsArb = fc.uniqueArray(pathArb, { minLength: 1, maxLength: 50 });

const baseConfig = {
  baseUrl: 'https://example.com',
  defaultChangefreq: 'weekly' as const,
  defaultPriority: 0.5
};

describe('Property 19: Sitemap Route Completeness', () => {

  it('generated sitemap contains all input routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        const result = generateSitemap(paths, baseConfig);
        
        // Parse the generated sitemap(s)
        let allEntries: { loc: string }[] = [];
        
        if (result.wasSplit) {
          // Parse all split sitemaps
          const sitemapEntries = Array.from(result.additionalSitemaps.entries());
          for (const [, xml] of sitemapEntries) {
            allEntries.push(...parseSitemapXml(xml));
          }
        } else {
          allEntries = parseSitemapXml(result.mainXml);
        }
        
        // Extract paths from entries
        const generatedPaths = allEntries.map(e => {
          const url = new URL(e.loc);
          return url.pathname;
        });
        
        // All input paths should be in the output
        for (const path of paths) {
          expect(generatedPaths).toContain(path);
        }
        
        // Total count should match
        expect(result.totalRoutes).toBe(paths.length);
      }),
      FC_CONFIG
    );
  });

  it('sitemap has no duplicate routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        const result = generateSitemap(paths, baseConfig);
        
        let allEntries: { loc: string }[] = [];
        
        if (result.wasSplit) {
          const sitemapEntries = Array.from(result.additionalSitemaps.entries());
          for (const [, xml] of sitemapEntries) {
            allEntries.push(...parseSitemapXml(xml));
          }
        } else {
          allEntries = parseSitemapXml(result.mainXml);
        }
        
        const locs = allEntries.map(e => e.loc);
        const uniqueLocs = Array.from(new Set(locs));
        
        expect(locs.length).toBe(uniqueLocs.length);
      }),
      FC_CONFIG
    );
  });

  it('indexRoutes creates index with all routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        const entries = pathsToEntries(paths, baseConfig);
        const index = indexRoutes(entries);
        
        expect(index.routes.length).toBe(paths.length);
        
        // All paths should be in the index
        for (const path of paths) {
          expect(routeExists(path, index)).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });

  it('SitemapManager correctly indexes loaded routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        const manager = createSitemapManager('https://example.com');
        manager.loadFromPaths(paths);
        
        expect(manager.getRouteCount()).toBe(paths.length);
        
        for (const path of paths) {
          expect(manager.hasRoute(path)).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });

  it('round-trip: generate then parse preserves routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        // Generate sitemap
        const entries = pathsToEntries(paths, baseConfig);
        const xml = generateSitemapXml(entries);
        
        // Parse it back
        const parsed = parseSitemapXml(xml);
        
        // Should have same count
        expect(parsed.length).toBe(paths.length);
        
        // All original paths should be present
        const parsedPaths = parsed.map(e => new URL(e.loc).pathname);
        for (const path of paths) {
          expect(parsedPaths).toContain(path);
        }
      }),
      FC_CONFIG
    );
  });
});

describe('Property 20: Sitemap Splitting Threshold', () => {

  it('sitemap with <= 1000 routes is not split', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_ROUTES_PER_SITEMAP }),
        (count) => {
          // Generate exactly 'count' unique paths
          const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
          const result = generateSitemap(paths, baseConfig);
          
          expect(result.wasSplit).toBe(false);
          expect(result.additionalSitemaps.size).toBe(0);
        }
      ),
      { numRuns: 20 } // Fewer runs since we're testing specific counts
    );
  });

  it('sitemap with > 1000 routes is split', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_ROUTES_PER_SITEMAP + 1, max: MAX_ROUTES_PER_SITEMAP + 100 }),
        (count) => {
          const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
          const result = generateSitemap(paths, baseConfig);
          
          expect(result.wasSplit).toBe(true);
          expect(result.additionalSitemaps.size).toBeGreaterThan(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('split sitemaps have correct number of files', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_ROUTES_PER_SITEMAP + 1, max: MAX_ROUTES_PER_SITEMAP * 3 }),
        (count) => {
          const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
          const result = generateSitemap(paths, baseConfig);
          
          const expectedFiles = Math.ceil(count / MAX_ROUTES_PER_SITEMAP);
          expect(result.additionalSitemaps.size).toBe(expectedFiles);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('each split sitemap has <= 1000 routes', () => {
    const count = MAX_ROUTES_PER_SITEMAP * 2 + 500; // 2500 routes
    const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
    const result = generateSitemap(paths, baseConfig);
    
    const sitemapEntries = Array.from(result.additionalSitemaps.entries());
    for (const [, xml] of sitemapEntries) {
      const entries = parseSitemapXml(xml);
      expect(entries.length).toBeLessThanOrEqual(MAX_ROUTES_PER_SITEMAP);
    }
  });

  it('sitemap index contains all split sitemap URLs', () => {
    const count = MAX_ROUTES_PER_SITEMAP * 2 + 100;
    const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
    const result = generateSitemap(paths, baseConfig);
    
    // Parse the sitemap index
    const sitemapUrls = parseSitemapIndex(result.mainXml);
    
    expect(sitemapUrls.length).toBe(result.additionalSitemaps.size);
  });

  it('SitemapGenerator.willSplit() correctly predicts splitting', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_ROUTES_PER_SITEMAP * 2 }),
        (count) => {
          const generator = createSitemapGenerator(baseConfig);
          const paths = Array.from({ length: count }, (_, i) => `/page-${i}`);
          generator.addRoutes(paths);
          
          const willSplit = generator.willSplit();
          const result = generator.generate();
          
          expect(willSplit).toBe(result.wasSplit);
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Sitemap Indexing Properties', () => {

  it('findCandidateRoutes returns routes with shared tokens', () => {
    fc.assert(
      fc.property(
        pathSegmentArb,
        fc.array(pathSegmentArb, { minLength: 1, maxLength: 3 }),
        (sharedToken, otherTokens) => {
          // Create routes that share a token
          const routeWithShared = `/${sharedToken}/${otherTokens[0] || 'a'}`;
          const routeWithoutShared = `/completely/different/path`;
          
          const entries = pathsToEntries(
            [routeWithShared, routeWithoutShared],
            baseConfig
          );
          const index = indexRoutes(entries);
          
          // Query with the shared token
          const queryPath = `/${sharedToken}/something`;
          const candidates = findCandidateRoutes(queryPath, index);
          
          // Should include the route with shared token
          expect(candidates).toContain(routeWithShared);
        }
      ),
      FC_CONFIG
    );
  });

  it('inverted index maps tokens to correct routes', () => {
    fc.assert(
      fc.property(uniquePathsArb, (paths) => {
        const entries = pathsToEntries(paths, baseConfig);
        const index = indexRoutes(entries);
        
        // For each route, its tokens should map back to it
        for (const path of paths) {
          const tokens = index.tokenMap.get(path);
          if (tokens) {
            for (const token of tokens) {
              const routesWithToken = index.invertedIndex.get(token);
              expect(routesWithToken).toBeDefined();
              expect(routesWithToken!.has(path)).toBe(true);
            }
          }
        }
      }),
      FC_CONFIG
    );
  });
});
