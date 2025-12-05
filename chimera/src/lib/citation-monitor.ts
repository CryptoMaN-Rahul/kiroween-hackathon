/**
 * Citation Monitor
 * 
 * Tracks brand mentions and earned media across the web.
 * Calculates GEO Health Score based on citation authority.
 * 
 * Production-grade implementation with instance-based storage.
 * 
 * @module citation-monitor
 */

import type {
  Citation,
  CitationMonitorConfig,
  GEOHealthScore,
  GEOHealthComponents,
  Sentiment
} from '@/types';
import { discoverCitations, toStandardCitation } from './citation-discovery';

// =============================================================================
// Reputation Graph
// =============================================================================

export interface ReputationNode {
  id: string;
  type: 'brand' | 'source' | 'entity';
  name: string;
  authority: number;
  sameAs: string[];
}

export interface ReputationEdge {
  source: string;
  target: string;
  type: 'citation' | 'sameAs' | 'topic';
  weight: number;
}

export interface TopicCluster {
  id: string;
  name: string;
  members: string[];
}

export class ReputationGraph {
  private nodes: Map<string, ReputationNode> = new Map();
  private edges: ReputationEdge[] = [];
  private clusters: Map<string, TopicCluster> = new Map();

  addNode(node: ReputationNode): void {
    this.nodes.set(node.id, node);
  }

  getNode(id: string): ReputationNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): ReputationNode[] {
    return Array.from(this.nodes.values());
  }

  addEdge(edge: ReputationEdge): void {
    this.edges.push(edge);
  }

  getAllEdges(): ReputationEdge[] {
    return [...this.edges];
  }

  getEdgesForNode(nodeId: string): ReputationEdge[] {
    return this.edges.filter(e => e.source === nodeId || e.target === nodeId);
  }

  addSameAsLink(entityId: string, sameAsUrl: string): void {
    const node = this.nodes.get(entityId);
    if (node) {
      if (!node.sameAs.includes(sameAsUrl)) {
        node.sameAs.push(sameAsUrl);
      }
      this.addEdge({ source: entityId, target: sameAsUrl, type: 'sameAs', weight: 1.0 });
    }
  }

  getSameAsLinks(entityId: string): string[] {
    const node = this.nodes.get(entityId);
    return node ? [...node.sameAs] : [];
  }

  addTopicRelationship(entityId1: string, entityId2: string, weight: number = 1.0): void {
    this.addEdge({ source: entityId1, target: entityId2, type: 'topic', weight });
  }

  buildTopicClusters(threshold: number = 0.5): TopicCluster[] {
    const topicEdges = this.edges.filter(e => e.type === 'topic' && e.weight >= threshold);
    const parent: Map<string, string> = new Map();
    
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
      return parent.get(x)!;
    };
    
    const union = (x: string, y: string): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) parent.set(px, py);
    };
    
    for (const edge of topicEdges) {
      union(edge.source, edge.target);
    }
    
    const clusterMap: Map<string, string[]> = new Map();
    // Fix: Use Array.from() instead of direct iteration
    const nodeIds = Array.from(this.nodes.keys());
    for (const nodeId of nodeIds) {
      const root = find(nodeId);
      if (!clusterMap.has(root)) clusterMap.set(root, []);
      clusterMap.get(root)!.push(nodeId);
    }
    
    const clusters: TopicCluster[] = [];
    let clusterIndex = 0;
    
    clusterMap.forEach((members, root) => {
      if (members.length > 1) {
        clusters.push({
          id: `cluster_${clusterIndex++}`,
          name: this.nodes.get(root)?.name || `Cluster ${clusterIndex}`,
          members
        });
      }
    });
    
    this.clusters.clear();
    for (const cluster of clusters) {
      this.clusters.set(cluster.id, cluster);
    }
    
    return clusters;
  }

  getClusterForEntity(entityId: string): TopicCluster | undefined {
    // Fix: Use Array.from() instead of direct iteration
    const clusterValues = Array.from(this.clusters.values());
    for (const cluster of clusterValues) {
      if (cluster.members.includes(entityId)) return cluster;
    }
    return undefined;
  }

  calculateAuthorityScore(nodeId: string): number {
    const incomingCitations = this.edges.filter(e => e.target === nodeId && e.type === 'citation');
    if (incomingCitations.length === 0) return this.nodes.get(nodeId)?.authority || 0;
    
    let totalAuthority = 0;
    for (const edge of incomingCitations) {
      const sourceNode = this.nodes.get(edge.source);
      if (sourceNode) totalAuthority += sourceNode.authority * edge.weight;
    }
    
    return Math.min(100, Math.round(totalAuthority / incomingCitations.length));
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.clusters.clear();
  }

  getStats(): { nodeCount: number; edgeCount: number; clusterCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      clusterCount: this.clusters.size
    };
  }
}

