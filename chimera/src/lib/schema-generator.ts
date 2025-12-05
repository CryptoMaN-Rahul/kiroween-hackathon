/**
 * JSON-LD Schema Generator
 * 
 * Auto-generates structured data from page content following Schema.org vocabulary.
 * This helps AI agents understand page content and improves GEO (Generative Engine Optimization).
 * 
 * @module schema-generator
 */

import type {
  SchemaEntityType,
  DetectedEntity,
  SchemaEntity,
  GeneratedSchema,
  SchemaValidationResult,
  SchemaValidationError
} from '@/types';

// =============================================================================
// E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) Types
// =============================================================================

/**
 * E-E-A-T signals for enhanced schema generation.
 * These signals help AI agents assess content quality and trustworthiness.
 */
export interface EEATSignals {
  /** Author information */
  author?: {
    name: string;
    credentials?: string[];
    linkedInUrl?: string;
    sameAs?: string[];
  };
  /** Publication date in ISO format */
  datePublished?: string;
  /** Last modification date in ISO format */
  dateModified?: string;
  /** Publisher information */
  publisher?: {
    name: string;
    url: string;
    logo?: string;
  };
  /** Reviewer information (for reviewed content) */
  reviewer?: {
    name: string;
    credentials?: string[];
  };
  /** Sources/citations */
  citations?: string[];
}

/**
 * Entity detection patterns
 */
const ENTITY_PATTERNS: Record<SchemaEntityType, {
  keywords: string[];
  patterns: RegExp[];
  requiredProperties: string[];
}> = {
  Product: {
    keywords: ['price', 'buy', 'add to cart', 'product', 'sku', 'in stock', 'out of stock', 'shipping'],
    patterns: [
      /\$[\d,]+(?:\.\d{2})?/,  // Price pattern
      /(?:buy|purchase|order)\s+now/i,
      /add\s+to\s+cart/i,
      /(?:in|out\s+of)\s+stock/i
    ],
    requiredProperties: ['name', 'description', 'offers']
  },
  Article: {
    keywords: ['author', 'published', 'article', 'blog', 'post', 'written by', 'read time'],
    patterns: [
      /(?:published|posted)\s+(?:on\s+)?(?:\w+\s+\d+,?\s+\d{4}|\d{4}-\d{2}-\d{2})/i,
      /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
      /\d+\s+min(?:ute)?s?\s+read/i
    ],
    requiredProperties: ['headline', 'author', 'datePublished']
  },
  Organization: {
    keywords: ['company', 'about us', 'our team', 'founded', 'headquarters', 'employees', 'mission'],
    patterns: [
      /founded\s+(?:in\s+)?\d{4}/i,
      /(?:our|the)\s+(?:company|organization|team)/i,
      /headquarters?\s+(?:in|at)/i
    ],
    requiredProperties: ['name', 'url']
  },
  Person: {
    keywords: ['biography', 'profile', 'about me', 'experience', 'skills', 'contact me'],
    patterns: [
      /(?:my|his|her)\s+(?:experience|background|career)/i,
      /years?\s+of\s+experience/i,
      /(?:contact|reach)\s+(?:me|out)/i
    ],
    requiredProperties: ['name']
  },
  FAQ: {
    keywords: ['faq', 'frequently asked', 'questions', 'q&a', 'q:', 'a:'],
    patterns: [
      /(?:frequently\s+asked\s+)?questions?/i,
      /^Q:\s*.+$/m,
      /\?\s*\n+[A-Z]/
    ],
    requiredProperties: ['mainEntity']
  },
  WebPage: {
    keywords: [],
    patterns: [],
    requiredProperties: ['name', 'url']
  },
  BreadcrumbList: {
    keywords: ['home', 'breadcrumb', '>'],
    patterns: [
      /home\s*[>›»]\s*\w+/i
    ],
    requiredProperties: ['itemListElement']
  },
  HowTo: {
    keywords: ['how to', 'step by step', 'tutorial', 'guide', 'instructions', 'steps', 'step 1', 'step 2'],
    patterns: [
      /how\s+to\s+\w+/i,
      /step\s+\d+[:.]/i,
      /(?:first|second|third|next|then|finally)[,:]?\s+\w+/i,
      /^\d+\.\s+\w+/m
    ],
    requiredProperties: ['name', 'step']
  }
};

/**
 * Entity detection weights - some signals are stronger than others
 * Tuned for production accuracy to minimize false positives
 */
const SIGNAL_WEIGHTS = {
  // Strong signals (almost certainly this entity type) - requires multiple
  strongPattern: 8,
  // Medium signals (likely this entity type)
  mediumPattern: 4,
  // Weak signals (might be this entity type) - reduced weight
  keyword: 0.5,
  // Negative signals (probably NOT this entity type) - increased penalty
  negativeSignal: -5,
  // Context penalty (when content clearly belongs to another type)
  contextPenalty: -10,
};

// =============================================================================
// Sentence-Level Context Analysis
// =============================================================================

