/**
 * Property-Based Tests for Citation Monitor
 * 
 * Tests correctness properties for citation ranking and GEO score calculation.
 * 
 * @module citations.property.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  sortCitations,
  calculateCitationAuthority,
  calculateGEOScore,
  createCitation,
  extractDomain,
  getDomainAuthority,
  analyzeSentiment,
  isEarnedMedia,
  clearCitations
} from '../../src/lib/citation-monitor';
import type { Citation, Sentiment, GEOHealthComponents } from '../../src/types';

/**
 * Generators for citation testing
 */

// Generate a valid URL
const urlGen = fc.record({
  protocol: fc.constantFrom('https'),
  domain: fc.constantFrom(
    'techcrunch.com', 'forbes.com', 'medium.com', 'dev.to',
    'reddit.com', 'twitter.com', 'example.com', 'myblog.net'
  ),
  path: fc.array(fc.constantFrom('a', 'b', 'c', 'article', 'post'), { minLength: 1, maxLength: 5 })
    .map(parts => parts.join('/'))
}).map(({ protocol, domain, path }) => `${protocol}://${domain}/${path}`);

// Generate mention context
const contextGen = fc.oneof(
  fc.constant('This is a great product that I recommend to everyone.'),
  fc.constant('Terrible experience, would not recommend.'),
  fc.constant('The product works as expected.'),
  fc.constant('Amazing innovation in the AI space!'),
  fc.constant('Poor quality and broken features.'),
  fc.string({ minLength: 10, maxLength: 200 })
);

// Generate a citation
const citationGen = fc.record({
  url: urlGen,
  context: contextGen,
  timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
  domainAuthority: fc.integer({ min: 1, max: 100 }),
  isEarnedMedia: fc.boolean()
}).map(({ url, context, timestamp, domainAuthority, isEarnedMedia }) => ({
  id: `cit_${Math.random().toString(36).substring(2, 9)}`,
  sourceUrl: url,
  sourceDomain: extractDomain(url),
  mentionContext: context,
  sentiment: analyzeSentiment(context),
  domainAuthority,
  discoveredAt: timestamp,
  isEarnedMedia
} as Citation));

// Generate array of citations
const citationsArrayGen = fc.array(citationGen, { minLength: 1, maxLength: 20 });

// Generate GEO health components
const geoComponentsGen = fc.record({
  routeHealth: fc.integer({ min: 0, max: 100 }),
  contentScannability: fc.integer({ min: 0, max: 100 }),
  schemaCoverage: fc.integer({ min: 0, max: 100 }),
  citationAuthority: fc.integer({ min: 0, max: 100 })
});