// =============================================================================
// Domain Authority Database
// =============================================================================

const DOMAIN_AUTHORITY_DB: Record<string, number> = {
  // News & Media
  'nytimes.com': 95, 'wsj.com': 94, 'bbc.com': 96, 'cnn.com': 94,
  'reuters.com': 95, 'apnews.com': 93, 'theguardian.com': 94,
  // Tech
  'techcrunch.com': 91, 'wired.com': 90, 'theverge.com': 89,
  'arstechnica.com': 88, 'engadget.com': 87, 'zdnet.com': 86,
  'venturebeat.com': 85, 'thenextweb.com': 84,
  // Business
  'forbes.com': 92, 'bloomberg.com': 93, 'businessinsider.com': 90,
  'inc.com': 88, 'entrepreneur.com': 87, 'fastcompany.com': 86,
  // Developer
  'github.com': 96, 'stackoverflow.com': 95, 'dev.to': 80,
  'medium.com': 85, 'hashnode.dev': 75, 'hackernoon.com': 78,
  // Social
  'reddit.com': 91, 'twitter.com': 94, 'x.com': 94,
  'linkedin.com': 98, 'youtube.com': 100, 'facebook.com': 96,
  // Reference
  'wikipedia.org': 98, 'docs.google.com': 90, 'notion.so': 75
};

// =============================================================================
// Citation Store (Instance-based)
// =============================================================================

export class CitationStore {
  private citations: Map<string, Citation> = new Map();
  private _brandDomains: string[] = [];

  constructor(brandDomains: string[] = []) {
    this._brandDomains = brandDomains.map(d => d.toLowerCase());
  }

  setBrandDomains(domains: string[]): void {
    this._brandDomains = domains.map(d => d.toLowerCase());
  }

  getBrandDomains(): string[] {
    return [...this._brandDomains];
  }

  /**
   * Check if a domain is earned media (not owned by the brand).
   */
  isEarnedMediaDomain(domain: string): boolean {
    const normalizedDomain = domain.toLowerCase();
    return !this._brandDomains.some(bd => 
      normalizedDomain.includes(bd) || normalizedDomain === bd
    );
  }

  add(citation: Citation): void {
    this.citations.set(citation.id, citation);
  }

  get(id: string): Citation | undefined {
    return this.citations.get(id);
  }

  getAll(): Citation[] {
    return Array.from(this.citations.values());
  }

  getSince(date: Date): Citation[] {
    return this.getAll().filter(c => c.discoveredAt >= date);
  }

  getByDomain(domain: string): Citation[] {
    const normalizedDomain = domain.toLowerCase();
    return this.getAll().filter(c => c.sourceDomain.toLowerCase().includes(normalizedDomain));
  }

  getEarnedMedia(): Citation[] {
    return this.getAll().filter(c => c.isEarnedMedia);
  }

  getOwnedMedia(): Citation[] {
    return this.getAll().filter(c => !c.isEarnedMedia);
  }

  remove(id: string): boolean {
    return this.citations.delete(id);
  }

  clear(): void {
    this.citations.clear();
  }

  get size(): number {
    return this.citations.size;
  }

  getStats(): {
    total: number;
    earnedMedia: number;
    ownedMedia: number;
    bySentiment: Record<Sentiment, number>;
    averageAuthority: number;
  } {
    const all = this.getAll();
    const earned = all.filter(c => c.isEarnedMedia);
    
    const bySentiment: Record<Sentiment, number> = {
      positive: all.filter(c => c.sentiment === 'positive').length,
      neutral: all.filter(c => c.sentiment === 'neutral').length,
      negative: all.filter(c => c.sentiment === 'negative').length
    };
    
    const avgAuthority = all.length > 0
      ? Math.round(all.reduce((sum, c) => sum + c.domainAuthority, 0) / all.length)
      : 0;
    
    return {
      total: all.length,
      earnedMedia: earned.length,
      ownedMedia: all.length - earned.length,
      bySentiment,
      averageAuthority: avgAuthority
    };
  }
}

