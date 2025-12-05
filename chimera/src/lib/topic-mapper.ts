/**
 * Topic Cluster Mapper
 * 
 * Analyzes semantic relationships between pages to build topic clusters.
 * Identifies orphan pages and suggests internal linking opportunities.
 * 
 * @module topic-mapper
 */

import type {
  PageNode,
  PageRelationship,
  TopicCluster,
  TopicMapResult,
  LinkingSuggestion
} from '@/types';
// tokenizer import removed - using local implementation

/**
 * Minimum similarity threshold for relationship
 */
const RELATIONSHIP_THRESHOLD = 0.3;

/**
 * Minimum cluster size
 */
const MIN_CLUSTER_SIZE = 2;

/**
 * Extract topics from page content
 */
export function extractTopics(content: string): string[] {
  // Extract words, filter common words, normalize
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'they',
    'this', 'that', 'with', 'from', 'will', 'would', 'there', 'their', 'what',
    'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'than',
    'then', 'look', 'only', 'come', 'over', 'such', 'also', 'back', 'after',
    'more', 'other', 'very', 'most', 'even', 'these', 'much', 'being', 'well'
  ]);
  
  const filtered = words.filter(w => !stopWords.has(w));
  
  // Get unique topics
  return Array.from(new Set(filtered));
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Calculate semantic similarity between two pages
 */
export function calculatePageSimilarity(
  topicsA: string[],
  topicsB: string[]
): number {
  if (topicsA.length === 0 || topicsB.length === 0) return 0;
  
  const setA = new Set(topicsA);
  const setB = new Set(topicsB);
  
  // Jaccard similarity
  const setAArray = Array.from(setA);
  const intersection = new Set(setAArray.filter(x => setB.has(x)));
  const unionArray = setAArray.concat(Array.from(setB));
  const union = new Set(unionArray);
  
  return intersection.size / union.size;
}

/**
 * Find shared topics between two pages
 */
export function findSharedTopics(topicsA: string[], topicsB: string[]): string[] {
  const setA = new Set(topicsA);
  return topicsB.filter(t => setA.has(t));
}

/**
 * Create a page node from path and content
 */
export function createPageNode(
  path: string,
  title: string,
  content: string
): PageNode {
  return {
    path,
    title,
    contentHash: calculateContentHash(content)
  };
}

/**
 * Build relationships between pages
 */
export function buildRelationships(
  pages: Array<{ path: string; topics: string[] }>
): PageRelationship[] {
  const relationships: PageRelationship[] = [];
  
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const pageA = pages[i];
      const pageB = pages[j];
      
      const similarity = calculatePageSimilarity(pageA.topics, pageB.topics);
      
      if (similarity >= RELATIONSHIP_THRESHOLD) {
        const sharedTopics = findSharedTopics(pageA.topics, pageB.topics);
        
        // Add bidirectional relationships
        relationships.push({
          sourcePath: pageA.path,
          targetPath: pageB.path,
          similarity,
          sharedTopics
        });
        
        relationships.push({
          sourcePath: pageB.path,
          targetPath: pageA.path,
          similarity,
          sharedTopics
        });
      }
    }
  }
  
  return relationships;
}

/**
 * Check if relationship is symmetric
 */
export function isRelationshipSymmetric(relationships: PageRelationship[]): boolean {
  const relationshipMap = new Map<string, number>();
  
  for (const rel of relationships) {
    const key = `${rel.sourcePath}|${rel.targetPath}`;
    relationshipMap.set(key, rel.similarity);
  }
  
  for (const rel of relationships) {
    const reverseKey = `${rel.targetPath}|${rel.sourcePath}`;
    const reverseSimilarity = relationshipMap.get(reverseKey);
    
    if (reverseSimilarity === undefined || reverseSimilarity !== rel.similarity) {
      return false;
    }
  }
  
  return true;
}

/**
 * Find orphan pages (pages with no relationships)
 */
export function findOrphanPages(
  allPaths: string[],
  relationships: PageRelationship[]
): string[] {
  const connectedPaths = new Set<string>();
  
  for (const rel of relationships) {
    connectedPaths.add(rel.sourcePath);
    connectedPaths.add(rel.targetPath);
  }
  
  return allPaths.filter(path => !connectedPaths.has(path));
}