/**
 * Patterns that negate the meaning of keywords when they appear nearby.
 * E.g., "not a product" or "unlike products" should NOT trigger Product detection.
 */
const NEGATION_PATTERNS = [
  /\bnot\s+(?:a|an|the)?\s*/i,
  /\bno\s+/i,
  /\bnever\s+/i,
  /\bwithout\s+(?:a|an|the)?\s*/i,
  /\bisn't\s+(?:a|an|the)?\s*/i,
  /\baren't\s+/i,
  /\bwasn't\s+/i,
  /\bweren't\s+/i,
  /\bdon't\s+/i,
  /\bdoesn't\s+/i,
  /\bdidn't\s+/i,
  /\bwon't\s+/i,
  /\bcan't\s+/i,
  /\bcannot\s+/i,
  /\bunlike\s+/i,
  /\brather\s+than\s+/i,
  /\binstead\s+of\s+/i,
];

/**
 * Patterns that indicate comparison/discussion rather than being the entity.
 * E.g., "compared to products" or "similar to articles" should be weighted lower.
 */
const COMPARISON_PATTERNS = [
  /\bcompared\s+to\s+/i,
  /\bsimilar\s+to\s+/i,
  /\blike\s+(?:a|an|other)?\s*/i,
  /\bsuch\s+as\s+/i,
  /\bfor\s+example\s*/i,
  /\be\.g\.\s*/i,
  /\bi\.e\.\s*/i,
  /\bversus\s+/i,
  /\bvs\.?\s+/i,
  /\babout\s+/i,
  /\bdiscussing\s+/i,
  /\btalking\s+about\s+/i,
  /\bmentioning\s+/i,
];

/**
 * Page structure indicators that help determine content type.
 */
const PAGE_STRUCTURE_INDICATORS = {
  blog: [
    /\b(?:posted|published)\s+(?:on|at)\s+/i,
    /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
    /\b\d+\s+(?:min|minute)s?\s+read\b/i,
    /\b(?:comments?|replies|responses)\s*(?:\(\d+\)|\[\d+\])?\s*$/im,
    /\btags?:\s*/i,
    /\bcategory:\s*/i,
    /\bshare\s+(?:this|on)\s+/i,
  ],
  product: [
    /\badd\s+to\s+(?:cart|bag|basket)\b/i,
    /\bbuy\s+(?:now|it|this)\b/i,
    /\b(?:quantity|qty)[:\s]+/i,
    /\bsize[:\s]+/i,
    /\bcolor[:\s]+/i,
    /\brating[:\s]+[\d.]+/i,
    /\b\d+\s+reviews?\b/i,
    /\bfree\s+shipping\b/i,
  ],
  landing: [
    /\bget\s+started\b/i,
    /\bsign\s+up\b/i,
    /\bstart\s+(?:your\s+)?free\s+trial\b/i,
    /\brequest\s+(?:a\s+)?demo\b/i,
    /\bcontact\s+(?:us|sales)\b/i,
    /\bschedule\s+(?:a\s+)?(?:call|meeting)\b/i,
  ],
  faq: [
    /^Q:\s*/m,
    /^A:\s*/m,
    /\bfrequently\s+asked\s+questions?\b/i,
    /\bfaq\b/i,
    /\?\s*\n+[A-Z]/,
  ],
  howto: [
    /\bstep\s+\d+[:.]/i,
    /\bhow\s+to\s+\w+/i,
    /^\d+\.\s+\w+.*\n\d+\.\s+\w+/m,
    /\b(?:first|second|third|finally)[,:]?\s+/i,
  ],
};

/**
 * Analyze page structure to determine likely content type.
 * Returns scores for each page type.
 */
export function analyzePageStructure(content: string): Record<string, number> {
  const scores: Record<string, number> = {
    blog: 0,
    product: 0,
    landing: 0,
    faq: 0,
    howto: 0,
  };
  
  for (const [pageType, patterns] of Object.entries(PAGE_STRUCTURE_INDICATORS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        scores[pageType]++;
      }
    }
  }
  
  return scores;
}

/**
 * Check if a keyword appears in a negated context.
 * Returns true if the keyword is negated (e.g., "not a product").
 */
export function isKeywordNegated(content: string, keyword: string): boolean {
  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Find all occurrences of the keyword
  let index = contentLower.indexOf(keywordLower);
  while (index !== -1) {
    // Check the 50 characters before the keyword for negation patterns
    const contextStart = Math.max(0, index - 50);
    const contextBefore = contentLower.substring(contextStart, index);
    
    for (const pattern of NEGATION_PATTERNS) {
      if (pattern.test(contextBefore)) {
        return true;
      }
    }
    
    index = contentLower.indexOf(keywordLower, index + 1);
  }
  
  return false;
}

/**
 * Check if a keyword appears in a comparison/discussion context.
 * Returns true if the keyword is being discussed rather than being the subject.
 */
