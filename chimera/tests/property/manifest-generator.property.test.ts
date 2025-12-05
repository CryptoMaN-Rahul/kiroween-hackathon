/**
 * Property-Based Tests for AI Manifest Generator
 *
 * Tests ai-manifest.json content generation, intent extraction, and entity extraction.
 *
 * **Feature: ai-search-optimization, Property 13: AI Manifest Content Completeness**
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generate,
  extractIntents,
  extractEntities,
} from '@/lib/ai-search/manifest-generator';
import { ManifestConfig, ManifestRoute, PageContent } from '@/lib/ai-search/types';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random site name
const siteNameArb = fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate a random site description
const siteDescriptionArb = fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0);

// Generate a random version
const versionArb = fc.tuple(
  fc.integer({ min: 0, max: 10 }),
  fc.integer({ min: 0, max: 99 }),
  fc.integer({ min: 0, max: 99 })
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

// Generate random capabilities
const capabilitiesArb = fc.array(
  fc.constantFrom(
    'search',
    'purchase',
    'authentication',
    'content-delivery',
    'api-access',
    'analytics'
  ),
  { minLength: 1, maxLength: 5 }
);

// Generate a random ManifestConfig
const manifestConfigArb = fc.record({
  siteName: siteNameArb,
  siteDescription: siteDescriptionArb,
  version: versionArb,
  capabilities: capabilitiesArb,
});

// Generate a random URL
const urlArb = fc.webUrl();

// Generate content with purchase intent
const purchaseContentArb = fc.constantFrom(
  'Buy our products today. Add to cart and checkout.',
  'Shop our collection. Purchase now and save.',
  'Order online for fast delivery.'
);

// Generate content with contact intent
const contactContentArb = fc.constantFrom(
  'Contact our support team for help.',
  'Email us or call for assistance.',
  'Reach out to our customer service.'
);

// Generate content with learn intent
const learnContentArb = fc.constantFrom(
  'Learn how to use our platform with this guide.',
  'Tutorial: Getting started with our API.',
  'Documentation for developers.'
);

// Generate content with product entities
const productContentArb = fc.constantFrom(
  'Browse our product catalog.',
  'View all items in stock.',
  'Shop our goods collection.'
);

// Generate content with service entities
const serviceContentArb = fc.constantFrom(
  'Our platform provides enterprise solutions.',
  'Service offerings for businesses.',
  'Cloud-based solution for teams.'
);

// Generate a random PageContent
const pageContentArb = fc.record({
  url: urlArb,
  title: fc.string({ minLength: 5, maxLength: 100 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  content: fc.oneof(
    purchaseContentArb,
    contactContentArb,
    learnContentArb,
    productContentArb,
    serviceContentArb
  ),
  headings: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  statistics: fc.constant([] as PageContent['statistics']),
  lastModified: fc.date(),
});

// Generate array of pages
const pagesArb = fc.array(pageContentArb, { minLength: 1, maxLength: 5 });

// Generate a random ManifestRoute
const manifestRouteArb = fc.record({
  path: fc.constantFrom('/', '/about', '/products', '/contact', '/api'),
  description: fc.string({ minLength: 10, maxLength: 100 }),
  methods: fc.option(fc.array(fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'), { minLength: 1, maxLength: 4 })).map(m => m ?? undefined),
});

// Generate array of routes
const routesArb = fc.array(manifestRouteArb, { minLength: 1, maxLength: 5 });

// =============================================================================
// Property 13: AI Manifest Content Completeness
// =============================================================================

describe('Property 13: AI Manifest Content Completeness', () => {
  /**
   * **Feature: ai-search-optimization, Property 13: AI Manifest Content Completeness**
   * **Validates: Requirements 5.2, 5.3, 5.4**
   *
   * For any valid ManifestConfig, the generated ai-manifest.json SHALL contain
   * name, description, capabilities, routes, intents, and entities fields.
   */

  it('generate() includes name from config', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(manifest.name).toBe(config.siteName);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes description from config', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(manifest.description).toBe(config.siteDescription);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes version from config', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(manifest.version).toBe(config.version);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes capabilities from config', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(manifest.capabilities).toEqual(config.capabilities);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes routes array', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, routesArb, (config, pages, routes) => {
        const manifest = generate(config, pages, routes);
        expect(Array.isArray(manifest.routes)).toBe(true);
        expect(manifest.routes.length).toBeGreaterThan(0);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes intents array', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(Array.isArray(manifest.intents)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes entities array', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(Array.isArray(manifest.entities)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('generate() includes lastUpdated timestamp', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        expect(typeof manifest.lastUpdated).toBe('string');
        // Should be valid ISO date
        expect(() => new Date(manifest.lastUpdated)).not.toThrow();
      }),
      FC_CONFIG
    );
  });

  it('generate() produces valid JSON structure', () => {
    fc.assert(
      fc.property(manifestConfigArb, pagesArb, (config, pages) => {
        const manifest = generate(config, pages);
        
        // Should be serializable to JSON
        const json = JSON.stringify(manifest);
        const parsed = JSON.parse(json);
        
        expect(parsed.name).toBe(manifest.name);
        expect(parsed.description).toBe(manifest.description);
        expect(parsed.version).toBe(manifest.version);
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Intent Extraction Tests
// =============================================================================

describe('Intent Extraction', () => {
  it('extractIntents() detects purchase intent', () => {
    fc.assert(
      fc.property(purchaseContentArb, (content) => {
        const pages: PageContent[] = [{
          url: 'https://example.com/shop',
          title: 'Shop',
          description: 'Buy products',
          content,
          headings: [],
          statistics: [],
          lastModified: new Date(),
        }];
        
        const intents = extractIntents(pages);
        const hasPurchaseIntent = intents.some(i => i.name === 'purchase');
        expect(hasPurchaseIntent).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('extractIntents() detects contact intent', () => {
    fc.assert(
      fc.property(contactContentArb, (content) => {
        const pages: PageContent[] = [{
          url: 'https://example.com/contact',
          title: 'Contact',
          description: 'Get in touch',
          content,
          headings: [],
          statistics: [],
          lastModified: new Date(),
        }];
        
        const intents = extractIntents(pages);
        const hasContactIntent = intents.some(i => i.name === 'contact');
        expect(hasContactIntent).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('extractIntents() detects learn intent', () => {
    fc.assert(
      fc.property(learnContentArb, (content) => {
        const pages: PageContent[] = [{
          url: 'https://example.com/docs',
          title: 'Documentation',
          description: 'Learn more',
          content,
          headings: [],
          statistics: [],
          lastModified: new Date(),
        }];
        
        const intents = extractIntents(pages);
        const hasLearnIntent = intents.some(i => i.name === 'learn');
        expect(hasLearnIntent).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('extractIntents() returns intents with required fields', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const intents = extractIntents(pages);
        
        for (const intent of intents) {
          expect(typeof intent.name).toBe('string');
          expect(intent.name.length).toBeGreaterThan(0);
          expect(typeof intent.description).toBe('string');
          expect(Array.isArray(intent.examples)).toBe(true);
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Entity Extraction Tests
// =============================================================================

describe('Entity Extraction', () => {
  it('extractEntities() detects product entities', () => {
    fc.assert(
      fc.property(productContentArb, (content) => {
        const pages: PageContent[] = [{
          url: 'https://example.com/products',
          title: 'Products',
          description: 'Our products',
          content,
          headings: ['Product Catalog'],
          statistics: [],
          lastModified: new Date(),
        }];
        
        const entities = extractEntities(pages);
        const hasProductEntity = entities.some(e => e.type === 'Product');
        expect(hasProductEntity).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('extractEntities() detects service entities', () => {
    fc.assert(
      fc.property(serviceContentArb, (content) => {
        const pages: PageContent[] = [{
          url: 'https://example.com/services',
          title: 'Services',
          description: 'Our services',
          content,
          headings: ['Service Offerings'],
          statistics: [],
          lastModified: new Date(),
        }];
        
        const entities = extractEntities(pages);
        const hasServiceEntity = entities.some(e => e.type === 'Service');
        expect(hasServiceEntity).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('extractEntities() returns entities with required fields', () => {
    fc.assert(
      fc.property(pagesArb, (pages) => {
        const entities = extractEntities(pages);
        
        for (const entity of entities) {
          expect(typeof entity.name).toBe('string');
          expect(typeof entity.type).toBe('string');
          expect(typeof entity.description).toBe('string');
        }
      }),
      FC_CONFIG
    );
  });
});
