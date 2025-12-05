/**
 * Commodity Phrase Dictionary
 * 
 * Configurable dictionary of commodity phrases (marketing fluff) that
 * reduce content quality scores. Supports industry-specific phrase lists
 * and custom weights.
 * 
 * @module commodity-phrases
 */

// =============================================================================
// Types
// =============================================================================

export interface CommodityPhrase {
  /** The phrase to detect (case-insensitive) */
  phrase: string;
  /** Weight/severity (0-1, higher = more fluffy) */
  weight: number;
  /** Category for grouping */
  category: PhraseCategory;
}

export type PhraseCategory = 
  | 'filler'           // Generic filler phrases
  | 'marketing'        // Marketing buzzwords
  | 'corporate'        // Corporate jargon
  | 'tech-buzzword'    // Tech industry buzzwords
  | 'urgency'          // Fake urgency phrases
  | 'superlative'      // Exaggerated claims
  | 'vague';           // Vague/meaningless phrases

export interface CommodityPhraseConfig {
  /** Custom phrases to add */
  customPhrases?: CommodityPhrase[];
  /** Phrases to exclude from default list */
  excludePhrases?: string[];
  /** Categories to include (default: all) */
  includeCategories?: PhraseCategory[];
  /** Categories to exclude */
  excludeCategories?: PhraseCategory[];
  /** Minimum weight threshold (default: 0) */
  minWeight?: number;
}

export interface PhraseMatch {
  phrase: string;
  weight: number;
  category: PhraseCategory;
  count: number;
}

// =============================================================================
// Default Phrase Database
// =============================================================================

/**
 * Default commodity phrases with weights and categories.
 * Weight scale:
 * - 0.3-0.4: Mild fluff (sometimes acceptable)
 * - 0.5-0.6: Moderate fluff (should be avoided)
 * - 0.7-0.8: Heavy fluff (definitely remove)
 * - 0.9-1.0: Extreme fluff (red flag)
 */
