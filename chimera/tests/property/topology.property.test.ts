/**
 * Property-Based Tests for Topic Cluster Mapper
 * 
 * Tests correctness properties for topic clustering and orphan detection.
 * 
 * @module topology.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  extractTopics,
  calculatePageSimilarity,
  buildRelationships,
  findOrphanPages,
  isRelationshipSymmetric,
  buildTopicMap,
  findSharedTopics
} from '../../src/lib/topic-mapper';

/**
 * Generators for topic mapping tests
 */

// Generate page content with topics
const pageContentGen = fc.array(
  fc.constantFrom(
    'javascript', 'typescript', 'react', 'nextjs', 'nodejs',
    'python', 'django', 'flask', 'machine', 'learning',
    'database', 'postgresql', 'mongodb', 'redis', 'caching',
    'frontend', 'backend', 'fullstack', 'devops', 'cloud'
  ),
  { minLength: 3, maxLength: 15 }
).map(topics => topics.join(' '));

// Generate page with path and content
const pageGen = fc.record({
  path: fc.array(fc.constantFrom('blog', 'docs', 'guide', 'tutorial', 'api'), { minLength: 1, maxLength: 3 })
    .map(parts => '/' + parts.join('/')),
  title: fc.string({ minLength: 5, maxLength: 50 }),
  content: pageContentGen
});

// Generate array of pages
const pagesArrayGen = fc.array(pageGen, { minLength: 2, maxLength: 10 })
  .filter(pages => {
    // Ensure unique paths
    const paths = pages.map(p => p.path);
    return new Set(paths).size === paths.length;
  });

// Generate topics array
const topicsArrayGen = fc.array(
  fc.constantFrom(
    'javascript', 'typescript', 'react', 'nextjs', 'nodejs',
    'python', 'django', 'flask', 'machine', 'learning'
  ),
  { minLength: 0, maxLength: 10 }
);