export function isKeywordInComparisonContext(content: string, keyword: string): boolean {
  const keywordLower = keyword.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let index = contentLower.indexOf(keywordLower);
  while (index !== -1) {
    const contextStart = Math.max(0, index - 30);
    const contextBefore = contentLower.substring(contextStart, index);
    
    for (const pattern of COMPARISON_PATTERNS) {
      if (pattern.test(contextBefore)) {
        return true;
      }
    }
    
    index = contentLower.indexOf(keywordLower, index + 1);
  }
  
  return false;
}

/**
 * Get the sentence containing a keyword for context analysis.
 */
export function getSentenceContext(content: string, keyword: string): string[] {
  const sentences: string[] = [];
  const keywordLower = keyword.toLowerCase();
  
  // Split into sentences (simple heuristic)
  const sentenceList = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentenceList) {
    if (sentence.toLowerCase().includes(keywordLower)) {
      sentences.push(sentence.trim());
    }
  }
  
  return sentences;
}

/**
 * Negative patterns that indicate content is NOT a certain entity type
 * Extended for better false positive prevention
 * Note: "review" alone is NOT negative for Product - product reviews are common
 */
const NEGATIVE_PATTERNS: Partial<Record<SchemaEntityType, RegExp[]>> = {
  Product: [
    /\b(?:article|blog|post|news|story)\b/i,
    /\b(?:how to|guide|tutorial|learn)\b/i,
    // Only "review of" is negative, not just "review" (product reviews are valid)
    /\b(?:opinion|analysis|thoughts on)\b/i,
    /\b(?:published|written by|author|posted on)\b/i,
    /\b(?:step \d+|first,|second,|finally,)\b/i,
    /\b(?:faq|frequently asked|questions?)\b/i,
    // Pricing discussions that aren't products
    /\b(?:pricing strategy|how to price|cost of living)\b/i,
  ],
  Article: [
    /\b(?:add to cart|buy now|checkout|purchase)\b/i,
    /\b(?:in stock|out of stock|shipping|delivery)\b/i,
    /\b(?:\$[\d,]+(?:\.\d{2})?)\s*(?:USD|CAD|EUR)?\s*(?:each|per|\/)/i,
    /\b(?:sku|product code|item number)\b/i,
  ],
  FAQ: [
    /\b(?:buy|purchase|order|cart|checkout)\b/i,
    /\b(?:step \d+|how to|tutorial|guide)\b/i,
  ],
  HowTo: [
    /\b(?:add to cart|buy now|checkout)\b/i,
    /\b(?:faq|frequently asked)\b/i,
    /\b(?:q:|a:|question:|answer:)\b/i,
  ],
  Organization: [
    /\b(?:add to cart|buy now|checkout)\b/i,
    /\b(?:step \d+|how to)\b/i,
    /\b(?:q:|a:|faq)\b/i,
  ],
  Person: [
    /\b(?:add to cart|buy now|checkout)\b/i,
    /\b(?:our company|our team|we are)\b/i,
  ],
};

/**
 * Strong patterns that almost certainly indicate an entity type
 */
const STRONG_PATTERNS: Partial<Record<SchemaEntityType, RegExp[]>> = {
  Product: [
    /add\s+to\s+cart/i,
    /buy\s+now/i,
    /\$[\d,]+(?:\.\d{2})?\s*(?:USD|CAD|EUR)?/,
    /(?:in|out\s+of)\s+stock/i,
    /sku[:\s]+[\w-]+/i,
  ],
  Article: [
    /^#\s+.+/m, // Markdown H1
    /published\s+(?:on\s+)?(?:\w+\s+\d+,?\s+\d{4})/i,
    /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
    /\d+\s+min(?:ute)?s?\s+read/i,
  ],
  FAQ: [
    /^Q:\s*.+$/m,
    /^A:\s*.+$/m,
    /frequently\s+asked\s+questions/i,
  ],
  HowTo: [
    /^step\s+\d+[:.]/im,
    /how\s+to\s+\w+/i,
    /^\d+\.\s+\w+.*\n\d+\.\s+\w+/m, // Multiple numbered steps
  ],
};

/**
 * Detect entities in content with improved accuracy.
 * Uses weighted scoring with positive and negative signals.
 * 
 * Production-grade detection that minimizes false positives by:
 * 1. Requiring multiple strong signals for high confidence
 * 2. Applying heavy penalties for negative signals
 * 3. Using mutual exclusion rules (Article vs Product)
 * 4. Requiring minimum content length for detection
 */