export const DEFAULT_COMMODITY_PHRASES: CommodityPhrase[] = [
  // ==========================================================================
  // Filler phrases (0.3-0.5)
  // ==========================================================================
  { phrase: 'in today\'s world', weight: 0.4, category: 'filler' },
  { phrase: 'it is important to note', weight: 0.3, category: 'filler' },
  { phrase: 'as we all know', weight: 0.4, category: 'filler' },
  { phrase: 'needless to say', weight: 0.4, category: 'filler' },
  { phrase: 'at the end of the day', weight: 0.5, category: 'filler' },
  { phrase: 'in conclusion', weight: 0.3, category: 'filler' },
  { phrase: 'to sum up', weight: 0.3, category: 'filler' },
  { phrase: 'in summary', weight: 0.3, category: 'filler' },
  { phrase: 'first and foremost', weight: 0.4, category: 'filler' },
  { phrase: 'last but not least', weight: 0.4, category: 'filler' },
  { phrase: 'without a doubt', weight: 0.5, category: 'filler' },
  { phrase: 'it goes without saying', weight: 0.5, category: 'filler' },
  { phrase: 'as a matter of fact', weight: 0.4, category: 'filler' },
  { phrase: 'for all intents and purposes', weight: 0.5, category: 'filler' },
  { phrase: 'in order to', weight: 0.3, category: 'filler' },
  { phrase: 'due to the fact that', weight: 0.4, category: 'filler' },
  { phrase: 'at this point in time', weight: 0.5, category: 'filler' },
  { phrase: 'in the event that', weight: 0.4, category: 'filler' },
  { phrase: 'on a daily basis', weight: 0.4, category: 'filler' },
  { phrase: 'in the near future', weight: 0.4, category: 'filler' },
  
  // ==========================================================================
  // Marketing buzzwords (0.5-0.8)
  // ==========================================================================
  { phrase: 'state of the art', weight: 0.6, category: 'marketing' },
  { phrase: 'cutting edge', weight: 0.6, category: 'marketing' },
  { phrase: 'best in class', weight: 0.7, category: 'marketing' },
  { phrase: 'world class', weight: 0.7, category: 'marketing' },
  { phrase: 'industry leading', weight: 0.7, category: 'marketing' },
  { phrase: 'next generation', weight: 0.5, category: 'marketing' },
  { phrase: 'game changing', weight: 0.7, category: 'marketing' },
  { phrase: 'revolutionary', weight: 0.7, category: 'marketing' },
  { phrase: 'innovative solution', weight: 0.6, category: 'marketing' },
  { phrase: 'seamless experience', weight: 0.6, category: 'marketing' },
  { phrase: 'robust platform', weight: 0.5, category: 'marketing' },
  { phrase: 'scalable solution', weight: 0.5, category: 'marketing' },
  { phrase: 'turnkey solution', weight: 0.6, category: 'marketing' },
  { phrase: 'end-to-end solution', weight: 0.5, category: 'marketing' },
  { phrase: 'one-stop shop', weight: 0.6, category: 'marketing' },
  { phrase: 'best of breed', weight: 0.7, category: 'marketing' },
  { phrase: 'mission critical', weight: 0.5, category: 'marketing' },
  { phrase: 'enterprise grade', weight: 0.5, category: 'marketing' },
  
  // ==========================================================================
  // Corporate jargon (0.5-0.7)
  // ==========================================================================
  { phrase: 'leverage synergies', weight: 0.8, category: 'corporate' },
  { phrase: 'move the needle', weight: 0.7, category: 'corporate' },
  { phrase: 'low hanging fruit', weight: 0.6, category: 'corporate' },
  { phrase: 'think outside the box', weight: 0.7, category: 'corporate' },
  { phrase: 'paradigm shift', weight: 0.7, category: 'corporate' },
  { phrase: 'value proposition', weight: 0.5, category: 'corporate' },
  { phrase: 'core competency', weight: 0.5, category: 'corporate' },
  { phrase: 'best practices', weight: 0.4, category: 'corporate' },
  { phrase: 'going forward', weight: 0.5, category: 'corporate' },
  { phrase: 'circle back', weight: 0.6, category: 'corporate' },
  { phrase: 'touch base', weight: 0.6, category: 'corporate' },
  { phrase: 'deep dive', weight: 0.5, category: 'corporate' },
  { phrase: 'take it offline', weight: 0.6, category: 'corporate' },
  { phrase: 'bandwidth', weight: 0.4, category: 'corporate' },
  { phrase: 'synergy', weight: 0.7, category: 'corporate' },
  { phrase: 'holistic approach', weight: 0.6, category: 'corporate' },
  { phrase: 'actionable insights', weight: 0.5, category: 'corporate' },
  { phrase: 'key takeaways', weight: 0.4, category: 'corporate' },
  
  // ==========================================================================
  // Tech buzzwords (0.4-0.7)
  // ==========================================================================
  { phrase: 'ai-powered', weight: 0.5, category: 'tech-buzzword' },
  { phrase: 'blockchain-based', weight: 0.6, category: 'tech-buzzword' },
  { phrase: 'cloud-native', weight: 0.4, category: 'tech-buzzword' },
  { phrase: 'data-driven', weight: 0.4, category: 'tech-buzzword' },
  { phrase: 'machine learning', weight: 0.3, category: 'tech-buzzword' },
  { phrase: 'digital transformation', weight: 0.5, category: 'tech-buzzword' },
  { phrase: 'disruptive technology', weight: 0.6, category: 'tech-buzzword' },
  { phrase: 'future-proof', weight: 0.6, category: 'tech-buzzword' },
  { phrase: 'hyper-scale', weight: 0.6, category: 'tech-buzzword' },
  { phrase: 'next-gen', weight: 0.5, category: 'tech-buzzword' },
  
  // ==========================================================================
  // Urgency phrases (0.7-0.9)
  // ==========================================================================
  { phrase: 'act now', weight: 0.8, category: 'urgency' },
  { phrase: 'limited time', weight: 0.7, category: 'urgency' },
  { phrase: 'exclusive offer', weight: 0.7, category: 'urgency' },
  { phrase: 'special deal', weight: 0.7, category: 'urgency' },
  { phrase: 'hurry', weight: 0.8, category: 'urgency' },
  { phrase: 'don\'t miss out', weight: 0.8, category: 'urgency' },
  { phrase: 'once in a lifetime', weight: 0.9, category: 'urgency' },
  { phrase: 'while supplies last', weight: 0.7, category: 'urgency' },
  { phrase: 'order now', weight: 0.7, category: 'urgency' },
  { phrase: 'limited availability', weight: 0.6, category: 'urgency' },
  
  // ==========================================================================
  // Superlatives (0.6-0.9)
  // ==========================================================================
  { phrase: 'amazing', weight: 0.6, category: 'superlative' },
  { phrase: 'incredible', weight: 0.6, category: 'superlative' },
  { phrase: 'unbelievable', weight: 0.7, category: 'superlative' },
  { phrase: 'fantastic', weight: 0.6, category: 'superlative' },
  { phrase: 'awesome', weight: 0.5, category: 'superlative' },
  { phrase: 'mind-blowing', weight: 0.8, category: 'superlative' },
  { phrase: 'groundbreaking', weight: 0.7, category: 'superlative' },
  { phrase: 'unprecedented', weight: 0.6, category: 'superlative' },
  { phrase: 'best ever', weight: 0.8, category: 'superlative' },
  { phrase: 'like never before', weight: 0.7, category: 'superlative' },
  { phrase: 'one of a kind', weight: 0.6, category: 'superlative' },
  { phrase: 'second to none', weight: 0.7, category: 'superlative' },
  { phrase: 'top notch', weight: 0.6, category: 'superlative' },
  { phrase: 'world-renowned', weight: 0.7, category: 'superlative' },
  { phrase: 'highly acclaimed', weight: 0.6, category: 'superlative' },
  { phrase: 'award-winning', weight: 0.4, category: 'superlative' },
  
  // ==========================================================================
  // Vague phrases (0.4-0.6)
  // ==========================================================================
  { phrase: 'various', weight: 0.4, category: 'vague' },
  { phrase: 'numerous', weight: 0.4, category: 'vague' },
  { phrase: 'significant', weight: 0.3, category: 'vague' },
  { phrase: 'substantial', weight: 0.3, category: 'vague' },
  { phrase: 'considerable', weight: 0.3, category: 'vague' },
  { phrase: 'a lot of', weight: 0.4, category: 'vague' },
  { phrase: 'many people', weight: 0.4, category: 'vague' },
  { phrase: 'some experts', weight: 0.5, category: 'vague' },
  { phrase: 'studies show', weight: 0.5, category: 'vague' },
  { phrase: 'research suggests', weight: 0.4, category: 'vague' },
  { phrase: 'it is believed', weight: 0.5, category: 'vague' },
  { phrase: 'generally speaking', weight: 0.4, category: 'vague' },
];