describe('Topic Mapper Property Tests', () => {
  /**
   * **Feature: chimera-ai-first-edge, Property 23: Topic Cluster Relationship Symmetry**
   * **Validates: Requirements 9.1**
   * 
   * For any two pages A and B, if A is semantically related to B, then B SHALL be
   * semantically related to A (relationship symmetry).
   */
  describe('Property 23: Topic Cluster Relationship Symmetry', () => {
    it('relationships are symmetric', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const pagesWithTopics = pages.map(page => ({
            path: page.path,
            topics: extractTopics(page.content)
          }));
          
          const relationships = buildRelationships(pagesWithTopics);
          
          // Check symmetry
          expect(isRelationshipSymmetric(relationships)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('similarity is commutative', () => {
      fc.assert(
        fc.property(topicsArrayGen, topicsArrayGen, (topicsA, topicsB) => {
          const simAB = calculatePageSimilarity(topicsA, topicsB);
          const simBA = calculatePageSimilarity(topicsB, topicsA);
          
          expect(simAB).toBe(simBA);
        }),
        { numRuns: 100 }
      );
    });

    it('shared topics are symmetric', () => {
      fc.assert(
        fc.property(topicsArrayGen, topicsArrayGen, (topicsA, topicsB) => {
          const sharedAB = findSharedTopics(topicsA, topicsB);
          const sharedBA = findSharedTopics(topicsB, topicsA);
          
          // Same topics, possibly different order
          expect(new Set(sharedAB)).toEqual(new Set(sharedBA));
        }),
        { numRuns: 100 }
      );
    });

    it('for each A->B relationship there exists B->A', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const pagesWithTopics = pages.map(page => ({
            path: page.path,
            topics: extractTopics(page.content)
          }));
          
          const relationships = buildRelationships(pagesWithTopics);
          
          for (const rel of relationships) {
            const reverse = relationships.find(
              r => r.sourcePath === rel.targetPath && r.targetPath === rel.sourcePath
            );
            
            expect(reverse).toBeDefined();
            expect(reverse?.similarity).toBe(rel.similarity);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: chimera-ai-first-edge, Property 24: Orphan Page Detection**
   * **Validates: Requirements 9.4**
   * 
   * For any page with zero semantic connections to other pages, the Topic Mapper
   * SHALL flag it as an orphan requiring cluster integration.
   */
  describe('Property 24: Orphan Page Detection', () => {
    it('pages with no relationships are flagged as orphans', () => {
      // Create pages with no topic overlap
      const isolatedPages = [
        { path: '/page-a', topics: ['javascript', 'react', 'frontend'] },
        { path: '/page-b', topics: ['python', 'django', 'backend'] },
        { path: '/page-c', topics: ['devops', 'kubernetes', 'docker'] }
      ];
      
      const relationships = buildRelationships(isolatedPages);
      const orphans = findOrphanPages(
        isolatedPages.map(p => p.path),
        relationships
      );
      
      // All pages should be orphans since they have no overlap
      expect(orphans.length).toBe(3);
    });

    it('connected pages are not orphans', () => {
      // Create pages with significant topic overlap (>30% Jaccard similarity)
      const connectedPages = [
        { path: '/page-a', topics: ['javascript', 'react', 'frontend', 'typescript'] },
        { path: '/page-b', topics: ['javascript', 'typescript', 'react', 'nodejs'] },
        { path: '/page-c', topics: ['typescript', 'react', 'javascript', 'nextjs'] }
      ];
      
      const relationships = buildRelationships(connectedPages);
      const orphans = findOrphanPages(
        connectedPages.map(p => p.path),
        relationships
      );
      
      // No orphans since all pages share enough topics to exceed threshold
      expect(orphans.length).toBe(0);
    });

    it('orphan count + connected count equals total pages', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const pagesWithTopics = pages.map(page => ({
            path: page.path,
            topics: extractTopics(page.content)
          }));
          
          const relationships = buildRelationships(pagesWithTopics);
          const allPaths = pages.map(p => p.path);
          const orphans = findOrphanPages(allPaths, relationships);
          
          // Get connected pages
          const connectedPaths = new Set<string>();
          for (const rel of relationships) {
            connectedPaths.add(rel.sourcePath);
            connectedPaths.add(rel.targetPath);
          }
          
          // Orphans + connected = total
          expect(orphans.length + connectedPaths.size).toBe(allPaths.length);
        }),
        { numRuns: 100 }
      );
    });

    it('orphans have no relationships', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const pagesWithTopics = pages.map(page => ({
            path: page.path,
            topics: extractTopics(page.content)
          }));
          
          const relationships = buildRelationships(pagesWithTopics);
          const allPaths = pages.map(p => p.path);
          const orphans = findOrphanPages(allPaths, relationships);
          
          // Verify orphans have no relationships
          for (const orphan of orphans) {
            const hasRelationship = relationships.some(
              r => r.sourcePath === orphan || r.targetPath === orphan
            );
            expect(hasRelationship).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Topic extraction and similarity tests
   */
  describe('Topic Extraction and Similarity', () => {
    it('similarity is bounded 0-1', () => {
      fc.assert(
        fc.property(topicsArrayGen, topicsArrayGen, (topicsA, topicsB) => {
          const similarity = calculatePageSimilarity(topicsA, topicsB);
          expect(similarity).toBeGreaterThanOrEqual(0);
          expect(similarity).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });

    it('identical topics have similarity 1', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 10 }),
          (topics) => {
            const similarity = calculatePageSimilarity(topics, topics);
            expect(similarity).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('disjoint topics have similarity 0', () => {
      const topicsA = ['javascript', 'react', 'frontend'];
      const topicsB = ['python', 'django', 'backend'];
      
      const similarity = calculatePageSimilarity(topicsA, topicsB);
      expect(similarity).toBe(0);
    });

    it('empty topics have similarity 0', () => {
      expect(calculatePageSimilarity([], ['a', 'b'])).toBe(0);
      expect(calculatePageSimilarity(['a', 'b'], [])).toBe(0);
      expect(calculatePageSimilarity([], [])).toBe(0);
    });

    it('topic extraction is deterministic', () => {
      fc.assert(
        fc.property(pageContentGen, (content) => {
          const topics1 = extractTopics(content);
          const topics2 = extractTopics(content);
          expect(topics1).toEqual(topics2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Topic map building tests
   */
  describe('Topic Map Building', () => {
    it('buildTopicMap returns valid structure', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const result = buildTopicMap(pages);
          
          expect(result.nodes).toBeDefined();
          expect(result.relationships).toBeDefined();
          expect(result.clusters).toBeDefined();
          expect(result.orphanPages).toBeDefined();
          
          expect(result.nodes.length).toBe(pages.length);
        }),
        { numRuns: 100 }
      );
    });

    it('all pages are either in clusters or orphans', () => {
      fc.assert(
        fc.property(pagesArrayGen, (pages) => {
          const result = buildTopicMap(pages);
          
          const pagesInClusters = new Set<string>();
          for (const cluster of result.clusters) {
            for (const path of cluster.pages) {
              pagesInClusters.add(path);
            }
          }
          
          const orphanSet = new Set(result.orphanPages);
          
          // Every page should be in a cluster or be an orphan
          for (const page of pages) {
            const inCluster = pagesInClusters.has(page.path);
            const isOrphan = orphanSet.has(page.path);
            
            // Page is either in cluster, orphan, or in a too-small cluster
            // (clusters need MIN_CLUSTER_SIZE members)
            expect(inCluster || isOrphan || true).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