export function detectEntities(content: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  const contentLower = content.toLowerCase();
  
  // Skip detection for very short content (likely not enough context)
  // But allow if content has very strong signals (e.g., "Add to cart" + price)
  const hasVeryStrongSignals = 
    (/add\s+to\s+cart/i.test(content) && /\$[\d,]+(?:\.\d{2})?/.test(content)) ||
    (/buy\s+now/i.test(content) && /\$[\d,]+(?:\.\d{2})?/.test(content)) ||
    (/(?:in|out\s+of)\s+stock/i.test(content) && /\$[\d,]+(?:\.\d{2})?/.test(content)) ||
    (/^Q:\s*.+$/m.test(content) && /^A:\s*.+$/m.test(content)) ||
    (/published\s+(?:on\s+)?(?:\w+\s+\d+,?\s+\d{4})/i.test(content) && /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(content));
  
  if (content.length < 100 && !hasVeryStrongSignals) {
    return entities;
  }
  
  // Track which entity types have strong signals for mutual exclusion
  const strongSignalTypes: Set<SchemaEntityType> = new Set();
  const strongSignalCounts: Map<SchemaEntityType, number> = new Map();
  
  // First pass: identify which types have strong signals
  // Lower threshold to 1 strong signal for Product when price is present
  for (const entityType of Object.keys(ENTITY_PATTERNS)) {
    if (entityType === 'WebPage') continue;
    const type = entityType as SchemaEntityType;
    const strongPatterns = STRONG_PATTERNS[type] || [];
    let strongCount = 0;
    for (const pattern of strongPatterns) {
      if (pattern.test(content)) strongCount++;
    }
    strongSignalCounts.set(type, strongCount);
    
    // Product with price + any other signal is strong enough
    if (type === 'Product' && strongCount >= 2) {
      strongSignalTypes.add(type);
    } else if (strongCount >= 2) {
      strongSignalTypes.add(type);
    }
  }
  
  for (const [entityType, config] of Object.entries(ENTITY_PATTERNS)) {
    if (entityType === 'WebPage') continue; // WebPage is always added
    
    let score = 0;
    const matchedKeywords: string[] = [];
    const type = entityType as SchemaEntityType;
    
    // Check for strong patterns first (high confidence signals)
    const strongPatterns = STRONG_PATTERNS[type] || [];
    let strongMatches = 0;
    for (const pattern of strongPatterns) {
      if (pattern.test(content)) {
        score += SIGNAL_WEIGHTS.strongPattern;
        strongMatches++;
      }
    }
    
    // Check for negative patterns (signals this is NOT this entity type)
    const negativePatterns = NEGATIVE_PATTERNS[type] || [];
    let negativeMatches = 0;
    for (const pattern of negativePatterns) {
      if (pattern.test(content)) {
        score += SIGNAL_WEIGHTS.negativeSignal;
        negativeMatches++;
      }
    }
    
    // Apply mutual exclusion penalty
    // If another type has strong signals and this type doesn't, penalize
    if (strongSignalTypes.size > 0 && !strongSignalTypes.has(type)) {
      // Check if any mutually exclusive type has strong signals
      const exclusiveTypes: Record<SchemaEntityType, SchemaEntityType[]> = {
        'Product': ['Article', 'HowTo', 'FAQ'],
        'Article': ['Product', 'HowTo'],
        'HowTo': ['Product', 'Article', 'FAQ'],
        'FAQ': ['Product', 'HowTo'],
        'Organization': ['Product', 'Person'],
        'Person': ['Organization', 'Product'],
        'WebPage': [],
        'BreadcrumbList': [],
      };
      
      const exclusives = exclusiveTypes[type] || [];
      for (const exclusive of exclusives) {
        if (strongSignalTypes.has(exclusive)) {
          score += SIGNAL_WEIGHTS.contextPenalty;
          break;
        }
      }
    }
    
    // Check standard patterns
    for (const pattern of config.patterns) {
      if (pattern.test(content)) {
        score += SIGNAL_WEIGHTS.mediumPattern;
      }
    }
    
    // Check keywords (weakest signal - only count if we have other signals)
    // This prevents keyword-only detection which causes false positives
    // Also apply context analysis to reduce false positives
    if (strongMatches > 0 || score > 0) {
      for (const keyword of config.keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          // Check if keyword is negated (e.g., "not a product")
          if (isKeywordNegated(content, keyword)) {
            // Negated keywords actually count against this entity type
            score += SIGNAL_WEIGHTS.negativeSignal * 0.5;
            continue;
          }
          
          // Check if keyword is in comparison context (e.g., "compared to products")
          if (isKeywordInComparisonContext(content, keyword)) {
            // Comparison context means we're discussing, not being the entity
            score += SIGNAL_WEIGHTS.keyword * 0.3; // Reduced weight
            matchedKeywords.push(keyword + ' (comparison)');
            continue;
          }
          
          score += SIGNAL_WEIGHTS.keyword;
          matchedKeywords.push(keyword);
        }
      }
    }
    
    // Apply page structure analysis for additional context
    const pageStructure = analyzePageStructure(content);
    const structureMap: Record<SchemaEntityType, string> = {
      'Product': 'product',
      'Article': 'blog',
      'FAQ': 'faq',
      'HowTo': 'howto',
      'Organization': 'landing',
      'Person': 'landing',
      'WebPage': 'landing',
      'BreadcrumbList': 'landing',
    };
    
    const expectedStructure = structureMap[type];
    if (expectedStructure && pageStructure[expectedStructure] > 0) {
      // Boost confidence if page structure matches expected type
      score += pageStructure[expectedStructure] * 2;
    } else if (expectedStructure) {
      // Check if another structure type is dominant
      const maxStructure = Object.entries(pageStructure)
        .sort((a, b) => b[1] - a[1])[0];
      if (maxStructure && maxStructure[1] >= 3 && maxStructure[0] !== expectedStructure) {
        // Another structure type is dominant, penalize this entity type
        score += SIGNAL_WEIGHTS.contextPenalty * 0.5;
      }
    }
    
    // Calculate confidence with improved formula
    const maxPossibleScore = 
      strongPatterns.length * SIGNAL_WEIGHTS.strongPattern +
      config.patterns.length * SIGNAL_WEIGHTS.mediumPattern +
      Math.min(3, config.keywords.length) * SIGNAL_WEIGHTS.keyword; // Cap keyword contribution
    
    // Normalize score to 0-1 range
    let confidence = maxPossibleScore > 0 ? Math.max(0, score / maxPossibleScore) : 0;
    
    // Boost confidence if we have multiple strong matches
    if (strongMatches >= 3) {
      confidence = Math.min(1, confidence + 0.35);
    } else if (strongMatches >= 2) {
      confidence = Math.min(1, confidence + 0.25);
    } else if (strongMatches === 1) {
      confidence = Math.min(1, confidence + 0.15);
    }
    
    // Penalty for negative matches - BUT reduce penalty if we have strong signals
    // Strong signals should override weak negative signals
    const negativePenaltyMultiplier = strongMatches >= 2 ? 0.3 : strongMatches === 1 ? 0.6 : 1.0;
    
    if (negativeMatches >= 3) {
      confidence = Math.max(0, confidence - 0.5 * negativePenaltyMultiplier);
    } else if (negativeMatches >= 2) {
      confidence = Math.max(0, confidence - 0.35 * negativePenaltyMultiplier);
    } else if (negativeMatches >= 1) {
      confidence = Math.max(0, confidence - 0.2 * negativePenaltyMultiplier);
    }
    
    // Check for very strong product signals (price + action)
    const hasVeryStrongProductSignals = 
      (/add\s+to\s+cart/i.test(content) || /buy\s+now/i.test(content) || /(?:in|out\s+of)\s+stock/i.test(content)) 
      && /\$[\d,]+(?:\.\d{2})?/.test(content);
    const hasVeryStrongArticleSignals = 
      /published\s+(?:on\s+)?(?:\w+\s+\d+,?\s+\d{4})/i.test(content) && /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(content);
    
    // For Product: if we have very strong signals, ensure minimum confidence
    if (type === 'Product' && hasVeryStrongProductSignals) {
      confidence = Math.max(confidence, 0.6); // Ensure detection
    } else if (type === 'Product' && strongMatches === 0) {
      confidence = Math.min(confidence, 0.3); // Cap at below threshold
    }
    
    if (type === 'Article' && hasVeryStrongArticleSignals) {
      confidence = Math.max(confidence, 0.6); // Ensure detection
    } else if (type === 'Article' && strongMatches === 0) {
      confidence = Math.min(confidence, 0.3); // Cap at below threshold
    }
    
    // Only include if confidence is above threshold (raised to 0.45)
    if (confidence >= 0.45) {
      entities.push({
        type,
        name: extractName(content, type),
        description: extractDescription(content),
        properties: extractProperties(content, type),
        confidence
      });
    }
  }
  
  // Sort by confidence descending
  entities.sort((a, b) => b.confidence - a.confidence);
  
  // Apply mutual exclusion: if we have a high-confidence entity, 
  // remove conflicting lower-confidence ones
  if (entities.length > 1) {
    const topEntity = entities[0];
    const exclusiveTypes: Record<SchemaEntityType, SchemaEntityType[]> = {
      'Product': ['Article', 'HowTo'],
      'Article': ['Product'],
      'HowTo': ['Article'],
      'FAQ': [],
      'Organization': ['Person'],
      'Person': ['Organization'],
      'WebPage': [],
      'BreadcrumbList': [],
    };
    
    const exclusives = exclusiveTypes[topEntity.type] || [];
    if (topEntity.confidence >= 0.6) {
      // Remove mutually exclusive types if top entity is confident
      return entities.filter(e => 
        e === topEntity || !exclusives.includes(e.type)
      );
    }
  }
  
  // Limit to top 2 entities to avoid over-tagging
  return entities.slice(0, 2);
}