// =============================================================================
// Industry-Specific Phrase Lists
// =============================================================================

/**
 * Additional phrases for specific industries.
 * Use these to customize detection for your content type.
 */
export const INDUSTRY_PHRASES: Record<string, CommodityPhrase[]> = {
  'saas': [
    { phrase: 'saas solution', weight: 0.4, category: 'tech-buzzword' },
    { phrase: 'subscription-based', weight: 0.3, category: 'tech-buzzword' },
    { phrase: 'multi-tenant', weight: 0.3, category: 'tech-buzzword' },
    { phrase: 'api-first', weight: 0.3, category: 'tech-buzzword' },
    { phrase: 'no-code', weight: 0.4, category: 'tech-buzzword' },
    { phrase: 'low-code', weight: 0.4, category: 'tech-buzzword' },
  ],
  'ecommerce': [
    { phrase: 'free shipping', weight: 0.3, category: 'marketing' },
    { phrase: 'satisfaction guaranteed', weight: 0.5, category: 'marketing' },
    { phrase: 'money back guarantee', weight: 0.4, category: 'marketing' },
    { phrase: 'best seller', weight: 0.4, category: 'marketing' },
    { phrase: 'customer favorite', weight: 0.5, category: 'marketing' },
  ],
  'finance': [
    { phrase: 'financial freedom', weight: 0.7, category: 'marketing' },
    { phrase: 'passive income', weight: 0.6, category: 'marketing' },
    { phrase: 'wealth building', weight: 0.6, category: 'marketing' },
    { phrase: 'guaranteed returns', weight: 0.9, category: 'urgency' },
    { phrase: 'risk-free', weight: 0.8, category: 'marketing' },
  ],
  'health': [
    { phrase: 'clinically proven', weight: 0.5, category: 'marketing' },
    { phrase: 'doctor recommended', weight: 0.5, category: 'marketing' },
    { phrase: 'all natural', weight: 0.6, category: 'marketing' },
    { phrase: 'miracle cure', weight: 0.9, category: 'superlative' },
    { phrase: 'instant results', weight: 0.8, category: 'urgency' },
  ],
};

// =============================================================================
// Commodity Phrase Dictionary
// =============================================================================

export interface CommodityPhraseDictionary {
  /** Check if content contains commodity phrases */
  analyze(content: string): PhraseMatch[];
  /** Get total fluff score for content (0-100) */
  getFluffScore(content: string): number;
  /** Add custom phrases */
  addPhrases(phrases: CommodityPhrase[]): void;
  /** Remove phrases by text */
  removePhrases(phraseTexts: string[]): void;
  /** Get all phrases */
  getAllPhrases(): CommodityPhrase[];
  /** Get phrases by category */
  getByCategory(category: PhraseCategory): CommodityPhrase[];
}

