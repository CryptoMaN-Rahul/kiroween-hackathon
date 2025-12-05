/**
 * Engine Optimizer
 * 
 * Provides AI engine-specific optimization configurations.
 * Different AI engines (Claude, GPT, Perplexity, Gemini) have different biases.
 * 
 * @module engine-optimizer
 */

// =============================================================================
// Types
// =============================================================================

export type AIEngine = 'claude' | 'gpt' | 'perplexity' | 'gemini';

export interface EngineConfig {
  name: AIEngine;
  biases: {
    earnedMediaWeight: number;
    listiclePreference: number;
    freshnessWeight: number;
  };
  queryFanOut: {
    minSubQueries: number;
    maxSubQueries: number;
  };
  recommendations: string[];
}

// =============================================================================
// Engine Configurations
// =============================================================================

const ENGINE_CONFIGS: Record<AIEngine, EngineConfig> = {
  claude: {
    name: 'claude',
    biases: {
      earnedMediaWeight: 0.8,
      listiclePreference: 0.6,
      freshnessWeight: 0.7
    },
    queryFanOut: {
      minSubQueries: 3,
      maxSubQueries: 5
    },
    recommendations: [
      'Claude prefers well-structured, factual content',
      'Include citations and sources',
      'Use clear headings and bullet points',
      'Avoid marketing fluff'
    ]
  },
  gpt: {
    name: 'gpt',
    biases: {
      earnedMediaWeight: 0.7,
      listiclePreference: 0.8,
      freshnessWeight: 0.6
    },
    queryFanOut: {
      minSubQueries: 3,
      maxSubQueries: 5
    },
    recommendations: [
      'GPT responds well to listicles and numbered lists',
      'Include specific examples and use cases',
      'Add comparison tables for product content',
      'Use schema.org markup for better understanding'
    ]
  },
  perplexity: {
    name: 'perplexity',
    biases: {
      earnedMediaWeight: 0.9,
      listiclePreference: 0.5,
      freshnessWeight: 0.9
    },
    queryFanOut: {
      minSubQueries: 4,
      maxSubQueries: 5
    },
    recommendations: [
      'Perplexity heavily weights recent content',
      'Earned media citations are crucial',
      'Include publication dates prominently',
      'Link to authoritative sources'
    ]
  },
  gemini: {
    name: 'gemini',
    biases: {
      earnedMediaWeight: 0.75,
      listiclePreference: 0.7,
      freshnessWeight: 0.65
    },
    queryFanOut: {
      minSubQueries: 3,
      maxSubQueries: 4
    },
    recommendations: [
      'Gemini integrates well with Google ecosystem',
      'Ensure Google Search Console is configured',
      'Use structured data for rich results',
      'Optimize for featured snippets'
    ]
  }
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get configuration for a specific AI engine.
 * 
 * **Property 29: Engine Configuration Application**
 * For any engine type, the optimizer SHALL apply the correct bias weights
 * and query fan-out settings for that engine.
 */
export function getEngineConfig(engine: AIEngine): EngineConfig {
  return { ...ENGINE_CONFIGS[engine] };
}

/**
 * Get all supported engines.
 */
export function getSupportedEngines(): AIEngine[] {
  return ['claude', 'gpt', 'perplexity', 'gemini'];
}

/**
 * Query intent patterns for smarter sub-query generation
 */
const QUERY_INTENTS = {
  informational: /^(?:what|who|when|where|why|how|explain|define|meaning)/i,
  navigational: /^(?:go to|find|locate|where is|directions)/i,
  transactional: /^(?:buy|purchase|order|price|cost|deal|discount|cheap)/i,
  comparison: /^(?:compare|vs|versus|difference|better|best)/i,
  review: /^(?:review|rating|opinion|experience|worth)/i,
};

/**
 * Detect the primary intent of a query
 */
function detectQueryIntent(query: string): keyof typeof QUERY_INTENTS | 'general' {
  for (const [intent, pattern] of Object.entries(QUERY_INTENTS)) {
    if (pattern.test(query)) {
      return intent as keyof typeof QUERY_INTENTS;
    }
  }
  return 'general';
}

/**
 * Extract key terms from a query for variation generation
 */
function extractKeyTerms(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves']);
  
  return query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Generate sub-queries for query fan-out.
 * Uses intent detection and key term extraction for smarter variations.
 * 
 * **Property 30: Query Fan-Out Cardinality**
 * For any query, the optimizer SHALL generate between 3-5 sub-queries (inclusive).
 */
export function generateSubQueries(query: string, engine: AIEngine): string[] {
  const config = ENGINE_CONFIGS[engine];
  const intent = detectQueryIntent(query);
  const keyTerms = extractKeyTerms(query);
  const mainTerm = keyTerms.join(' ') || query;
  
  const subQueries: string[] = [query]; // Always include original
  
  // Generate intent-specific variations
  switch (intent) {
    case 'informational':
      subQueries.push(
        `${mainTerm} explained`,
        `${mainTerm} definition`,
        `${mainTerm} examples`,
        `understanding ${mainTerm}`
      );
      break;
      
    case 'transactional':
      subQueries.push(
        `best ${mainTerm} to buy`,
        `${mainTerm} price comparison`,
        `${mainTerm} deals`,
        `where to buy ${mainTerm}`
      );
      break;
      
    case 'comparison':
      subQueries.push(
        `${mainTerm} pros and cons`,
        `${mainTerm} alternatives`,
        `${mainTerm} comparison chart`,
        `which ${mainTerm} is better`
      );
      break;
      
    case 'review':
      subQueries.push(
        `${mainTerm} honest review`,
        `${mainTerm} user experience`,
        `is ${mainTerm} worth it`,
        `${mainTerm} ratings`
      );
      break;
      
    case 'navigational':
      subQueries.push(
        `${mainTerm} official site`,
        `${mainTerm} homepage`,
        `${mainTerm} login`
      );
      break;
      
    default: // general
      subQueries.push(
        `what is ${mainTerm}`,
        `best ${mainTerm}`,
        `${mainTerm} guide`,
        `${mainTerm} tips`,
        `how to use ${mainTerm}`
      );
  }
  
  // Engine-specific adjustments
  if (engine === 'perplexity') {
    // Perplexity prefers recent/news-oriented queries
    subQueries.push(`${mainTerm} 2024`, `latest ${mainTerm} news`);
  } else if (engine === 'gpt') {
    // GPT responds well to structured queries
    subQueries.push(`${mainTerm} step by step`, `${mainTerm} checklist`);
  }
  
  // Deduplicate and limit to config range
  const uniqueQueries = Array.from(new Set(subQueries));
  const count = Math.min(
    config.queryFanOut.maxSubQueries,
    Math.max(config.queryFanOut.minSubQueries, uniqueQueries.length)
  );
  
  return uniqueQueries.slice(0, count);
}

/**
 * Calculate domain overlap between two result sets.
 * 
 * **Property 31: Domain Overlap Symmetry**
 * For any two engines A and B and any result set,
 * calculateDomainOverlap(A, B) SHALL equal calculateDomainOverlap(B, A).
 */
export function calculateDomainOverlap(results1: string[], results2: string[]): number {
  if (results1.length === 0 || results2.length === 0) return 0;
  
  const set1 = new Set(results1.map(r => r.toLowerCase()));
  const set2 = new Set(results2.map(r => r.toLowerCase()));
  
  let intersection = 0;
  set1.forEach(item => {
    if (set2.has(item)) intersection++;
  });
  
  // Jaccard similarity
  const union = set1.size + set2.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) / 100 : 0;
}

/**
 * Get optimization recommendations for content based on engine.
 */
export function getOptimizationRecommendations(
  engine: AIEngine,
  contentMetrics: {
    hasEarnedMedia: boolean;
    isListicle: boolean;
    ageInDays: number;
  }
): string[] {
  const config = ENGINE_CONFIGS[engine];
  const recommendations: string[] = [];
  
  if (!contentMetrics.hasEarnedMedia && config.biases.earnedMediaWeight > 0.7) {
    recommendations.push(`${engine} heavily weights earned media - consider PR outreach`);
  }
  
  if (!contentMetrics.isListicle && config.biases.listiclePreference > 0.7) {
    recommendations.push(`${engine} prefers listicle format - consider restructuring content`);
  }
  
  if (contentMetrics.ageInDays > 90 && config.biases.freshnessWeight > 0.7) {
    recommendations.push(`${engine} weights freshness highly - update content with recent info`);
  }
  
  return [...recommendations, ...config.recommendations];
}

/**
 * Create engine optimizer instance.
 */
export function createEngineOptimizer() {
  return {
    getConfig: getEngineConfig,
    getSupportedEngines,
    generateSubQueries,
    calculateDomainOverlap,
    getRecommendations: getOptimizationRecommendations
  };
}