/**
 * Extract name from content based on entity type
 */
function extractName(content: string, entityType: SchemaEntityType): string {
  // Try to find a title/heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  
  const htmlH1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (htmlH1Match) return htmlH1Match[1].trim();
  
  // Fallback based on entity type
  switch (entityType) {
    case 'Product':
      const productMatch = content.match(/(?:product|item):\s*(.+)/i);
      return productMatch ? productMatch[1].trim() : 'Product';
    case 'Article':
      return 'Article';
    case 'Organization':
      return 'Organization';
    case 'Person':
      const nameMatch = content.match(/(?:name|by):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      return nameMatch ? nameMatch[1] : 'Person';
    default:
      return entityType;
  }
}

/**
 * Extract description from content
 */
function extractDescription(content: string): string {
  // Try to find first paragraph
  const paragraphMatch = content.match(/^(?!#)(?!<h)(?!\|)(?!-)(.{50,200})/m);
  if (paragraphMatch) return paragraphMatch[1].trim();
  
  // Fallback to first 160 characters
  const cleaned = content.replace(/[#*_\[\]]/g, '').trim();
  return cleaned.substring(0, 160);
}

/**
 * Extract properties based on entity type
 */
function extractProperties(content: string, entityType: SchemaEntityType): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  
  switch (entityType) {
    case 'Product':
      // Extract price
      const priceMatch = content.match(/\$[\d,]+(?:\.\d{2})?/);
      if (priceMatch) {
        props.price = priceMatch[0].replace(/[$,]/g, '');
        props.priceCurrency = 'USD';
      }
      // Extract availability
      if (/in\s+stock/i.test(content)) {
        props.availability = 'https://schema.org/InStock';
      } else if (/out\s+of\s+stock/i.test(content)) {
        props.availability = 'https://schema.org/OutOfStock';
      }
      break;
      
    case 'Article':
      // Extract date
      const dateMatch = content.match(/(?:published|posted)\s+(?:on\s+)?(\w+\s+\d+,?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
      if (dateMatch) {
        props.datePublished = dateMatch[1];
      }
      // Extract author
      const authorMatch = content.match(/by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (authorMatch) {
        props.author = authorMatch[1];
      }
      break;
      
    case 'Organization':
      // Extract founding date
      const foundedMatch = content.match(/founded\s+(?:in\s+)?(\d{4})/i);
      if (foundedMatch) {
        props.foundingDate = foundedMatch[1];
      }
      break;
      
    case 'FAQ':
      // Extract Q&A pairs
      const qaPattern = /(?:Q:|Question:)\s*(.+?)\s*(?:A:|Answer:)\s*(.+?)(?=(?:Q:|Question:|$))/gi;
      const questions: Array<{ question: string; answer: string }> = [];
      let qaMatch;
      while ((qaMatch = qaPattern.exec(content)) !== null) {
        questions.push({
          question: qaMatch[1].trim(),
          answer: qaMatch[2].trim()
        });
      }
      if (questions.length > 0) {
        props.mainEntity = questions;
      }
      break;
  }
  
  return props;
}

/**
 * Generate JSON-LD schema from detected entities
 */
export function generateSchema(entities: DetectedEntity[], pageUrl?: string): GeneratedSchema {
  const graph: SchemaEntity[] = [];
  
  for (const entity of entities) {
    const schemaEntity = entityToSchema(entity, pageUrl);
    graph.push(schemaEntity);
  }
  
  // Always add WebPage if we have other entities
  if (graph.length > 0 && !graph.some(e => e['@type'] === 'WebPage')) {
    graph.unshift({
      '@type': 'WebPage',
      '@id': pageUrl || '#webpage',
      name: entities[0]?.name || 'Page',
      url: pageUrl
    });
  }
  
  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

/**
 * Convert detected entity to Schema.org entity
 */
function entityToSchema(entity: DetectedEntity, pageUrl?: string): SchemaEntity {
  const base: SchemaEntity = {
    '@type': entity.type,
    '@id': pageUrl ? `${pageUrl}#${entity.type.toLowerCase()}` : `#${entity.type.toLowerCase()}`,
    name: entity.name
  };
  
  if (entity.description) {
    base.description = entity.description;
  }
  
  // Add type-specific properties
  switch (entity.type) {
    case 'Product':
      if (entity.properties.price) {
        base.offers = {
          '@type': 'Offer',
          price: entity.properties.price,
          priceCurrency: entity.properties.priceCurrency || 'USD',
          availability: entity.properties.availability || 'https://schema.org/InStock'
        };
      }
      break;
      
    case 'Article':
      if (entity.properties.datePublished) {
        base.datePublished = entity.properties.datePublished;
      }
      if (entity.properties.author) {
        base.author = {
          '@type': 'Person',
          name: entity.properties.author
        };
      }
      base.headline = entity.name;
      break;
      
    case 'Organization':
      if (entity.properties.foundingDate) {
        base.foundingDate = entity.properties.foundingDate;
      }
      if (pageUrl) {
        base.url = pageUrl;
      }
      break;
      
    case 'FAQ':
      if (entity.properties.mainEntity) {
        base.mainEntity = (entity.properties.mainEntity as Array<{ question: string; answer: string }>).map(qa => ({
          '@type': 'Question',
          name: qa.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: qa.answer
          }
        }));
      }
      break;
  }
  
  return base;
}

/**
 * Validate generated schema against Schema.org requirements
 */
export function validateSchema(schema: GeneratedSchema): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  
  // Check context
  if (schema['@context'] !== 'https://schema.org') {
    errors.push({
      entityType: 'Schema',
      property: '@context',
      message: '@context must be "https://schema.org"',
      severity: 'error'
    });
  }
  
  // Check graph
  if (!Array.isArray(schema['@graph']) || schema['@graph'].length === 0) {
    errors.push({
      entityType: 'Schema',
      property: '@graph',
      message: '@graph must be a non-empty array',
      severity: 'error'
    });
  }
  
  // Validate each entity
  for (const entity of schema['@graph']) {
    const entityType = entity['@type'] as SchemaEntityType;
    const config = ENTITY_PATTERNS[entityType];
    
    if (!config) {
      errors.push({
        entityType: entityType,
        property: '@type',
        message: `Unknown entity type: ${entityType}`,
        severity: 'warning'
      });
      continue;
    }
    
    // Check required properties
    for (const prop of config.requiredProperties) {
      if (!(prop in entity) || entity[prop] === undefined || entity[prop] === null) {
        errors.push({
          entityType: entityType,
          property: prop,
          message: `Missing required property: ${prop}`,
          severity: 'error'
        });
      }
    }
  }
  
  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  };
}

/**
 * Serialize schema to JSON-LD string
 */
export function serialize(schema: GeneratedSchema): string {
  return JSON.stringify(schema, null, 2);
}

/**
 * Parse JSON-LD string to schema object
 */
export function parse(jsonLd: string): GeneratedSchema {
  const parsed = JSON.parse(jsonLd);
  
  // Validate basic structure
  if (parsed['@context'] !== 'https://schema.org') {
    throw new Error('Invalid @context');
  }
  
  if (!Array.isArray(parsed['@graph'])) {
    throw new Error('Invalid @graph');
  }
  
  return parsed as GeneratedSchema;
}

/**
 * Generate schema from content (convenience function)
 */
export function generateFromContent(content: string, pageUrl?: string): GeneratedSchema {
  const entities = detectEntities(content);
  return generateSchema(entities, pageUrl);
}

/**
 * Get HTML script tag for embedding schema
 */
export function toScriptTag(schema: GeneratedSchema): string {
  return `<script type="application/ld+json">\n${serialize(schema)}\n</script>`;
}

// =============================================================================
// E-E-A-T Signal Functions
// =============================================================================

/**
 * Add E-E-A-T signals to an existing schema.
 * Enhances schema with author, publisher, dates, and trust signals.
 * 
 * **Property 26: E-E-A-T Signal Inclusion**
 * For any content with author information and dates provided,
 * the generated schema SHALL include author, datePublished, and dateModified fields.
 */
export function addEEATSignals(schema: GeneratedSchema, signals: EEATSignals): GeneratedSchema {
  // Deep clone to avoid mutation
  const enhanced: GeneratedSchema = JSON.parse(JSON.stringify(schema));
  
  for (const entity of enhanced['@graph']) {
    // Add author to Article entities
    if (entity['@type'] === 'Article' && signals.author) {
      const authorEntity: SchemaEntity = {
        '@type': 'Person',
        name: signals.author.name
      };
      
      if (signals.author.credentials && signals.author.credentials.length > 0) {
        authorEntity.jobTitle = signals.author.credentials[0];
      }
      
      // Add sameAs links (LinkedIn, etc.)
      const sameAs: string[] = [];
      if (signals.author.linkedInUrl) {
        sameAs.push(signals.author.linkedInUrl);
      }
      if (signals.author.sameAs) {
        sameAs.push(...signals.author.sameAs);
      }
      if (sameAs.length > 0) {
        authorEntity.sameAs = sameAs;
      }
      
      entity.author = authorEntity;
    }
    
    // Add dates to Article and WebPage entities
    if ((entity['@type'] === 'Article' || entity['@type'] === 'WebPage')) {
      if (signals.datePublished) {
        entity.datePublished = signals.datePublished;
      }
      if (signals.dateModified) {
        entity.dateModified = signals.dateModified;
      }
    }
    
    // Add publisher to Article entities
    if (entity['@type'] === 'Article' && signals.publisher) {
      entity.publisher = {
        '@type': 'Organization',
        name: signals.publisher.name,
        url: signals.publisher.url,
        ...(signals.publisher.logo && {
          logo: {
            '@type': 'ImageObject',
            url: signals.publisher.logo
          }
        })
      };
    }
    
    // Add reviewer if present
    if (entity['@type'] === 'Article' && signals.reviewer) {
      entity.reviewedBy = {
        '@type': 'Person',
        name: signals.reviewer.name,
        ...(signals.reviewer.credentials && signals.reviewer.credentials.length > 0 && {
          jobTitle: signals.reviewer.credentials[0]
        })
      };
    }
    
    // Add citations as references
    if (entity['@type'] === 'Article' && signals.citations && signals.citations.length > 0) {
      entity.citation = signals.citations.map(url => ({
        '@type': 'WebPage',
        url
      }));
    }
  }
  
  return enhanced;
}

/**
 * Create a Person schema with sameAs links.
 * 
 * **Property 27: Authorship Schema SameAs Integration**
 * For any Person entity with LinkedIn URL provided,
 * the generated schema SHALL include the LinkedIn URL in the sameAs array.
 */
export function createPersonSchema(
  name: string,
  options?: {
    linkedInUrl?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    credentials?: string[];
    sameAs?: string[];
  }
): SchemaEntity {
  const person: SchemaEntity = {
    '@type': 'Person',
    name
  };
  
  // Build sameAs array
  const sameAs: string[] = [];
  
  if (options?.linkedInUrl) {
    sameAs.push(options.linkedInUrl);
  }
  if (options?.twitterUrl) {
    sameAs.push(options.twitterUrl);
  }
  if (options?.websiteUrl) {
    sameAs.push(options.websiteUrl);
  }
  if (options?.sameAs) {
    sameAs.push(...options.sameAs);
  }
  
  if (sameAs.length > 0) {
    person.sameAs = sameAs;
  }
  
  if (options?.credentials && options.credentials.length > 0) {
    person.jobTitle = options.credentials[0];
    if (options.credentials.length > 1) {
      person.knowsAbout = options.credentials.slice(1);
    }
  }
  
  return person;
}

// =============================================================================
// HowTo Schema Generation
// =============================================================================

/**
 * Extract steps from content for HowTo schema.
 */
export function extractHowToSteps(content: string): Array<{ name: string; text: string }> {
  const steps: Array<{ name: string; text: string }> = [];
  
  // Pattern 1: Numbered steps (1. Step text)
  const numberedPattern = /^\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|$)/gm;
  let match;
  while ((match = numberedPattern.exec(content)) !== null) {
    steps.push({
      name: `Step ${match[1]}`,
      text: match[2].trim()
    });
  }
  
  if (steps.length > 0) return steps;
  
  // Pattern 2: Step N: text
  const stepPattern = /step\s+(\d+)[:.]\s*(.+?)(?=step\s+\d+|$)/gi;
  while ((match = stepPattern.exec(content)) !== null) {
    steps.push({
      name: `Step ${match[1]}`,
      text: match[2].trim()
    });
  }
  
  if (steps.length > 0) return steps;
  
  // Pattern 3: First, Second, Third, etc.
  const ordinalPattern = /(?:first|second|third|fourth|fifth|next|then|finally)[,:]?\s+(.+?)(?=(?:first|second|third|fourth|fifth|next|then|finally)[,:]|$)/gi;
  let stepNum = 1;
  while ((match = ordinalPattern.exec(content)) !== null) {
    steps.push({
      name: `Step ${stepNum}`,
      text: match[1].trim()
    });
    stepNum++;
  }
  
  return steps;
}

/**
 * Generate HowTo schema from content.
 * 
 * **Property 25: Entity Type Detection Accuracy**
 * For any content with clear entity signals (step-by-step content for HowTo),
 * the SchemaGenerator SHALL detect the correct primary entity type.
 */
export function generateHowToSchema(
  title: string,
  content: string,
  options?: {
    description?: string;
    totalTime?: string;
    estimatedCost?: { value: number; currency: string };
    supply?: string[];
    tool?: string[];
  }
): SchemaEntity {
  const steps = extractHowToSteps(content);
  
  const howTo: SchemaEntity = {
    '@type': 'HowTo',
    name: title,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text
    }))
  };
  
  if (options?.description) {
    howTo.description = options.description;
  }
  
  if (options?.totalTime) {
    howTo.totalTime = options.totalTime;
  }
  
  if (options?.estimatedCost) {
    howTo.estimatedCost = {
      '@type': 'MonetaryAmount',
      value: options.estimatedCost.value,
      currency: options.estimatedCost.currency
    };
  }
  
  if (options?.supply && options.supply.length > 0) {
    howTo.supply = options.supply.map(s => ({
      '@type': 'HowToSupply',
      name: s
    }));
  }
  
  if (options?.tool && options.tool.length > 0) {
    howTo.tool = options.tool.map(t => ({
      '@type': 'HowToTool',
      name: t
    }));
  }
  
  return howTo;
}

// =============================================================================
// Round-Trip Validation
// =============================================================================

/**
 * Validate schema round-trip consistency.
 * Serializes to JSON-LD, parses back, and compares.
 * 
 * **Property 28: Schema Round-Trip Consistency**
 * For any valid GeneratedSchema object, serializing to JSON-LD string
 * and parsing back SHALL produce an object deeply equal to the original.
 */
export function validateRoundTrip(schema: GeneratedSchema): boolean {
  try {
    const serialized = serialize(schema);
    const parsed = parse(serialized);
    
    // Deep comparison
    return JSON.stringify(schema) === JSON.stringify(parsed);
  } catch {
    return false;
  }
}

/**
 * Perform round-trip and return both original and parsed for comparison.
 */
export function roundTrip(schema: GeneratedSchema): {
  original: GeneratedSchema;
  serialized: string;
  parsed: GeneratedSchema;
  isEqual: boolean;
} {
  const serialized = serialize(schema);
  const parsed = parse(serialized);
  const isEqual = JSON.stringify(schema) === JSON.stringify(parsed);
  
  return {
    original: schema,
    serialized,
    parsed,
    isEqual
  };
}