/**
 * Create a configurable commodity phrase dictionary.
 */
export function createCommodityPhraseDictionary(
  config: CommodityPhraseConfig = {}
): CommodityPhraseDictionary {
  const {
    customPhrases = [],
    excludePhrases = [],
    includeCategories,
    excludeCategories = [],
    minWeight = 0
  } = config;
  
  // Build phrase list
  let phrases: CommodityPhrase[] = [...DEFAULT_COMMODITY_PHRASES];
  
  // Add custom phrases
  phrases.push(...customPhrases);
  
  // Filter by categories
  if (includeCategories && includeCategories.length > 0) {
    phrases = phrases.filter(p => includeCategories.includes(p.category));
  }
  if (excludeCategories.length > 0) {
    phrases = phrases.filter(p => !excludeCategories.includes(p.category));
  }
  
  // Filter by weight
  phrases = phrases.filter(p => p.weight >= minWeight);
  
  // Remove excluded phrases
  const excludeSet = new Set(excludePhrases.map(p => p.toLowerCase()));
  phrases = phrases.filter(p => !excludeSet.has(p.phrase.toLowerCase()));
  
  // Build lookup map for efficient matching
  const phraseMap = new Map<string, CommodityPhrase>();
  for (const phrase of phrases) {
    phraseMap.set(phrase.phrase.toLowerCase(), phrase);
  }
  
  return {
    analyze(content: string): PhraseMatch[] {
      const matches: PhraseMatch[] = [];
      const lowerContent = content.toLowerCase();
      
      for (const phrase of phrases) {
        const lowerPhrase = phrase.phrase.toLowerCase();
        let count = 0;
        let pos = 0;
        
        while ((pos = lowerContent.indexOf(lowerPhrase, pos)) !== -1) {
          count++;
          pos += lowerPhrase.length;
        }
        
        if (count > 0) {
          matches.push({
            phrase: phrase.phrase,
            weight: phrase.weight,
            category: phrase.category,
            count
          });
        }
      }
      
      // Sort by weight * count (most impactful first)
      matches.sort((a, b) => (b.weight * b.count) - (a.weight * a.count));
      
      return matches;
    },
    
    getFluffScore(content: string): number {
      const matches = this.analyze(content);
      
      if (matches.length === 0) return 0;
      
      // Calculate weighted score
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;
      
      if (wordCount === 0) return 0;
      
      // Sum of (weight * count * phrase_word_count)
      let fluffyWordCount = 0;
      let totalWeight = 0;
      
      for (const match of matches) {
        const phraseWords = match.phrase.split(/\s+/).length;
        fluffyWordCount += phraseWords * match.count;
        totalWeight += match.weight * match.count;
      }
      
      // Combine percentage and weight factors
      const percentageFactor = (fluffyWordCount / wordCount) * 100;
      const weightFactor = (totalWeight / matches.length) * 100;
      
      // Weighted combination (60% percentage, 40% severity)
      const score = (percentageFactor * 0.6) + (weightFactor * 0.4);
      
      return Math.min(100, Math.round(score));
    },
    
    addPhrases(newPhrases: CommodityPhrase[]): void {
      for (const phrase of newPhrases) {
        const key = phrase.phrase.toLowerCase();
        if (!phraseMap.has(key)) {
          phrases.push(phrase);
          phraseMap.set(key, phrase);
        }
      }
    },
    
    removePhrases(phraseTexts: string[]): void {
      const removeSet = new Set(phraseTexts.map(p => p.toLowerCase()));
      phrases = phrases.filter(p => !removeSet.has(p.phrase.toLowerCase()));
      for (const text of phraseTexts) {
        phraseMap.delete(text.toLowerCase());
      }
    },
    
    getAllPhrases(): CommodityPhrase[] {
      return [...phrases];
    },
    
    getByCategory(category: PhraseCategory): CommodityPhrase[] {
      return phrases.filter(p => p.category === category);
    }
  };
}

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * Default dictionary instance for quick usage.
 */
let defaultDictionary: CommodityPhraseDictionary | null = null;

export function getDefaultDictionary(): CommodityPhraseDictionary {
  if (!defaultDictionary) {
    defaultDictionary = createCommodityPhraseDictionary();
  }
  return defaultDictionary;
}

/**
 * Quick analysis using default dictionary.
 */
export function analyzeCommodityPhrases(content: string): PhraseMatch[] {
  return getDefaultDictionary().analyze(content);
}

/**
 * Quick fluff score using default dictionary.
 */
export function getFluffScore(content: string): number {
  return getDefaultDictionary().getFluffScore(content);
}
