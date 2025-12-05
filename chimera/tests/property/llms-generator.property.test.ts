/**
 * Property-Based Tests for llms.txt Generator
 *
 * Tests llms.txt content generation, quick facts extraction, and route formatting.
 *
 * **Feature: ai-search-optimization, Property 1: llms.txt Content Completeness**
 * **Validates: Requirements 1.2, 1.3, 1.4**
 *
 * **Feature: ai-search-optimization, Property 2: Quick Facts Extraction**
 * **Validates: Requirements 1.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generate,
  extractQuickFacts,
  formatRoutes,
  formatApiEndpoints,
  DEFAULT_MAX_QUICK_FACTS,
} from '@/lib/ai-search/llms-generator';
import { LLMsConfig, RouteEntry, ApiEntry, PageContent } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random site name
const siteNameArb = fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate a random site description
const siteDescriptionArb = fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0);

// Generate a random base URL
const baseUrlArb = fc.webUrl();

// Generate a random LLMsConfig
const llmsConfigArb = fc.record({
  siteName: siteNameArb,
  siteDescription: siteDescriptionArb,
  baseUrl: baseUrlArb,
  includeApiEndpoints: fc.boolean(),
  maxQuickFacts: fc.integer({ min: 1, max: 20 }),
});

// Generate a random route path
const routePathArb = fc.constantFrom(
  '/',
  '/about',
  '/products',
  '/contact',
  '/pricing',
  '/docs',
  '/api',
  '/blog'
);

// Generate a random route description
const routeDescriptionArb = fc.constantFrom(
  'Home page with main content',
  'About us and company information',
  'Product catalog and listings',
  'Contact form and support',
  'Pricing plans and options',
  'Documentation and guides',
  'API reference',
  'Blog posts and articles'
);

// Generate a random RouteEntry
const routeEntryArb = fc.record({
  path: routePathArb,
  description: routeDescriptionArb,
});

// Generate array of routes
const routesArb = fc.array(routeEntryArb, { minLength: 1, maxLength: 10 });

// Generate a random HTTP method
const httpMethodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH');

// Generate a random API path
const apiPathArb = fc.constantFrom(
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/auth',
  '/api/search'
);

// Generate a random API description
const apiDescriptionArb = fc.constantFrom(
  'Returns user data',
  'Lists all products',
  'Manages orders',
  'Authentication endpoint',
  'Search functionality'
);

// Generate a random ApiEntry
const apiEntryArb = fc.record({
  method: httpMethodArb,
  path: apiPathArb,
  description: apiDescriptionArb,
});

// Generate array of API endpoints
const apiEndpointsArb = fc.array(apiEntryArb, { minLength: 1, maxLength: 5 });

// Generate content with statistics
const contentWithStatsArb = fc.constantFrom(
  'Our platform achieved 95% customer satisfaction. Revenue grew by $2 million.',
  'Users reported 3x faster performance. We serve 5 million customers.',
  'Sales increased by 40% year over year. Customer retention reached 92%.',
  'The API handles 50,000 requests per second. Latency decreased by 60%.'
);

// Generate content without statistics
const contentWithoutStatsArb = fc.constantFrom(
  'Our team is dedicated to excellence.',
  'We believe in customer satisfaction.',
  'Quality is our top priority.'
);

// Generate a random PageContent
const pageContentArb = fc.record({
  url: baseUrlArb,
  title: fc.string({ minLength: 5, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  content: fc.oneof(contentWithStatsArb, contentWithoutStatsArb),
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate PageContent with statistics
const pageWithStatsArb = fc.record({
  url: baseUrlArb,
  title: fc.string({ minLength: 5, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  content: contentWithStatsArb,
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate array of pages
const pagesArb = fc.array(pageContentArb, { minLength: 1, maxLength: 5 });

// Generate array of pages with statistics
const pagesWithStatsArb = fc.array(pageWithStatsArb, { minLength: 1, maxLength: 5 });

// =============================================================================
// Property 1: llms.txt Content Completeness
// =============================================================================

describe('Property 1: llms.txt Content Completeness', () => {
  /**
   * **Feature: ai-search-optimization, Property 1: llms.txt Content Completeness**
   * **Validates: Requirements 1.2, 1.3, 1.4**
   *
   * For any valid LLMsConfig with site name, description, and routes,
   * the generated llms.txt output SHALL contain the site name, site description,
   * all provided routes with descriptions, and all provided API endpoints.
   */

  it('generate() includes site name in output', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        expect(output).toContain(config.siteName);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes site description in output', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        expect(output).toContain(config.siteDescription);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes all routes in output', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        
        for (const route of routes) {
          expect(output).toContain(route.path);
          expect(output).toContain(route.description);
        }
      }),
      FC_CONFIG
    );
  });

  it('generate() includes API endpoints when includeApiEndpoints is true', () => {
    fc.assert(
      fc.property(
        llmsConfigArb.map(c => ({ ...c, includeApiEndpoints: true })),
        pagesArb,
        routesArb,
        apiEndpointsArb,
        (config, pages, routes, apiEndpoints) => {
          const output = generate(config, pages, routes, apiEndpoints);
          
          for (const endpoint of apiEndpoints) {
            expect(output).toContain(endpoint.method);
            expect(output).toContain(endpoint.path);
            expect(output).toContain(endpoint.description);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('generate() excludes API endpoints when includeApiEndpoints is false', () => {
    fc.assert(
      fc.property(
        llmsConfigArb.map(c => ({ ...c, includeApiEndpoints: false })),
        pagesArb,
        routesArb,
        apiEndpointsArb,
        (config, pages, routes, apiEndpoints) => {
          const output = generate(config, pages, routes, apiEndpoints);
          
          // Should not contain "API Endpoints" section
          expect(output).not.toContain('## API Endpoints');
        }
      ),
      FC_CONFIG
    );
  });

  it('generate() includes header with correct format', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        
        expect(output).toContain('# llms.txt - AI Agent Manifest for');
        expect(output).toContain('>');
      }),
      FC_CONFIG
    );
  });

  it('generate() includes Last Updated timestamp', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        expect(output).toContain('## Last Updated:');
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 2: Quick Facts Extraction
// =============================================================================

describe('Property 2: Quick Facts Extraction', () => {
  /**
   * **Feature: ai-search-optimization, Property 2: Quick Facts Extraction**
   * **Validates: Requirements 1.5**
   *
   * For any content containing sentences with statistics (numbers, percentages,
   * comparisons), the LLMs_Generator SHALL extract those sentences as quick facts
   * in the output.
   */

  it('extractQuickFacts() extracts sentences with statistics', () => {
    fc.assert(
      fc.property(pagesWithStatsArb, (pages) => {
        const facts = extractQuickFacts(pages);
        
        // Should extract at least one fact from pages with statistics
        expect(facts.length).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });

  it('extractQuickFacts() respects maxFacts limit', () => {
    fc.assert(
      fc.property(
        pagesWithStatsArb,
        fc.integer({ min: 1, max: 10 }),
        (pages, maxFacts) => {
          const facts = extractQuickFacts(pages, maxFacts);
          expect(facts.length).toBeLessThanOrEqual(maxFacts);
        }
      ),
      FC_CONFIG
    );
  });

  it('extractQuickFacts() returns empty array for content without statistics', () => {
    const pagesWithoutStats: PageContent[] = [{
      url: 'https://example.com',
      title: 'Test',
      description: 'Test page',
      content: 'Our team is dedicated to excellence. We believe in quality.',
      headings: [],
      statistics: [],
      lastModified: new Date(),
    }];
    
    const facts = extractQuickFacts(pagesWithoutStats);
    expect(facts.length).toBe(0);
  });

  it('generate() includes quick facts in output when available', () => {
    fc.assert(
      fc.property(llmsConfigArb, pagesWithStatsArb, routesArb, (config, pages, routes) => {
        const output = generate(config, pages, routes);
        const facts = extractQuickFacts(pages, config.maxQuickFacts);
        
        if (facts.length > 0) {
          expect(output).toContain('## Quick Facts');
          // At least one fact should be in the output
          const hasAtLeastOneFact = facts.some(fact => output.includes(fact));
          expect(hasAtLeastOneFact).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });

  it('DEFAULT_MAX_QUICK_FACTS is 10', () => {
    expect(DEFAULT_MAX_QUICK_FACTS).toBe(10);
  });
});

// =============================================================================
// Additional Tests for Formatting
// =============================================================================

describe('Route and API Formatting', () => {
  it('formatRoutes() formats routes correctly', () => {
    fc.assert(
      fc.property(routesArb, (routes) => {
        const formatted = formatRoutes(routes);
        
        for (const route of routes) {
          expect(formatted).toContain(route.path);
          expect(formatted).toContain(route.description);
          expect(formatted).toContain(' - ');
        }
      }),
      FC_CONFIG
    );
  });

  it('formatRoutes() returns empty string for empty routes', () => {
    const formatted = formatRoutes([]);
    expect(formatted).toBe('');
  });

  it('formatApiEndpoints() formats endpoints correctly', () => {
    fc.assert(
      fc.property(apiEndpointsArb, (endpoints) => {
        const formatted = formatApiEndpoints(endpoints);
        
        for (const endpoint of endpoints) {
          expect(formatted).toContain(endpoint.method);
          expect(formatted).toContain(endpoint.path);
          expect(formatted).toContain(endpoint.description);
        }
      }),
      FC_CONFIG
    );
  });

  it('formatApiEndpoints() returns empty string for empty endpoints', () => {
    const formatted = formatApiEndpoints([]);
    expect(formatted).toBe('');
  });
});