// =============================================================================
// Pure Functions
// =============================================================================

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    // Handle malformed URLs
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
    return match ? match[1] : url;
  }
}

export function getDomainAuthority(domain: string): number {
  const normalizedDomain = domain.toLowerCase();
  
  // Check exact match first
  if (DOMAIN_AUTHORITY_DB[normalizedDomain]) {
    return DOMAIN_AUTHORITY_DB[normalizedDomain];
  }
  
  // Check if domain contains a known domain
  for (const [knownDomain, authority] of Object.entries(DOMAIN_AUTHORITY_DB)) {
    if (normalizedDomain.includes(knownDomain) || normalizedDomain.endsWith(`.${knownDomain}`)) {
      return authority;
    }
  }
  
  // Heuristic scoring for unknown domains
  if (normalizedDomain.endsWith('.gov')) return 85;
  if (normalizedDomain.endsWith('.edu')) return 80;
  if (normalizedDomain.endsWith('.org')) return 50;
  
  return 30; // Default for unknown domains
}

const POSITIVE_WORDS = new Set([
  'great', 'excellent', 'amazing', 'best', 'love', 'recommend', 'fantastic',
  'awesome', 'innovative', 'impressive', 'outstanding', 'superior', 'perfect',
  'brilliant', 'exceptional', 'remarkable', 'wonderful', 'superb', 'top-notch',
  'helpful', 'useful', 'valuable', 'reliable', 'efficient', 'effective',
  'intuitive', 'powerful', 'solid', 'robust', 'clean', 'fast', 'smooth'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'worst', 'hate', 'avoid', 'disappointing',
  'poor', 'broken', 'useless', 'horrible', 'inferior', 'mediocre', 'failed',
  'buggy', 'unreliable', 'overpriced', 'scam', 'waste', 'frustrating',
  'slow', 'confusing', 'complicated', 'difficult', 'annoying', 'clunky',
  'outdated', 'lacking', 'limited', 'flawed', 'problematic', 'unstable'
]);

/**
 * Negation words that flip sentiment of following words
 */
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nobody', 'nothing', 'nowhere',
  'hardly', 'barely', 'scarcely', 'seldom', 'rarely'
]);

/**
 * Contraction patterns that indicate negation
 */
