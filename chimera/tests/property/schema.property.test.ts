/**
 * Property-Based Tests for JSON-LD Schema Generator
 * 
 * Tests correctness properties for schema generation and validation.
 * 
 * @module schema.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectEntities,
  generateSchema,
  validateSchema,
  serialize,
  parse,
  generateFromContent
} from '../../src/lib/schema-generator';
import type { DetectedEntity, GeneratedSchema, SchemaEntityType } from '../../src/types';

/**
 * Generators for schema testing
 */

// Generate product content
const productContentGen = fc.record({
  name: fc.string({ minLength: 3, maxLength: 50 }),
  price: fc.integer({ min: 1, max: 999999 }).map(p => p / 100), // Price in cents converted to dollars
  inStock: fc.boolean()
}).map(({ name, price, inStock }) => 
  `# ${name}\n\nBuy now for $${price.toFixed(2)}!\n\n${inStock ? 'In stock' : 'Out of stock'}\n\nAdd to cart`
);

// Generate article content
const articleContentGen = fc.record({
  title: fc.string({ minLength: 5, maxLength: 100 }),
  author: fc.tuple(
    fc.constantFrom('John', 'Jane', 'Bob', 'Alice'),
    fc.constantFrom('Smith', 'Doe', 'Johnson', 'Williams')
  ),
  year: fc.integer({ min: 2020, max: 2025 })
}).map(({ title, author, year }) =>
  `# ${title}\n\nby ${author[0]} ${author[1]}\n\nPublished on January 15, ${year}\n\n5 minutes read\n\nThis is an article about...`
);

// Generate FAQ content
const faqContentGen = fc.array(
  fc.record({
    question: fc.string({ minLength: 10, maxLength: 100 }),
    answer: fc.string({ minLength: 20, maxLength: 200 })
  }),
  { minLength: 1, maxLength: 5 }
).map(qas => 
  `# Frequently Asked Questions\n\n${qas.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`
);

// Generate valid detected entity
const detectedEntityGen = fc.record({
  type: fc.constantFrom('Product', 'Article', 'Organization', 'Person', 'FAQ') as fc.Arbitrary<SchemaEntityType>,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
  confidence: fc.integer({ min: 30, max: 100 }).map(c => c / 100) // 0.3 to 1.0
}).map(({ type, name, description, confidence }) => ({
  type,
  name: name || type,
  description: description ?? undefined,
  properties: {},
  confidence
}));

// Generate valid schema
const validSchemaGen = fc.array(detectedEntityGen, { minLength: 1, maxLength: 5 })
  .map(entities => generateSchema(entities, 'https://example.com/page'));

