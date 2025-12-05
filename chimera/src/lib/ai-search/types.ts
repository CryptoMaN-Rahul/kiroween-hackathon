/**
 * AI Search Optimization - Type Definitions
 *
 * These types define the contracts for AI search optimization components
 * including llms.txt generation, semantic synonyms, quotable snippets,
 * AEO optimization, citation scoring, and content deduplication.
 *
 * Requirements: 1.1, 3.1, 4.1, 5.1, 6.1, 7.1
 */

// =============================================================================
// llms.txt Generator Types (Requirement 1.1)
// =============================================================================

export interface LLMsConfig {
  siteName: string;
  siteDescription: string;
  baseUrl: string;
  includeApiEndpoints: boolean;
  maxQuickFacts: number;
}

export interface RouteEntry {
  path: string;
  description: string;
}

export interface ApiEntry {
  method: string;
  path: string;
  description: string;
}

export interface LLMsContent {
  header: string;
  quickFacts: string[];
  routes: RouteEntry[];
  apiEndpoints: ApiEntry[];
  lastGenerated: Date;
}

// =============================================================================
// Semantic Synonym Dictionary Types (Requirement 2.1)
// =============================================================================

export interface SynonymGroup {
  canonical: string;
  synonyms: string[];
  weight: number; // Default 0.8
}

// =============================================================================
// Quotable Snippet Extractor Types (Requirement 3.1)
// =============================================================================

export interface QuotableSnippet {
  text: string;
  source: string;
  citationScore: number; // 0-100
  hasStatistic: boolean;
  hasUniqueData: boolean;
  characterCount: number;
  suggestedImprovements: string[];
}


/** Scoring weights for snippet evaluation */
export const SNIPPET_WEIGHTS = {
  hasStatistic: 30,      // Contains numbers/percentages
  isUnique: 25,          // Not commodity content
  isSpecific: 20,        // Names specific things
  isConcise: 15,         // Under 280 chars
  hasAttribution: 10     // Cites a source
} as const;

/** Regex patterns for statistic detection */
export const STATISTIC_PATTERNS: RegExp[] = [
  /\d+%/,                                    // Percentages
  /\d+x/i,                                   // Multipliers (2x, 10x)
  /\$[\d,]+/,                                // Dollar amounts
  /\d+\s*(million|billion|thousand)/i,       // Large numbers
  /\d+\s*(users|customers|clients)/i,        // User counts
  /\d+\s*(days|hours|minutes|seconds)/i,     // Time metrics
  /increased?\s+by\s+\d+/i,                  // Increase statements
  /decreased?\s+by\s+\d+/i,                  // Decrease statements
  /\d+\s*-\s*\d+/,                           // Ranges
];

// =============================================================================
// AEO Optimizer Types (Requirement 4.1)
// =============================================================================

export interface FAQItem {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

export interface FAQSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: FAQItem[];
}

export interface HowToStep {
  '@type': 'HowToStep';
  position: number;
  name: string;
  text: string;
}

export interface HowToSchema {
  '@context': 'https://schema.org';
  '@type': 'HowTo';
  name: string;
  step: HowToStep[];
}

export interface AEOResult {
  faqSchema: FAQSchema | null;
  howToSchema: HowToSchema | null;
  featuredSnippetCandidate: string | null;
  voiceReadyScore: number; // 0-100
  suggestions: string[];
}

/** Q&A detection patterns */
export const QA_PATTERNS: RegExp[] = [
  /^(what|how|why|when|where|who|which|can|does|is|are|will|should)\s+.+\?/im,
  /^\*\*Q:\*\*\s*.+/m,
  /^Q:\s*.+/m,
  /^Question:\s*.+/im,
];

/** Step detection patterns */
export const STEP_PATTERNS: RegExp[] = [
  /^(\d+)\.\s+(.+)/m,           // 1. Step text
  /^Step\s+(\d+):\s*(.+)/im,    // Step 1: text
  /^-\s+(.+)/m,                 // - Bullet point
];

// =============================================================================
// AI Manifest Generator Types (Requirement 5.1)
// =============================================================================

export interface ManifestRoute {
  path: string;
  description: string;
  methods?: string[];
}