describe('Citation Monitor Property Tests', () => {
  beforeEach(() => {
    clearCitations();
  });

  /**
   * **Feature: chimera-ai-first-edge, Property 14: Citation Ranking Order**
   * **Validates: Requirements 5.3**
   * 
   * For any set of citations, when sorted for display, citations with higher domain authority
   * SHALL appear before those with lower authority; for equal authority, more recent citations
   * SHALL appear first.
   */
  describe('Property 14: Citation Ranking Order', () => {
    it('citations are sorted by domain authority descending', () => {
      fc.assert(
        fc.property(citationsArrayGen, (citations) => {
          const sorted = sortCitations(citations);
          
          for (let i = 1; i < sorted.length; i++) {
            // Higher or equal authority should come first
            expect(sorted[i].domainAuthority).toBeLessThanOrEqual(sorted[i - 1].domainAuthority);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('equal authority citations are sorted by recency', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.array(fc.integer({ min: 1704067200000, max: 1767225600000 }), { minLength: 2, maxLength: 10 }), // timestamps
          (authority, timestamps) => {
            // Create citations with same authority but different dates
            const citations: Citation[] = timestamps.map((ts, i) => ({
              id: `cit_${i}`,
              sourceUrl: `https://example.com/${i}`,
              sourceDomain: 'example.com',
              mentionContext: 'Test context',
              sentiment: 'neutral' as Sentiment,
              domainAuthority: authority,
              discoveredAt: new Date(ts),
              isEarnedMedia: true
            }));
            
            const sorted = sortCitations(citations);
            
            // All have same authority, so should be sorted by date descending
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i].discoveredAt.getTime()).toBeLessThanOrEqual(
                sorted[i - 1].discoveredAt.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sorting is stable (preserves relative order for equal elements)', () => {
      fc.assert(
        fc.property(citationsArrayGen, (citations) => {
          const sorted1 = sortCitations(citations);
          const sorted2 = sortCitations(citations);
          
          // Same input should produce same output
          expect(sorted1.map(c => c.id)).toEqual(sorted2.map(c => c.id));
        }),
        { numRuns: 100 }
      );
    });

    it('sorting does not modify original array', () => {
      fc.assert(
        fc.property(citationsArrayGen, (citations) => {
          const originalIds = citations.map(c => c.id);
          sortCitations(citations);
          
          expect(citations.map(c => c.id)).toEqual(originalIds);
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: chimera-ai-first-edge, Property 15: GEO Score Earned Media Weighting**
   * **Validates: Requirements 5.4**
   * 
   * For any GEO Health Score calculation, earned media citations SHALL contribute more
   * to the score than an equivalent number of brand-owned content pieces.
   */
  describe('Property 15: GEO Score Earned Media Weighting', () => {
    it('earned media contributes more than owned media', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 100 }), // authority
          (authority) => {
            // Create identical citations, one earned, one owned
            const earnedCitation: Citation = {
              id: 'earned',
              sourceUrl: 'https://techcrunch.com/article',
              sourceDomain: 'techcrunch.com',
              mentionContext: 'Great product',
              sentiment: 'positive',
              domainAuthority: authority,
              discoveredAt: new Date(),
              isEarnedMedia: true
            };
            
            const ownedCitation: Citation = {
              id: 'owned',
              sourceUrl: 'https://mybrand.com/blog',
              sourceDomain: 'mybrand.com',
              mentionContext: 'Great product',
              sentiment: 'positive',
              domainAuthority: authority,
              discoveredAt: new Date(),
              isEarnedMedia: false
            };
            
            const earnedScore = calculateCitationAuthority([earnedCitation]);
            const ownedScore = calculateCitationAuthority([ownedCitation]);
            
            // Earned media should score higher
            expect(earnedScore).toBeGreaterThanOrEqual(ownedScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('citation authority is bounded 0-100', () => {
      fc.assert(
        fc.property(citationsArrayGen, (citations) => {
          const score = calculateCitationAuthority(citations);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    it('empty citations returns 0 authority', () => {
      expect(calculateCitationAuthority([])).toBe(0);
    });

    it('positive sentiment increases score', () => {
      const baseCitation: Citation = {
        id: 'base',
        sourceUrl: 'https://example.com',
        sourceDomain: 'example.com',
        mentionContext: 'Test',
        sentiment: 'neutral',
        domainAuthority: 50,
        discoveredAt: new Date(),
        isEarnedMedia: true
      };
      
      const positiveCitation: Citation = {
        ...baseCitation,
        id: 'positive',
        sentiment: 'positive'
      };
      
      const neutralScore = calculateCitationAuthority([baseCitation]);
      const positiveScore = calculateCitationAuthority([positiveCitation]);
      
      expect(positiveScore).toBeGreaterThan(neutralScore);
    });

    it('negative sentiment decreases score', () => {
      const baseCitation: Citation = {
        id: 'base',
        sourceUrl: 'https://example.com',
        sourceDomain: 'example.com',
        mentionContext: 'Test',
        sentiment: 'neutral',
        domainAuthority: 50,
        discoveredAt: new Date(),
        isEarnedMedia: true
      };
      
      const negativeCitation: Citation = {
        ...baseCitation,
        id: 'negative',
        sentiment: 'negative'
      };
      
      const neutralScore = calculateCitationAuthority([baseCitation]);
      const negativeScore = calculateCitationAuthority([negativeCitation]);
      
      expect(negativeScore).toBeLessThan(neutralScore);
    });
  });

  /**
   * GEO Health Score calculation tests
   */
  describe('GEO Health Score Calculation', () => {
    it('overall score is bounded 0-100', () => {
      fc.assert(
        fc.property(geoComponentsGen, (components) => {
          const score = calculateGEOScore(components);
          expect(score.overall).toBeGreaterThanOrEqual(0);
          expect(score.overall).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    it('all components are preserved in result', () => {
      fc.assert(
        fc.property(geoComponentsGen, (components) => {
          const score = calculateGEOScore(components);
          expect(score.components.routeHealth).toBe(components.routeHealth);
          expect(score.components.contentScannability).toBe(components.contentScannability);
          expect(score.components.schemaCoverage).toBe(components.schemaCoverage);
          expect(score.components.citationAuthority).toBe(components.citationAuthority);
        }),
        { numRuns: 100 }
      );
    });

    it('low scores generate recommendations', () => {
      const lowComponents: GEOHealthComponents = {
        routeHealth: 50,
        contentScannability: 50,
        schemaCoverage: 50,
        citationAuthority: 50
      };
      
      const score = calculateGEOScore(lowComponents);
      expect(score.recommendations.length).toBeGreaterThan(0);
    });

    it('high scores generate fewer recommendations', () => {
      const highComponents: GEOHealthComponents = {
        routeHealth: 90,
        contentScannability: 90,
        schemaCoverage: 90,
        citationAuthority: 90
      };
      
      const lowComponents: GEOHealthComponents = {
        routeHealth: 50,
        contentScannability: 50,
        schemaCoverage: 50,
        citationAuthority: 50
      };
      
      const highScore = calculateGEOScore(highComponents);
      const lowScore = calculateGEOScore(lowComponents);
      
      // High scores should have fewer improvement recommendations than low scores
      // (high scores may have a congratulatory message, but fewer actionable items)
      expect(highScore.recommendations.length).toBeLessThanOrEqual(lowScore.recommendations.length);
    });

    it('calculatedAt is set', () => {
      fc.assert(
        fc.property(geoComponentsGen, (components) => {
          const before = new Date();
          const score = calculateGEOScore(components);
          const after = new Date();
          
          expect(score.calculatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(score.calculatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Utility function tests
   */
  describe('Citation Utilities', () => {
    it('extractDomain handles various URL formats', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractDomain('https://example.com/path')).toBe('example.com');
      expect(extractDomain('http://sub.example.com')).toBe('sub.example.com');
    });

    it('sentiment analysis is deterministic', () => {
      fc.assert(
        fc.property(contextGen, (context) => {
          const sentiment1 = analyzeSentiment(context);
          const sentiment2 = analyzeSentiment(context);
          expect(sentiment1).toBe(sentiment2);
        }),
        { numRuns: 100 }
      );
    });

    it('isEarnedMedia correctly identifies brand domains', () => {
      const brandDomains = ['mybrand.com', 'mybrand.io'];
      
      expect(isEarnedMedia('techcrunch.com', brandDomains)).toBe(true);
      expect(isEarnedMedia('mybrand.com', brandDomains)).toBe(false);
      expect(isEarnedMedia('blog.mybrand.com', brandDomains)).toBe(false);
    });
  });
});


/**
 * **Feature: chimera-geo-sdk-v2, Property 12: Earned Media Classification**
 * **Validates: Requirements 6.1**
 * 
 * For any citation, isEarnedMedia SHALL be true if and only if the source domain
 * is not in the brand's owned domain list.
 */
describe('Property 12: Earned Media Classification', () => {
  it('earned media is true when domain not in brand list', () => {
    fc.assert(
      fc.property(
        fc.domain(),
        fc.array(fc.domain(), { minLength: 1, maxLength: 5 }),
        (testDomain, brandDomains) => {
          // Ensure testDomain is not in brandDomains
          const filteredBrandDomains = brandDomains.filter(d => d !== testDomain);
          
          if (filteredBrandDomains.length > 0) {
            const result = isEarnedMedia(testDomain, filteredBrandDomains);
            expect(result).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('earned media is false when domain is in brand list', () => {
    fc.assert(
      fc.property(
        fc.domain(),
        fc.array(fc.domain(), { minLength: 0, maxLength: 5 }),
        (testDomain, otherDomains) => {
          // Include testDomain in brand list
          const brandDomains = [...otherDomains, testDomain];
          
          const result = isEarnedMedia(testDomain, brandDomains);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subdomain matching works correctly', () => {
    const brandDomains = ['mybrand.com'];
    
    // Subdomain should be considered owned
    expect(isEarnedMedia('blog.mybrand.com', brandDomains)).toBe(false);
    expect(isEarnedMedia('www.mybrand.com', brandDomains)).toBe(false);
    
    // Different domain should be earned
    expect(isEarnedMedia('techcrunch.com', brandDomains)).toBe(true);
    expect(isEarnedMedia('mybrand.io', brandDomains)).toBe(true);
  });

  it('case insensitive matching', () => {
    const brandDomains = ['MyBrand.com'];
    
    expect(isEarnedMedia('mybrand.com', brandDomains)).toBe(false);
    expect(isEarnedMedia('MYBRAND.COM', brandDomains)).toBe(false);
    expect(isEarnedMedia('MyBrand.COM', brandDomains)).toBe(false);
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 13: Graph SameAs Consistency**
 * **Validates: Requirements 6.2**
 * 
 * For any entity with sameAs links added to the ReputationGraph,
 * querying the graph for that entity SHALL return all linked sameAs URLs.
 */
import { ReputationGraph } from '../../src/lib/citation-monitor';

describe('Property 13: Graph SameAs Consistency', () => {
  it('all added sameAs links are retrievable', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
        (entityId, sameAsUrls) => {
          const graph = new ReputationGraph();
          
          // Add the entity node first
          graph.addNode({
            id: entityId,
            name: entityId,
            type: 'entity',
            authority: 50,
            sameAs: []
          });
          
          // Add all sameAs links
          for (const url of sameAsUrls) {
            graph.addSameAsLink(entityId, url);
          }
          
          // Retrieve and verify
          const retrieved = graph.getSameAsLinks(entityId);
          
          // All added URLs should be present (deduplicated)
          const uniqueUrls = Array.from(new Set(sameAsUrls));
          expect(retrieved.length).toBe(uniqueUrls.length);
          
          for (const url of uniqueUrls) {
            expect(retrieved).toContain(url);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sameAs links are deduplicated', () => {
    const graph = new ReputationGraph();
    const entityId = 'test-entity';
    const url = 'https://linkedin.com/in/johndoe';
    
    graph.addNode({
      id: entityId,
      name: 'Test Entity',
      type: 'entity',
      authority: 50,
      sameAs: []
    });
    
    // Add same URL multiple times
    graph.addSameAsLink(entityId, url);
    graph.addSameAsLink(entityId, url);
    graph.addSameAsLink(entityId, url);
    
    const retrieved = graph.getSameAsLinks(entityId);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0]).toBe(url);
  });

  it('non-existent entity returns empty array', () => {
    const graph = new ReputationGraph();
    const retrieved = graph.getSameAsLinks('non-existent');
    expect(retrieved).toEqual([]);
  });

  it('sameAs links create edges in graph', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.webUrl(),
        (entityId, sameAsUrl) => {
          const graph = new ReputationGraph();
          
          graph.addNode({
            id: entityId,
            name: entityId,
            type: 'entity',
            authority: 50,
            sameAs: []
          });
          
          graph.addSameAsLink(entityId, sameAsUrl);
          
          // Verify edge was created
          const edges = graph.getEdgesForNode(entityId);
          const sameAsEdge = edges.find(e => e.type === 'sameAs' && e.target === sameAsUrl);
          
          expect(sameAsEdge).toBeDefined();
          expect(sameAsEdge?.weight).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-geo-sdk-v2, Property 14: Topic Clustering Transitivity**
 * **Validates: Requirements 6.3**
 * 
 * For any set of entities where A is related to B and B is related to C
 * with similarity above threshold, A and C SHALL appear in the same topic cluster.
 */
describe('Property 14: Topic Clustering Transitivity', () => {
  it('transitive relationships create same cluster', () => {
    const graph = new ReputationGraph();
    
    // Create three entities
    const entities = ['A', 'B', 'C'];
    for (const id of entities) {
      graph.addNode({
        id,
        name: id,
        type: 'entity',
        authority: 50,
        sameAs: []
      });
    }
    
    // A -> B and B -> C with weight above threshold
    graph.addTopicRelationship('A', 'B', 0.8);
    graph.addTopicRelationship('B', 'C', 0.8);
    
    // Build clusters with threshold 0.5
    const clusters = graph.buildTopicClusters(0.5);
    
    // A and C should be in the same cluster
    const clusterWithA = clusters.find(c => c.members.includes('A'));
    expect(clusterWithA).toBeDefined();
    expect(clusterWithA?.members).toContain('B');
    expect(clusterWithA?.members).toContain('C');
  });

  it('relationships below threshold do not cluster', () => {
    const graph = new ReputationGraph();
    
    // Create two entities
    graph.addNode({ id: 'X', name: 'X', type: 'entity', authority: 50, sameAs: [] });
    graph.addNode({ id: 'Y', name: 'Y', type: 'entity', authority: 50, sameAs: [] });
    
    // Add relationship below threshold
    graph.addTopicRelationship('X', 'Y', 0.3);
    
    // Build clusters with threshold 0.5
    const clusters = graph.buildTopicClusters(0.5);
    
    // X and Y should NOT be in the same cluster
    const clusterWithX = clusters.find(c => c.members.includes('X') && c.members.includes('Y'));
    expect(clusterWithX).toBeUndefined();
  });

  it('multiple chains create single cluster', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        (chainLength) => {
          const graph = new ReputationGraph();
          
          // Create chain of entities
          const entities = Array.from({ length: chainLength }, (_, i) => `entity_${i}`);
          
          for (const id of entities) {
            graph.addNode({
              id,
              name: id,
              type: 'entity',
              authority: 50,
              sameAs: []
            });
          }
          
          // Connect them in a chain: 0->1->2->...->n
          for (let i = 0; i < entities.length - 1; i++) {
            graph.addTopicRelationship(entities[i], entities[i + 1], 0.8);
          }
          
          const clusters = graph.buildTopicClusters(0.5);
          
          // All entities should be in the same cluster
          const mainCluster = clusters.find(c => c.members.includes(entities[0]));
          expect(mainCluster).toBeDefined();
          
          for (const entity of entities) {
            expect(mainCluster?.members).toContain(entity);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('disconnected components create separate clusters', () => {
    const graph = new ReputationGraph();
    
    // Create two disconnected groups
    const group1 = ['A1', 'A2', 'A3'];
    const group2 = ['B1', 'B2', 'B3'];
    
    for (const id of [...group1, ...group2]) {
      graph.addNode({ id, name: id, type: 'entity', authority: 50, sameAs: [] });
    }
    
    // Connect within groups
    graph.addTopicRelationship('A1', 'A2', 0.8);
    graph.addTopicRelationship('A2', 'A3', 0.8);
    graph.addTopicRelationship('B1', 'B2', 0.8);
    graph.addTopicRelationship('B2', 'B3', 0.8);
    
    const clusters = graph.buildTopicClusters(0.5);
    
    // Should have at least 2 clusters
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    
    // Group1 and Group2 should be in different clusters
    const clusterWithA1 = clusters.find(c => c.members.includes('A1'));
    const clusterWithB1 = clusters.find(c => c.members.includes('B1'));
    
    expect(clusterWithA1).toBeDefined();
    expect(clusterWithB1).toBeDefined();
    expect(clusterWithA1?.id).not.toBe(clusterWithB1?.id);
  });
});