const NEGATION_CONTRACTIONS = /\b(don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't)\b/gi;

/**
 * Phrases that indicate negative sentiment even with positive words
 */
const NEGATIVE_PHRASES = [
  'not great', 'not good', 'not the best', 'not impressed', 'not recommend',
  'could be better', 'needs improvement', 'leaves much to be desired',
  'falls short', 'missed the mark', 'not worth', 'waste of time',
  'waste of money', 'stay away', 'look elsewhere', 'better alternatives',
  'wouldn\'t recommend', 'can\'t recommend', 'don\'t bother', 'don\'t waste',
  'far from perfect', 'nothing special', 'overhyped', 'overrated'
];

/**
 * Phrases that indicate positive sentiment
 */
const POSITIVE_PHRASES = [
  'highly recommend', 'must have', 'game changer', 'life saver', 'love it',
  'works great', 'works perfectly', 'exceeded expectations', 'pleasant surprise',
  'best in class', 'top notch', 'well worth', 'worth every penny',
  'can\'t live without', 'wouldn\'t be without', 'exactly what i needed'
];

/**
 * Analyze sentiment with context-aware negation handling.
 * 
 * Production-grade sentiment analysis that:
 * 1. Detects negation words and contractions
 * 2. Flips sentiment of words following negation
 * 3. Recognizes multi-word sentiment phrases
 * 4. Handles sarcasm indicators
 */
export function analyzeSentiment(context: string): Sentiment {
  const contextLower = context.toLowerCase();
  const words = contextLower.split(/\W+/).filter(w => w.length > 0);
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  // Check for explicit sentiment phrases first (highest weight)
  for (const phrase of POSITIVE_PHRASES) {
    if (contextLower.includes(phrase)) {
      positiveScore += 3;
    }
  }
  
  for (const phrase of NEGATIVE_PHRASES) {
    if (contextLower.includes(phrase)) {
      negativeScore += 3;
    }
  }
  
  // Find all negation positions
  const negationPositions: number[] = [];
  
  // Check for negation contractions
  let match;
  const contractionRegex = new RegExp(NEGATION_CONTRACTIONS.source, 'gi');
  while ((match = contractionRegex.exec(contextLower)) !== null) {
    // Find word index at this position
    const beforeText = contextLower.substring(0, match.index);
    const wordsBefore = beforeText.split(/\W+/).filter(w => w.length > 0).length;
    negationPositions.push(wordsBefore);
  }
  
  // Check for negation words
  words.forEach((word, index) => {
    if (NEGATION_WORDS.has(word)) {
      negationPositions.push(index);
    }
  });
  
  // Analyze each word with negation context
  words.forEach((word, index) => {
    // Check if this word is within 3 words of a negation
    const isNegated = negationPositions.some(negPos => 
      index > negPos && index <= negPos + 3
    );
    
    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) {
        // Negated positive = negative
        negativeScore += 1;
      } else {
        positiveScore += 1;
      }
    }
    
    if (NEGATIVE_WORDS.has(word)) {
      if (isNegated) {
        // Negated negative = slightly positive (double negative)
        positiveScore += 0.5;
      } else {
        negativeScore += 1;
      }
    }
  });
  
  // Check for sarcasm indicators (reduce confidence)
  const sarcasmIndicators = /\b(yeah right|sure thing|oh great|just great|wonderful\.{2,}|amazing\.{2,})\b/i;
  if (sarcasmIndicators.test(context)) {
    // Sarcasm often flips sentiment
    const temp = positiveScore;
    positiveScore = negativeScore * 0.5;
    negativeScore = temp * 0.5;
  }
  
  // Determine final sentiment
  const diff = positiveScore - negativeScore;
  
  if (diff > 1) return 'positive';
  if (diff < -1) return 'negative';
  return 'neutral';
}

export function isEarnedMedia(domain: string, brandDomains: string[]): boolean {
  const normalizedDomain = domain.toLowerCase();
  return !brandDomains.some(bd => 
    normalizedDomain.includes(bd.toLowerCase()) || 
    normalizedDomain === bd.toLowerCase()
  );
}