export interface Intent {
  name: string;
  description: string;
  examples: string[];
}

export interface Entity {
  name: string;
  type: string;
  description: string;
}

export interface AIManifest {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  routes: ManifestRoute[];
  intents: Intent[];
  entities: Entity[];
  lastUpdated: string;
}

export interface ManifestConfig {
  siteName: string;
  siteDescription: string;
  version: string;
  capabilities: string[];
}


// =============================================================================
// Citation Score Calculator Types (Requirement 6.1)
// =============================================================================

export interface CitationScoreBreakdown {
  uniqueData: number;        // 0-40
  sourceAttribution: number; // 0-20
  quotableSnippets: number;  // 0-20
  schemaCoverage: number;    // 0-20
}

export interface CitationScore {
  total: number; // 0-100
  breakdown: CitationScoreBreakdown;
  recommendations: string[];
}

export interface RankedPage {
  url: string;
  citationScore: number;
  topSnippet: string;
}

/** Recommendation templates for citation improvements */
export const CITATION_RECOMMENDATIONS = {
  lowUniqueData: 'Add specific statistics, case studies, or original research to increase unique data score',
  lowAttribution: 'Include source citations and methodology descriptions for claims',
  lowSnippets: 'Create more concise, quotable statements under 280 characters',
  lowSchema: 'Add FAQ or HowTo structured data to improve schema coverage',
} as const;

// =============================================================================
// Deduplication Detector Types (Requirement 7.1)
// =============================================================================

export interface DedupResult {
  commodityPhrasePercentage: number;
  isLowDifferentiation: boolean; // true if > 30%
  commodityPhrases: string[];
  citationAnchors: string[];
  suggestions: string[];
}

/** Common commodity phrases that provide no differentiation */
export const COMMODITY_PHRASES: string[] = [
  'industry-leading',
  'best-in-class',
  'cutting-edge',
  'state-of-the-art',
  'world-class',
  'innovative solutions',
  'customer-centric',
  'seamless experience',
  'next-generation',
  'game-changing',
  'revolutionary',
  'unparalleled',
  'comprehensive solution',
  'end-to-end',
  'holistic approach',
  'synergy',
  'leverage',
  'paradigm shift',
  'best practices',
  'value-added',
  'mission-critical',
  'scalable solution',
  'robust platform',
  'turnkey solution',
];

// =============================================================================
// Page Content Model
// =============================================================================

export interface Statistic {
  value: string;
  context: string;
  source?: string;
}

export interface PageContent {
  url: string;
  title: string;
  description: string;
  content: string;
  headings: string[];
  statistics: Statistic[];
  lastModified: Date;
}

// =============================================================================
// Analysis Result Model
// =============================================================================

export interface AISearchAnalysis {
  url: string;
  citationScore: CitationScore;
  aeoResult: AEOResult;
  geoScore: number;
  quotableSnippets: QuotableSnippet[];
  dedupResult: DedupResult;
  recommendations: string[];
}

// =============================================================================
// Built-in Synonym Groups (Requirement 2.1)
// =============================================================================

export const BUILTIN_SYNONYMS: SynonymGroup[] = [
  { canonical: 'phone', synonyms: ['smartphone', 'mobile', 'cell', 'handset'], weight: 0.8 },
  { canonical: 'buy', synonyms: ['purchase', 'shop', 'order', 'get', 'acquire'], weight: 0.8 },
  { canonical: 'docs', synonyms: ['documentation', 'guide', 'manual', 'reference', 'help'], weight: 0.8 },
  { canonical: 'auth', synonyms: ['authentication', 'login', 'signin', 'sign-in', 'access'], weight: 0.8 },
  { canonical: 'api', synonyms: ['endpoint', 'service', 'interface', 'rest'], weight: 0.8 },
  { canonical: 'price', synonyms: ['cost', 'pricing', 'rate', 'fee', 'charge'], weight: 0.8 },
  { canonical: 'contact', synonyms: ['support', 'help', 'reach', 'email', 'call'], weight: 0.8 },
  { canonical: 'about', synonyms: ['company', 'team', 'who', 'story', 'mission'], weight: 0.8 },
];