/**
 * Build topic clusters using connected components
 */
export function buildClusters(
  pages: Array<{ path: string; topics: string[] }>,
  relationships: PageRelationship[]
): TopicCluster[] {
  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  
  for (const page of pages) {
    adjacency.set(page.path, new Set());
  }
  
  for (const rel of relationships) {
    adjacency.get(rel.sourcePath)?.add(rel.targetPath);
  }
  
  // Find connected components using BFS
  const visited = new Set<string>();
  const clusters: TopicCluster[] = [];
  let clusterId = 0;
  
  for (const page of pages) {
    if (visited.has(page.path)) continue;
    
    const cluster: string[] = [];
    const queue = [page.path];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      cluster.push(current);
      
      const neighbors = adjacency.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }
    
    if (cluster.length >= MIN_CLUSTER_SIZE) {
      // Find central page (most connections)
      let centralPage = cluster[0];
      let maxConnections = 0;
      
      for (const path of cluster) {
        const connections = adjacency.get(path)?.size || 0;
        if (connections > maxConnections) {
          maxConnections = connections;
          centralPage = path;
        }
      }
      
      // Determine cluster name from shared topics
      const clusterTopics = new Map<string, number>();
      for (const path of cluster) {
        const page = pages.find(p => p.path === path);
        if (page) {
          for (const topic of page.topics) {
            clusterTopics.set(topic, (clusterTopics.get(topic) || 0) + 1);
          }
        }
      }
      
      // Get most common topic as cluster name
      let clusterName = `Cluster ${clusterId + 1}`;
      let maxCount = 0;
      clusterTopics.forEach((count, topic) => {
        if (count > maxCount) {
          maxCount = count;
          clusterName = topic.charAt(0).toUpperCase() + topic.slice(1);
        }
      });
      
      clusters.push({
        id: `cluster_${clusterId++}`,
        name: clusterName,
        pages: cluster,
        centralPage
      });
    }
  }
  
  return clusters;
}

/**
 * Generate linking suggestions for orphan pages
 */
export function generateLinkingSuggestions(
  orphanPages: string[],
  pages: Array<{ path: string; topics: string[] }>
): LinkingSuggestion[] {
  const suggestions: LinkingSuggestion[] = [];
  
  for (const orphanPath of orphanPages) {
    const orphanPage = pages.find(p => p.path === orphanPath);
    if (!orphanPage) continue;
    
    // Find best potential connection
    let bestMatch: { path: string; similarity: number } | null = null;
    
    for (const page of pages) {
      if (page.path === orphanPath) continue;
      
      const similarity = calculatePageSimilarity(orphanPage.topics, page.topics);
      
      if (similarity > 0 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { path: page.path, similarity };
      }
    }
    
    if (bestMatch) {
      suggestions.push({
        fromPath: orphanPath,
        toPath: bestMatch.path,
        reason: `Connect orphan page to related content (${(bestMatch.similarity * 100).toFixed(0)}% topic overlap)`,
        priority: bestMatch.similarity > 0.5 ? 'high' : bestMatch.similarity > 0.3 ? 'medium' : 'low'
      });
    }
  }
  
  return suggestions;
}

/**
 * Build complete topic map
 */
export function buildTopicMap(
  pages: Array<{ path: string; title: string; content: string }>
): TopicMapResult {
  // Extract topics for each page
  const pagesWithTopics = pages.map(page => ({
    path: page.path,
    topics: extractTopics(page.content)
  }));
  
  // Build nodes
  const nodes = pages.map(page => createPageNode(page.path, page.title, page.content));
  
  // Build relationships
  const relationships = buildRelationships(pagesWithTopics);
  
  // Find orphans
  const allPaths = pages.map(p => p.path);
  const orphanPages = findOrphanPages(allPaths, relationships);
  
  // Build clusters
  const clusters = buildClusters(pagesWithTopics, relationships);
  
  return {
    nodes,
    relationships,
    clusters,
    orphanPages
  };
}