export function generateCitationId(): string {
  return `cit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function createCitation(
  sourceUrl: string,
  mentionContext: string,
  brandDomains: string[] = []
): Citation {
  const domain = extractDomain(sourceUrl);
  
  return {
    id: generateCitationId(),
    sourceUrl,
    sourceDomain: domain,
    mentionContext,
    sentiment: analyzeSentiment(mentionContext),
    domainAuthority: getDomainAuthority(domain),
    discoveredAt: new Date(),
    isEarnedMedia: isEarnedMedia(domain, brandDomains)
  };
}

export function sortCitations(citations: Citation[]): Citation[] {
  return [...citations].sort((a, b) => {
    if (b.domainAuthority !== a.domainAuthority) {
      return b.domainAuthority - a.domainAuthority;
    }
    return b.discoveredAt.getTime() - a.discoveredAt.getTime();
  });
}

export function calculateCitationAuthority(citations: Citation[]): number {
  if (citations.length === 0) return 0;
  
  const EARNED_MEDIA_WEIGHT = 1.5;
  const OWNED_MEDIA_WEIGHT = 1.0;
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const citation of citations) {
    const weight = citation.isEarnedMedia ? EARNED_MEDIA_WEIGHT : OWNED_MEDIA_WEIGHT;
    
    let sentimentMultiplier = 1.0;
    if (citation.sentiment === 'positive') sentimentMultiplier = 1.2;
    if (citation.sentiment === 'negative') sentimentMultiplier = 0.5;
    
    totalScore += citation.domainAuthority * weight * sentimentMultiplier;
    totalWeight += weight;
  }
  
  return Math.min(Math.round(totalScore / totalWeight), 100);
}

export function calculateGEOScore(components: GEOHealthComponents): GEOHealthScore {
  const WEIGHTS = {
    routeHealth: 0.25,
    contentScannability: 0.25,
    schemaCoverage: 0.25,
    citationAuthority: 0.25
  };
  
  const overall = Math.round(
    components.routeHealth * WEIGHTS.routeHealth +
    components.contentScannability * WEIGHTS.contentScannability +
    components.schemaCoverage * WEIGHTS.schemaCoverage +
    components.citationAuthority * WEIGHTS.citationAuthority
  );
  
  const recommendations: string[] = [];
  
  if (components.routeHealth < 70) {
    recommendations.push('Improve route health by reviewing 404 patterns and creating aliases for common hallucinations');
  }
  if (components.contentScannability < 70) {
    recommendations.push('Increase content scannability by adding tables, bullet lists, and statistics');
  }
  if (components.schemaCoverage < 70) {
    recommendations.push('Improve schema coverage by adding JSON-LD structured data to more pages');
  }
  if (components.citationAuthority < 70) {
    recommendations.push('Build citation authority through PR outreach and content marketing');
  }
  
  if (overall >= 80) {
    recommendations.push('Your GEO score is excellent! Focus on maintaining freshness and monitoring for new opportunities.');
  }
  
  return { overall, components, recommendations, calculatedAt: new Date() };
}

// =============================================================================
// Citation Monitor Factory
// =============================================================================

export interface CitationMonitor {
  store: CitationStore;
  graph: ReputationGraph;
  addCitation(sourceUrl: string, mentionContext: string): Citation;
  getStats(): ReturnType<CitationStore['getStats']>;
  getGEOScore(components: Omit<GEOHealthComponents, 'citationAuthority'>): GEOHealthScore;
}

export function createCitationMonitor(config: CitationMonitorConfig = { brandTerms: [], scanIntervalHours: 24 }): CitationMonitor {
  const store = new CitationStore(config.brandTerms);
  const graph = new ReputationGraph();
  
  return {
    store,
    graph,
    
    addCitation(sourceUrl: string, mentionContext: string): Citation {
      const citation = createCitation(sourceUrl, mentionContext, config.brandTerms);
      store.add(citation);
      
      // Add to reputation graph
      graph.addNode({
        id: citation.sourceDomain,
        type: 'source',
        name: citation.sourceDomain,
        authority: citation.domainAuthority,
        sameAs: []
      });
      
      return citation;
    },
    
    getStats() {
      return store.getStats();
    },
    
    getGEOScore(components: Omit<GEOHealthComponents, 'citationAuthority'>): GEOHealthScore {
      const citationAuthority = calculateCitationAuthority(store.getAll());
      return calculateGEOScore({ ...components, citationAuthority });
    }
  };
}

// =============================================================================
// Legacy exports for backward compatibility
// =============================================================================

let _legacyStore: CitationStore | null = null;

function getLegacyStore(): CitationStore {
  if (!_legacyStore) _legacyStore = new CitationStore();
  return _legacyStore;
}

/** @deprecated Use createCitationMonitor() instead */
export function addCitation(citation: Citation): void {
  getLegacyStore().add(citation);
}

/** @deprecated Use createCitationMonitor() instead */
export function getCitations(): Citation[] {
  return getLegacyStore().getAll();
}

/** @deprecated Use createCitationMonitor() instead */
export function getNewCitations(since: Date): Citation[] {
  return getLegacyStore().getSince(since);
}

/** @deprecated Use createCitationMonitor() instead */
export function clearCitations(): void {
  getLegacyStore().clear();
}

/** @deprecated Use createCitationMonitor() instead */
export function getCitationStats() {
  return getLegacyStore().getStats();
}

export function createReputationGraph(): ReputationGraph {
  return new ReputationGraph();
}

// =============================================================================
// Citation Scanning (uses citation-discovery module)
// =============================================================================

/**
 * Scan for brand citations across free sources (Reddit, Hacker News).
 * This is a convenience wrapper around the citation-discovery module.
 * 
 * @param config - Citation monitor configuration with brand terms
 * @returns Array of discovered citations converted to standard Citation format
 */
export async function scanForCitations(config: CitationMonitorConfig): Promise<Citation[]> {
  const discovered = await discoverCitations({
    brandTerms: config.brandTerms,
    maxResultsPerSource: 50,
    timeoutMs: 10000
  });
  
  return discovered.map(toStandardCitation);
}