describe('Schema Generator Property Tests', () => {
  /**
   * **Feature: chimera-ai-first-edge, Property 12: Schema Entity Detection**
   * **Validates: Requirements 4.1**
   * 
   * For any content containing identifiable entities (Product, Article, Organization, Person, FAQ),
   * the Schema Generator SHALL detect and correctly classify each entity type present.
   */
  describe('Property 12: Schema Entity Detection', () => {
    it('product content is detected as Product', () => {
      fc.assert(
        fc.property(productContentGen, (content) => {
          const entities = detectEntities(content);
          const hasProduct = entities.some(e => e.type === 'Product');
          expect(hasProduct).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('article content is detected as Article', () => {
      fc.assert(
        fc.property(articleContentGen, (content) => {
          const entities = detectEntities(content);
          const hasArticle = entities.some(e => e.type === 'Article');
          expect(hasArticle).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('FAQ content is detected as FAQ', () => {
      fc.assert(
        fc.property(faqContentGen, (content) => {
          const entities = detectEntities(content);
          const hasFAQ = entities.some(e => e.type === 'FAQ');
          expect(hasFAQ).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('detected entities have valid confidence scores', () => {
      fc.assert(
        fc.property(
          fc.oneof(productContentGen, articleContentGen, faqContentGen),
          (content) => {
            const entities = detectEntities(content);
            for (const entity of entities) {
              expect(entity.confidence).toBeGreaterThanOrEqual(0);
              expect(entity.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('entities are sorted by confidence descending', () => {
      fc.assert(
        fc.property(
          fc.oneof(productContentGen, articleContentGen, faqContentGen),
          (content) => {
            const entities = detectEntities(content);
            for (let i = 1; i < entities.length; i++) {
              expect(entities[i].confidence).toBeLessThanOrEqual(entities[i - 1].confidence);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: chimera-ai-first-edge, Property 13: Schema Required Properties**
   * **Validates: Requirements 4.3**
   * 
   * For any detected entity type, the generated JSON-LD SHALL include all required
   * properties as defined by Schema.org for that type.
   */
  describe('Property 13: Schema Required Properties', () => {
    it('Product schema has name and description', () => {
      fc.assert(
        fc.property(productContentGen, (content) => {
          const schema = generateFromContent(content, 'https://example.com/product');
          const product = schema['@graph'].find(e => e['@type'] === 'Product');
          
          if (product) {
            expect(product.name).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Article schema has headline', () => {
      fc.assert(
        fc.property(articleContentGen, (content) => {
          const schema = generateFromContent(content, 'https://example.com/article');
          const article = schema['@graph'].find(e => e['@type'] === 'Article');
          
          if (article) {
            expect(article.headline).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('all entities have @type', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          for (const entity of schema['@graph']) {
            expect(entity['@type']).toBeDefined();
            expect(typeof entity['@type']).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('all entities have name', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          for (const entity of schema['@graph']) {
            expect(entity.name).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: chimera-ai-first-edge, Property 11: JSON-LD Round-Trip Consistency**
   * **Validates: Requirements 4.6**
   * 
   * For any valid GeneratedSchema object, serializing to JSON-LD string and parsing back
   * SHALL produce an equivalent object.
   */
  describe('Property 11: JSON-LD Round-Trip Consistency', () => {
    it('serialize then parse produces equivalent schema', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          const serialized = serialize(schema);
          const parsed = parse(serialized);
          
          expect(parsed['@context']).toBe(schema['@context']);
          expect(parsed['@graph'].length).toBe(schema['@graph'].length);
          
          // Deep equality check
          expect(JSON.stringify(parsed)).toBe(JSON.stringify(schema));
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output is valid JSON', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          const serialized = serialize(schema);
          expect(() => JSON.parse(serialized)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output contains @context', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          const serialized = serialize(schema);
          expect(serialized).toContain('"@context"');
          expect(serialized).toContain('https://schema.org');
        }),
        { numRuns: 100 }
      );
    });

    it('serialized output contains @graph', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          const serialized = serialize(schema);
          expect(serialized).toContain('"@graph"');
        }),
        { numRuns: 100 }
      );
    });

    it('multiple round trips produce same result', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          const trip1 = parse(serialize(schema));
          const trip2 = parse(serialize(trip1));
          const trip3 = parse(serialize(trip2));
          
          expect(JSON.stringify(trip1)).toBe(JSON.stringify(trip2));
          expect(JSON.stringify(trip2)).toBe(JSON.stringify(trip3));
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Schema validation tests
   */
  describe('Schema Validation', () => {
    it('generated schemas have valid structure', () => {
      fc.assert(
        fc.property(validSchemaGen, (schema) => {
          // Check basic structure is valid
          expect(schema['@context']).toBe('https://schema.org');
          expect(Array.isArray(schema['@graph'])).toBe(true);
          expect(schema['@graph'].length).toBeGreaterThan(0);
          
          // All entities have @type
          for (const entity of schema['@graph']) {
            expect(entity['@type']).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('schema with wrong context fails validation', () => {
      const badSchema: GeneratedSchema = {
        '@context': 'https://wrong.org' as 'https://schema.org',
        '@graph': []
      };
      
      const result = validateSchema(badSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property === '@context')).toBe(true);
    });

    it('schema with empty graph fails validation', () => {
      const emptySchema: GeneratedSchema = {
        '@context': 'https://schema.org',
        '@graph': []
      };
      
      const result = validateSchema(emptySchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.property === '@graph')).toBe(true);
    });
  });
});


/**
 * **Feature: chimera-geo-sdk-v2, Property 26: E-E-A-T Signal Inclusion**
 * **Validates: Requirements 10.2**
 * 
 * For any content with author information and dates provided,
 * the generated schema SHALL include author, datePublished, and dateModified fields.
 */
import {
  addEEATSignals,
  createPersonSchema,
  generateHowToSchema,
  extractHowToSteps,
  validateRoundTrip,
  roundTrip,
  EEATSignals
} from '../../src/lib/schema-generator';

describe('Property 26: E-E-A-T Signal Inclusion', () => {
  // Generator for valid ISO date strings
  const isoDateGen = fc.tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  ).map(([year, month, day]) => 
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

  // Generator for E-E-A-T signals
  const eeatSignalsGen = fc.record({
    author: fc.option(fc.record({
      name: fc.string({ minLength: 2, maxLength: 50 }),
      credentials: fc.option(fc.array(fc.string({ minLength: 2, maxLength: 30 }), { maxLength: 3 })),
      linkedInUrl: fc.option(fc.webUrl()),
      sameAs: fc.option(fc.array(fc.webUrl(), { maxLength: 3 }))
    })),
    datePublished: fc.option(isoDateGen),
    dateModified: fc.option(isoDateGen),
    publisher: fc.option(fc.record({
      name: fc.string({ minLength: 2, maxLength: 50 }),
      url: fc.webUrl(),
      logo: fc.option(fc.webUrl())
    }))
  });

  it('adds author to Article entities when provided', () => {
    fc.assert(
      fc.property(articleContentGen, eeatSignalsGen, (content, signals) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        
        if (signals.author) {
          const enhanced = addEEATSignals(baseSchema, signals as EEATSignals);
          const article = enhanced['@graph'].find(e => e['@type'] === 'Article');
          
          if (article) {
            expect(article.author).toBeDefined();
            expect((article.author as { name: string }).name).toBe(signals.author.name);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('adds datePublished when provided', () => {
    fc.assert(
      fc.property(articleContentGen, eeatSignalsGen, (content, signals) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        
        if (signals.datePublished) {
          const enhanced = addEEATSignals(baseSchema, signals as EEATSignals);
          const article = enhanced['@graph'].find(e => e['@type'] === 'Article');
          
          if (article) {
            expect(article.datePublished).toBe(signals.datePublished);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('adds dateModified when provided', () => {
    fc.assert(
      fc.property(articleContentGen, eeatSignalsGen, (content, signals) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        
        if (signals.dateModified) {
          const enhanced = addEEATSignals(baseSchema, signals as EEATSignals);
          const article = enhanced['@graph'].find(e => e['@type'] === 'Article');
          
          if (article) {
            expect(article.dateModified).toBe(signals.dateModified);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('adds publisher when provided', () => {
    fc.assert(
      fc.property(articleContentGen, eeatSignalsGen, (content, signals) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        
        if (signals.publisher) {
          const enhanced = addEEATSignals(baseSchema, signals as EEATSignals);
          const article = enhanced['@graph'].find(e => e['@type'] === 'Article');
          
          if (article && article.publisher) {
            expect((article.publisher as { name: string }).name).toBe(signals.publisher.name);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('does not mutate original schema', () => {
    fc.assert(
      fc.property(articleContentGen, eeatSignalsGen, (content, signals) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        const originalJson = JSON.stringify(baseSchema);
        
        addEEATSignals(baseSchema, signals as EEATSignals);
        
        // Original should be unchanged
        expect(JSON.stringify(baseSchema)).toBe(originalJson);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 27: Authorship Schema SameAs Integration**
 * **Validates: Requirements 10.3**
 * 
 * For any Person entity with LinkedIn URL provided,
 * the generated schema SHALL include the LinkedIn URL in the sameAs array.
 */
describe('Property 27: Authorship Schema SameAs Integration', () => {
  it('includes LinkedIn URL in sameAs when provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.webUrl(),
        (name, linkedInUrl) => {
          const person = createPersonSchema(name, { linkedInUrl });
          
          expect(person.sameAs).toBeDefined();
          expect(Array.isArray(person.sameAs)).toBe(true);
          expect(person.sameAs).toContain(linkedInUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes multiple sameAs URLs when provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.webUrl(),
        fc.webUrl(),
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 3 }),
        (name, linkedInUrl, twitterUrl, otherUrls) => {
          const person = createPersonSchema(name, {
            linkedInUrl,
            twitterUrl,
            sameAs: otherUrls
          });
          
          expect(person.sameAs).toBeDefined();
          expect(person.sameAs).toContain(linkedInUrl);
          expect(person.sameAs).toContain(twitterUrl);
          for (const url of otherUrls) {
            expect(person.sameAs).toContain(url);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes credentials as jobTitle', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.array(fc.string({ minLength: 2, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
        (name, credentials) => {
          const person = createPersonSchema(name, { credentials });
          
          expect(person.jobTitle).toBe(credentials[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Person schema always has @type and name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.option(fc.webUrl()),
        (name, linkedInUrl) => {
          const person = createPersonSchema(name, linkedInUrl ? { linkedInUrl } : undefined);
          
          expect(person['@type']).toBe('Person');
          expect(person.name).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 25: Entity Type Detection Accuracy**
 * **Validates: Requirements 10.1**
 * 
 * For any content with clear entity signals (step-by-step content for HowTo),
 * the SchemaGenerator SHALL detect the correct primary entity type.
 */
describe('Property 25: Entity Type Detection Accuracy (HowTo)', () => {
  // Generator for HowTo content
  const howToContentGen = fc.array(
    fc.string({ minLength: 10, maxLength: 100 }),
    { minLength: 2, maxLength: 8 }
  ).map(steps => 
    `# How to Do Something\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
  );

  it('extracts steps from numbered content', () => {
    fc.assert(
      fc.property(howToContentGen, (content) => {
        const steps = extractHowToSteps(content);
        expect(steps.length).toBeGreaterThan(0);
        
        for (const step of steps) {
          expect(step.name).toBeDefined();
          expect(step.text).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('generates valid HowTo schema', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        howToContentGen,
        (title, content) => {
          const howTo = generateHowToSchema(title, content);
          
          expect(howTo['@type']).toBe('HowTo');
          expect(howTo.name).toBe(title);
          expect(Array.isArray(howTo.step)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('HowTo steps have correct structure', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        howToContentGen,
        (title, content) => {
          const howTo = generateHowToSchema(title, content);
          const steps = howTo.step as Array<{ '@type': string; position: number; name: string; text: string }>;
          
          for (let i = 0; i < steps.length; i++) {
            expect(steps[i]['@type']).toBe('HowToStep');
            expect(steps[i].position).toBe(i + 1);
            expect(steps[i].name).toBeDefined();
            expect(steps[i].text).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes optional fields when provided', () => {
    const howTo = generateHowToSchema('Test', '1. Step one\n2. Step two', {
      description: 'A test guide',
      totalTime: 'PT30M',
      estimatedCost: { value: 50, currency: 'USD' },
      supply: ['Item 1', 'Item 2'],
      tool: ['Tool 1']
    });
    
    expect(howTo.description).toBe('A test guide');
    expect(howTo.totalTime).toBe('PT30M');
    expect(howTo.estimatedCost).toBeDefined();
    expect(howTo.supply).toBeDefined();
    expect(howTo.tool).toBeDefined();
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 28: Schema Round-Trip Consistency**
 * **Validates: Requirements 10.4**
 * 
 * For any valid GeneratedSchema object, serializing to JSON-LD string
 * and parsing back SHALL produce an object deeply equal to the original.
 */
describe('Property 28: Schema Round-Trip Consistency', () => {
  it('validateRoundTrip returns true for valid schemas', () => {
    fc.assert(
      fc.property(validSchemaGen, (schema) => {
        expect(validateRoundTrip(schema)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('roundTrip returns matching original and parsed', () => {
    fc.assert(
      fc.property(validSchemaGen, (schema) => {
        const result = roundTrip(schema);
        
        expect(result.isEqual).toBe(true);
        expect(JSON.stringify(result.original)).toBe(JSON.stringify(result.parsed));
      }),
      { numRuns: 100 }
    );
  });

  it('roundTrip serialized output is valid JSON-LD', () => {
    fc.assert(
      fc.property(validSchemaGen, (schema) => {
        const result = roundTrip(schema);
        
        expect(result.serialized).toContain('"@context"');
        expect(result.serialized).toContain('"@graph"');
        expect(() => JSON.parse(result.serialized)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('enhanced schemas also round-trip correctly', () => {
    fc.assert(
      fc.property(articleContentGen, (content) => {
        const baseSchema = generateFromContent(content, 'https://example.com/article');
        const enhanced = addEEATSignals(baseSchema, {
          author: { name: 'Test Author', linkedInUrl: 'https://linkedin.com/in/test' },
          datePublished: '2024-01-15',
          dateModified: '2024-06-20'
        });
        
        expect(validateRoundTrip(enhanced)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
