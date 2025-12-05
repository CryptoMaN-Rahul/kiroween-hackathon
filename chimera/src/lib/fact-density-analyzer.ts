/**
 * Fact-Density Analyzer
 * 
 * Analyzes content for AI scannability and suggests improvements.
 * This is the GEO "linter" that helps make content more AI-friendly.
 * 
 * @module fact-density-analyzer
 */

import nlp from 'compromise';
import type {
  FactDensityResult,
  ContentBreakdown,
  Suggestion,
  JustificationLevel
} from '@/types';

// =============================================================================
// Information Gain Types
// =============================================================================

/**
 * Result of Information Gain analysis.
 */
export interface InformationGainResult {
  /** Score from 0-100 indicating information density */
  score: number;
  /** Unique entities extracted from content */
  uniqueEntities: string[];
  /** Percentage of content that is commodity phrases */
  commodityPhrasePercentage: number;
  /** Commodity phrases found in content */
  commodityPhrases: string[];
}

/**
 * Result of Inverted Pyramid analysis.
 */
export interface InvertedPyramidResult {
  /** Score from 0-100 indicating how well content follows inverted pyramid */
  score: number;
  /** Word position where main answer/key info appears */
  answerPosition: number;
  /** Whether answer appears in optimal position (first 50-100 words) */
  isOptimal: boolean;
}

/**
 * Result of Fluff detection.
 */
export interface FluffDetectionResult {
  /** Score from 0-100, higher = more fluffy */
  score: number;
  /** Fluffy phrases found in content */
  phrases: string[];
}

/**
 * Weights for different content elements in score calculation
 */
const ELEMENT_WEIGHTS = {
  tables: 0.25,
  bulletLists: 0.20,
  statistics: 0.25,
  headers: 0.15,
  headerHierarchy: 0.15
};

/**
 * Regex patterns for content detection
 */
const PATTERNS = {
  // Markdown table detection
  table: /\|[^|]+\|/gm,
  tableRow: /^\s*\|.*\|\s*$/gm,
  // Table separator: |---|---| or |:---|:---:| etc. (multiple columns)
  tableSeparator: /^\s*\|[\s:-]+(?:\|[\s:-]+)+\|\s*$/gm,
  
  // Bullet list detection
  bulletList: /^[\s]*[-*+]\s+.+$/gm,
  numberedList: /^[\s]*\d+\.\s+.+$/gm,
  
  // Statistics detection (numbers with context)
  percentage: /\d+(?:\.\d+)?%/g,
  currency: /\$[\d,]+(?:\.\d{2})?/g,
  largeNumber: /\b\d{1,3}(?:,\d{3})+\b/g,
  measurement: /\d+(?:\.\d+)?\s*(?:kg|lb|oz|g|ml|L|m|cm|mm|ft|in|mph|km\/h)/gi,
  year: /\b(?:19|20)\d{2}\b/g,
  
  // Header detection
  markdownHeader: /^#{1,6}\s+.+$/gm,
  htmlHeader: /<h([1-6])[^>]*>.*?<\/h\1>/gi,
  
  // Entity detection (proper nouns, brands, products)
  properNoun: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
  brandName: /\b(?:Apple|Google|Microsoft|Amazon|Tesla|Samsung|Sony|Nike|Adidas)\b/gi,
  productName: /\b(?:iPhone|iPad|MacBook|Pixel|Galaxy|PlayStation|Xbox|AirPods)\b/gi,
  
  // JSON-LD detection
  jsonLd: /<script[^>]*type=["']application\/ld\+json["'][^>]*>/gi,
  
  // Pros/Cons detection
  prosConsSection: /(?:pros|cons|advantages|disadvantages|benefits|drawbacks)[\s:]/gi,
  
  // Bold attributes (markdown)
  boldText: /\*\*[^*]+\*\*/g
};

/**
 * Common commodity phrases that add little unique value
 */
const COMMODITY_PHRASES = [
  'in today\'s world',
  'it is important to note',
  'as we all know',
  'needless to say',
  'at the end of the day',
  'in conclusion',
  'to sum up',
  'in summary',
  'first and foremost',
  'last but not least',
  'without a doubt',
  'it goes without saying',
  'as a matter of fact',
  'for all intents and purposes',
  'in order to',
  'due to the fact that',
  'at this point in time',
  'in the event that',
  'on a daily basis',
  'in the near future',
  'state of the art',
  'cutting edge',
  'best in class',
  'world class',
  'industry leading',
  'next generation',
  'game changing',
  'revolutionary',
  'innovative solution',
  'seamless experience',
  'robust platform',
  'scalable solution',
  'leverage synergies',
  'move the needle',
  'low hanging fruit',
  'think outside the box',
  'paradigm shift',
  'value proposition',
  'core competency',
  'best practices',
  'going forward',
  'circle back',
  'touch base',
  'deep dive',
  'take it offline'
];

/**
 * Fluffy marketing phrases without substance
 */
const FLUFFY_PHRASES = [
  'amazing',
  'incredible',
  'unbelievable',
  'fantastic',
  'awesome',
  'mind-blowing',
  'game-changer',
  'revolutionary',
  'groundbreaking',
  'unprecedented',
  'best ever',
  'like never before',
  'one of a kind',
  'second to none',
  'top notch',
  'world-renowned',
  'highly acclaimed',
  'award-winning',
  'must-have',
  'can\'t miss',
  'don\'t miss out',
  'act now',
  'limited time',
  'exclusive offer',
  'special deal',
  'hurry',
  'amazing opportunity',
  'once in a lifetime',
  'you won\'t believe',
  'secret',
  'shocking',
  'jaw-dropping'
];

/**
 * Count tables in content
 */
export function countTables(content: string): number {
  const rows = content.match(PATTERNS.tableRow) || [];
  const separators = content.match(PATTERNS.tableSeparator) || [];
  
  // A table needs at least a header row, separator, and one data row
  if (rows.length >= 3 && separators.length >= 1) {
    // Count table blocks by finding separator rows
    return separators.length;
  }
  
  return 0;
}

/**
 * Count bullet lists in content
 */
export function countBulletLists(content: string): number {
  // Group consecutive list items into lists
  let listCount = 0;
  const lines = content.split('\n');
  let inList = false;
  
  for (const line of lines) {
    const isBullet = PATTERNS.bulletList.test(line) || PATTERNS.numberedList.test(line);
    // Reset regex lastIndex
    PATTERNS.bulletList.lastIndex = 0;
    PATTERNS.numberedList.lastIndex = 0;
    
    if (isBullet && !inList) {
      listCount++;
      inList = true;
    } else if (!isBullet && line.trim() !== '') {
      inList = false;
    }
  }
  
  return listCount;
}

/**
 * Count statistics/quantitative data in content
 */
export function countStatistics(content: string): number {
  const percentages = content.match(PATTERNS.percentage) || [];
  const currencies = content.match(PATTERNS.currency) || [];
  const largeNumbers = content.match(PATTERNS.largeNumber) || [];
  const measurements = content.match(PATTERNS.measurement) || [];
  
  // Deduplicate overlapping matches
  const allStats = new Set([
    ...percentages,
    ...currencies,
    ...largeNumbers,
    ...measurements
  ]);
  
  return allStats.size;
}

/**
 * Extract header levels from content
 */
export function extractHeaderLevels(content: string): number[] {
  const levels: number[] = [];
  
  // Markdown headers
  const mdHeaders = content.match(PATTERNS.markdownHeader) || [];
  for (const header of mdHeaders) {
    const match = header.match(/^(#{1,6})/);
    if (match) {
      levels.push(match[1].length);
    }
  }
  
  // HTML headers
  let htmlMatch;
  const htmlPattern = /<h([1-6])[^>]*>/gi;
  while ((htmlMatch = htmlPattern.exec(content)) !== null) {
    levels.push(parseInt(htmlMatch[1], 10));
  }
  
  return levels;
}

/**
 * Validate header hierarchy (no skipped levels)
 */
export function validateHeaderHierarchy(levels: number[]): boolean {
  if (levels.length === 0) return true;
  
  // Sort by position (already in order from extraction)
  let lastLevel = 0;
  
  for (const level of levels) {
    // First header can be any level
    if (lastLevel === 0) {
      lastLevel = level;
      continue;
    }
    
    // Going deeper: can only go one level at a time
    if (level > lastLevel && level > lastLevel + 1) {
      return false; // Skipped a level (e.g., H1 -> H3)
    }
    
    lastLevel = level;
  }
  
  return true;
}

/**
 * Analyze content and return breakdown
 */
export function analyzeContent(content: string): ContentBreakdown {
  const headerLevels = extractHeaderLevels(content);
  
  return {
    tables: countTables(content),
    bulletLists: countBulletLists(content),
    statistics: countStatistics(content),
    headers: headerLevels.length,
    headerHierarchyValid: validateHeaderHierarchy(headerLevels),
    headerLevels
  };
}

/**
 * Calculate scannability score from breakdown
 */
export function calculateScore(breakdown: ContentBreakdown): number {
  // Normalize each element count to 0-1 range
  const tableScore = Math.min(breakdown.tables / 2, 1); // 2+ tables = max
  const listScore = Math.min(breakdown.bulletLists / 3, 1); // 3+ lists = max
  const statsScore = Math.min(breakdown.statistics / 5, 1); // 5+ stats = max
  const headerScore = Math.min(breakdown.headers / 4, 1); // 4+ headers = max
  const hierarchyScore = breakdown.headerHierarchyValid ? 1 : 0;
  
  // Weighted sum
  const score = 
    tableScore * ELEMENT_WEIGHTS.tables +
    listScore * ELEMENT_WEIGHTS.bulletLists +
    statsScore * ELEMENT_WEIGHTS.statistics +
    headerScore * ELEMENT_WEIGHTS.headers +
    hierarchyScore * ELEMENT_WEIGHTS.headerHierarchy;
  
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine justification level based on statistics count
 */
export function determineJustificationLevel(breakdown: ContentBreakdown): JustificationLevel {
  if (breakdown.statistics >= 5) return 'high';
  if (breakdown.statistics >= 2) return 'medium';
  return 'low';
}

/**
 * Generate suggestions for improving content
 */
export function generateSuggestions(
  breakdown: ContentBreakdown,
  score: number
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  
  // Only generate suggestions if score is below threshold
  if (score >= 0.5) return suggestions;
  
  if (breakdown.tables === 0) {
    suggestions.push({
      type: 'add-table',
      location: { line: 1, column: 1 },
      message: 'Add a comparison table to improve AI scannability. Tables help AI agents quickly extract structured data.',
      autoFixAvailable: false
    });
  }
  
  if (breakdown.bulletLists < 2) {
    suggestions.push({
      type: 'add-list',
      location: { line: 1, column: 1 },
      message: 'Add bullet lists to break down key points. AI agents prefer scannable, structured content.',
      autoFixAvailable: false
    });
  }
  
  if (breakdown.statistics < 3) {
    suggestions.push({
      type: 'add-stats',
      location: { line: 1, column: 1 },
      message: 'Include quantitative data (percentages, measurements, prices) to increase content authority.',
      autoFixAvailable: false
    });
  }
  
  if (!breakdown.headerHierarchyValid) {
    suggestions.push({
      type: 'fix-headers',
      location: { line: 1, column: 1 },
      message: 'Fix header hierarchy - avoid skipping levels (e.g., H1 directly to H3). Use sequential header levels.',
      autoFixAvailable: true
    });
  }
  
  if (breakdown.headers < 3 && score < 0.3) {
    suggestions.push({
      type: 'reduce-fluff',
      location: { line: 1, column: 1 },
      message: 'Add more section headers to improve content structure and navigation.',
      autoFixAvailable: false
    });
  }
  
  return suggestions;
}

/**
 * Main analysis function
 */
export function analyze(content: string): FactDensityResult {
  const breakdown = analyzeContent(content);
  const score = calculateScore(breakdown);
  const suggestions = generateSuggestions(breakdown, score);
  const justificationLevel = determineJustificationLevel(breakdown);
  
  return {
    score,
    breakdown,
    suggestions,
    justificationLevel
  };
}

/**
 * Quick check if content needs improvement
 */
export function needsImprovement(content: string): boolean {
  const result = analyze(content);
  return result.score < 0.5;
}

/**
 * Get a human-readable summary of the analysis
 */
export function getSummary(result: FactDensityResult): string {
  const { score, breakdown, suggestions } = result;
  
  let summary = `Scannability Score: ${(score * 100).toFixed(0)}%\n`;
  summary += `- Tables: ${breakdown.tables}\n`;
  summary += `- Bullet Lists: ${breakdown.bulletLists}\n`;
  summary += `- Statistics: ${breakdown.statistics}\n`;
  summary += `- Headers: ${breakdown.headers}\n`;
  summary += `- Header Hierarchy: ${breakdown.headerHierarchyValid ? 'Valid' : 'Invalid'}\n`;
  
  if (suggestions.length > 0) {
    summary += `\nSuggestions (${suggestions.length}):\n`;
    for (const suggestion of suggestions) {
      summary += `- ${suggestion.message}\n`;
    }
  }
  
  return summary;
}

// =============================================================================
// Information Gain Analysis
// =============================================================================
/**
 * Extract unique entities from content using NLP.
 * Uses the 'compromise' library for accurate entity extraction.
 * 
 * Production-grade extraction that:
 * 1. Uses NLP to identify people, places, organizations
 * 2. Extracts technical terms and acronyms
 * 3. Identifies specific numbers with context
 * 4. Filters out common words and noise
 */
export function extractUniqueEntities(content: string): string[] {
  const entities = new Set<string>();
  
  // Clean content - remove markdown/HTML artifacts
  const cleanContent = content
    .replace(/#{1,6}\s*/g, '') // Remove markdown headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/\n+/g, ' ') // Normalize newlines
    .trim();
  
  // Use NLP library for entity extraction
  const doc = nlp(cleanContent);
  
  // Extract people names
  const people = doc.people().out('array') as string[];
  people.forEach(p => {
    if (p.length > 2 && !p.match(/^(Mr|Mrs|Ms|Dr|Prof)\.?$/i)) {
      entities.add(p.trim());
    }
  });
  
  // Extract places
  const places = doc.places().out('array') as string[];
  places.forEach(p => {
    if (p.length > 2) {
      entities.add(p.trim());
    }
  });
  
  // Extract organizations
  const orgs = doc.organizations().out('array') as string[];
  orgs.forEach(o => {
    if (o.length > 1) {
      entities.add(o.trim());
    }
  });
  
  // Known tech terms that are informative
  const knownTechTerms = new Set([
    'API', 'SDK', 'HTTP', 'HTTPS', 'HTML', 'CSS', 'JSON', 'XML', 'REST', 'SQL', 'AWS',
    'GCP', 'CLI', 'GUI', 'IDE', 'ORM', 'MVC', 'SPA', 'SSR', 'CSR', 'CDN', 'DNS', 'SSL',
    'TLS', 'JWT', 'OAuth', 'CORS', 'CRUD', 'DOM', 'NPM', 'GIT', 'CI', 'CD',
    'AI', 'ML', 'NLP', 'LLM', 'GPT', 'RAG', 'SEO', 'GEO', 'SaaS', 'PaaS', 'IaaS',
    'B2B', 'B2C', 'ROI', 'KPI', 'CRM', 'ERP', 'CMS', 'IoT', 'AR', 'VR',
    'USB', 'CPU', 'GPU', 'RAM', 'SSD', 'HDD', 'iOS', 'macOS', 'Linux', 'Windows',
    'XDR', 'OLED', 'LCD', 'LED', 'USB-C', 'WiFi', 'Bluetooth', '5G', '4G', 'LTE',
  ]);
  
  // Extract technical terms (all-caps words 2+ chars)
  const techPattern = /\b[A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)?\b/g;
  const techMatches = cleanContent.match(techPattern) || [];
  techMatches.forEach(term => {
    if (knownTechTerms.has(term) || term.length >= 3) {
      entities.add(term);
    }
  });
  
  // Extract brand names (comprehensive list of major brands)
  const brandPattern = /\b(Apple|Google|Microsoft|Amazon|Tesla|Samsung|Sony|Nike|Adidas|Meta|Netflix|Spotify|Adobe|Intel|AMD|NVIDIA|Qualcomm|IBM|Oracle|Salesforce|Stripe|Shopify|Slack|Zoom|Uber|Lyft|Airbnb|Twitter|LinkedIn|Pinterest|Snapchat|TikTok|Reddit|Discord|Twitch|GitHub|GitLab|Atlassian|Notion|Figma|Canva|Dropbox|Box|Asana|Monday|Trello|Jira|Confluence|HubSpot|Mailchimp|Zendesk|Intercom|Segment|Mixpanel|Amplitude|Datadog|Splunk|Elastic|MongoDB|Redis|PostgreSQL|MySQL|Vercel|Netlify|Heroku|DigitalOcean|Cloudflare|Fastly|Akamai|AWS|GCP|Azure|OpenAI|Anthropic|Cohere|Hugging Face|Stability AI|Midjourney|DALL-E|Perplexity|Cursor|Replit|CodePen|StackOverflow|Medium|Substack|Ghost|WordPress|Squarespace|Wix|Webflow|Framer)\b/gi;
  const brands = cleanContent.match(brandPattern) || [];
  brands.forEach(brand => entities.add(brand));
  
  // Extract product names (comprehensive list of major products)
  const productPattern = /\b(iPhone|iPad|MacBook|iMac|AirPods|Apple Watch|Apple TV|HomePod|Vision Pro|Pixel|Galaxy|Note|Fold|Flip|PlayStation|Xbox|Nintendo Switch|Surface|Kindle|Echo|Alexa|Fire TV|Ring|Nest|Chromecast|Google Home|ChatGPT|Claude|Gemini|Copilot|Bard|GPT-4|GPT-3|DALL-E|Midjourney|Stable Diffusion|Whisper|Codex|Model S|Model 3|Model X|Model Y|Cybertruck|Powerwall|Starlink|Windows|macOS|iOS|Android|Linux|Ubuntu|Chrome|Firefox|Safari|Edge|VS Code|IntelliJ|PyCharm|WebStorm|Xcode|Android Studio|Docker|Kubernetes|Terraform|Ansible|Jenkins|CircleCI|GitHub Actions|Vercel|Next\.js|React|Vue|Angular|Svelte|Node\.js|Deno|Bun|Python|JavaScript|TypeScript|Rust|Go|Swift|Kotlin)\b/gi;
  const products = cleanContent.match(productPattern) || [];
  products.forEach(product => entities.add(product));
  
  // Extract CamelCase company/product names (e.g., PayPal, YouTube, LinkedIn)
  const camelCasePattern = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;
  const camelCaseMatches = cleanContent.match(camelCasePattern) || [];
  camelCaseMatches.forEach(term => {
    // Filter out common words that happen to be CamelCase
    if (!['JavaScript', 'TypeScript', 'PowerPoint', 'WordPress'].includes(term)) {
      entities.add(term);
    }
  });
  
  // Extract specific numbers with context (high-value facts)
  const numberContextPattern = /\b\d+(?:\.\d+)?(?:\s*(?:%|percent|million|billion|thousand|trillion|GB|TB|MB|KB|MP|Hz|GHz|MHz|mAh|W|kW|MW|kg|lb|oz|g|ml|L|m|cm|mm|ft|in|mph|km\/h|hours?|days?|weeks?|months?|years?|users?|customers?|downloads?|reviews?|ratings?|stars?|points?|votes?|views?|clicks?|conversions?|sales?|revenue|employees?|members?|subscribers?|followers?|likes?|shares?|comments?|posts?|articles?|pages?|sessions?|visits?|impressions?))\b/gi;
  const numbers = cleanContent.match(numberContextPattern) || [];
  numbers.forEach(num => entities.add(num.trim()));
  
  // Extract prices (multiple currencies)
  const pricePattern = /(?:\$|€|£|¥|₹|₽|₩|฿|₫|₱|₪|₴|₸|₺|₼|₾|₿)[\d,]+(?:\.\d{2})?/g;
  const prices = cleanContent.match(pricePattern) || [];
  prices.forEach(price => entities.add(price));
  
  // Extract dates (high-value temporal facts)
  const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:Q[1-4]|H[12])\s+\d{4}\b/gi;
  const dates = cleanContent.match(datePattern) || [];
  dates.forEach(date => entities.add(date.trim()));
  
  // Extract version numbers (software/product versions)
  const versionPattern = /\bv?\d+\.\d+(?:\.\d+)?(?:-(?:alpha|beta|rc|preview|stable|lts))?\b/gi;
  const versions = cleanContent.match(versionPattern) || [];
  versions.forEach(version => entities.add(version.trim()));
  
  // Extract comparisons (X vs Y, X compared to Y)
  const comparisonPattern = /\b(\w+)\s+(?:vs\.?|versus|compared to|better than|worse than|faster than|slower than)\s+(\w+)\b/gi;
  let compMatch;
  while ((compMatch = comparisonPattern.exec(cleanContent)) !== null) {
    entities.add(compMatch[1]);
    entities.add(compMatch[2]);
  }
  
  // Extract rankings (top N, #1, first place)
  const rankingPattern = /\b(?:top\s+\d+|#\d+|(?:first|second|third|fourth|fifth)\s+(?:place|position|rank))\b/gi;
  const rankings = cleanContent.match(rankingPattern) || [];
  rankings.forEach(rank => entities.add(rank.trim()));
  
  // Extract URLs (citations/references)
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const urls = cleanContent.match(urlPattern) || [];
  urls.forEach(url => entities.add(url));
  
  // Filter out any remaining noise
  const filtered = Array.from(entities).filter(e => {
    // Must be at least 2 chars
    if (e.length < 2) return false;
    // Filter out pure numbers without context
    if (/^\d+$/.test(e)) return false;
    // Filter out single common words
    const commonWords = new Set(['The', 'This', 'That', 'These', 'What', 'When', 'Where', 'Why', 'How', 'And', 'But', 'For', 'With', 'From']);
    if (commonWords.has(e)) return false;
    // Filter out entities containing newlines (garbage from NLP)
    if (e.includes('\n')) return false;
    // Filter out entities that are too long (likely garbage)
    if (e.length > 50) return false;
    // Filter out entities with punctuation in the middle (likely garbage)
    if (/[:\-]\s+\w/.test(e) && e.length > 10) return false;
    // Filter out entities that look like partial sentences
    if (/^[a-z]/.test(e) && e.split(/\s+/).length > 3) return false;
    return true;
  });
  
  return filtered;
}

/**
 * Find commodity phrases in content.
 */
export function findCommodityPhrases(content: string): string[] {
  const found: string[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const phrase of COMMODITY_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  
  return found;
}

/**
 * Calculate Information Gain score.
 * Higher score = more unique, valuable information.
 * 
 * Scoring factors:
 * - Unique entities (proper nouns, brands, technical terms)
 * - Specific numbers and statistics
 * - Citations and references
 * - Commodity phrase penalty
 * 
 * **Property 21: Information Gain Score Validity**
 * Score is in range [0, 100] and monotonically non-decreasing with unique entities.
 */
export function calculateInformationGain(content: string): InformationGainResult {
  const uniqueEntities = extractUniqueEntities(content);
  const commodityPhrases = findCommodityPhrases(content);
  
  // Calculate word count
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Calculate commodity phrase percentage
  let commodityWordCount = 0;
  for (const phrase of commodityPhrases) {
    commodityWordCount += phrase.split(/\s+/).length;
  }
  const commodityPhrasePercentage = wordCount > 0 
    ? Math.round((commodityWordCount / wordCount) * 100) 
    : 0;
  
  // Categorize entities for weighted scoring
  let entityScore = 0;
  
  for (const entity of uniqueEntities) {
    // Specific numbers with context are high value
    if (/\d+(?:\.\d+)?(?:\s*(?:%|percent|million|billion))/i.test(entity)) {
      entityScore += 4;
    }
    // URLs/citations are high value
    else if (entity.startsWith('http')) {
      entityScore += 3;
    }
    // Technical terms are medium-high value
    else if (/^[A-Z]{2,}/.test(entity)) {
      entityScore += 2;
    }
    // Other entities (names, brands) are standard value
    else {
      entityScore += 1;
    }
  }
  
  // Normalize entity score (cap at 60 points)
  const normalizedEntityScore = Math.min(entityScore, 60);
  
  // Base score starts at 50 (neutral content)
  // Good content with entities can reach 100
  // Bad content with commodity phrases drops toward 0
  const commodityPenalty = Math.min(commodityPhrasePercentage * 1.5, 50);
  
  const score = Math.max(0, Math.min(100, 50 + normalizedEntityScore - commodityPenalty));
  
  return {
    score: Math.round(score),
    uniqueEntities,
    commodityPhrasePercentage,
    commodityPhrases
  };
}

// =============================================================================
// Inverted Pyramid Analysis
// =============================================================================

/**
 * Find the position of key information in content.
 * Looks for question words, key phrases, and factual statements.
 */
function findAnswerPosition(content: string): number {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  
  // Look for indicators of key information
  const keyIndicators = [
    /\b(?:is|are|was|were)\b/i,  // Definitions
    /\b(?:costs?|prices?|worth)\b/i,  // Pricing
    /\b(?:because|since|due to)\b/i,  // Explanations
    /\b(?:steps?|how to|guide)\b/i,  // Instructions
    /\d+(?:\.\d+)?%/,  // Statistics
    /\$[\d,]+/,  // Prices
  ];
  
  // Find first occurrence of key information
  for (let i = 0; i < words.length; i++) {
    const windowStart = Math.max(0, i - 2);
    const windowEnd = Math.min(words.length, i + 3);
    const window = words.slice(windowStart, windowEnd).join(' ');
    
    for (const indicator of keyIndicators) {
      if (indicator.test(window)) {
        return i;
      }
    }
  }
  
  // Default to middle of content if no key info found
  return Math.floor(words.length / 2);
}

/**
 * Score content for Inverted Pyramid structure.
 * Key information should appear in first 50-100 words.
 * 
 * **Property 23: Inverted Pyramid Scoring Monotonicity**
 * Score is higher when answer appears earlier in content.
 */
export function scoreInvertedPyramid(content: string): InvertedPyramidResult {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  if (wordCount === 0) {
    return { score: 0, answerPosition: 0, isOptimal: false };
  }
  
  const answerPosition = findAnswerPosition(content);
  
  // Optimal: answer in first 50-100 words
  const isOptimal = answerPosition <= 100;
  
  // Score calculation:
  // - Position 0-50: 100 points
  // - Position 51-100: 80-100 points (linear decrease)
  // - Position 101-200: 50-80 points (linear decrease)
  // - Position 200+: decreasing score
  let score: number;
  
  if (answerPosition <= 50) {
    score = 100;
  } else if (answerPosition <= 100) {
    score = 100 - ((answerPosition - 50) * 0.4); // 80-100
  } else if (answerPosition <= 200) {
    score = 80 - ((answerPosition - 100) * 0.3); // 50-80
  } else {
    score = Math.max(0, 50 - ((answerPosition - 200) * 0.1));
  }
  
  return {
    score: Math.round(score),
    answerPosition,
    isOptimal
  };
}

// =============================================================================
// Fluff Detection
// =============================================================================

/**
 * Detect fluffy marketing phrases in content.
 * 
 * **Property 24: Fluffy Copy Detection Threshold**
 * Content with >30% commodity phrases gets fluffScore > 70.
 */
export function detectFluff(content: string): FluffDetectionResult {
  const found: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Find fluffy phrases
  for (const phrase of FLUFFY_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  
  // Also include commodity phrases in fluff detection
  const commodityPhrases = findCommodityPhrases(content);
  const allFluffyPhrases = Array.from(new Set([...found, ...commodityPhrases]));
  
  // Calculate word count
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Calculate fluffy word count
  let fluffyWordCount = 0;
  for (const phrase of allFluffyPhrases) {
    fluffyWordCount += phrase.split(/\s+/).length;
  }
  
  // Calculate fluff percentage
  const fluffPercentage = wordCount > 0 
    ? (fluffyWordCount / wordCount) * 100 
    : 0;
  
  // Score: higher = more fluffy
  // If >30% commodity phrases, score > 70
  let score: number;
  if (fluffPercentage >= 30) {
    score = 70 + Math.min(30, fluffPercentage - 30); // 70-100
  } else {
    score = Math.round((fluffPercentage / 30) * 70); // 0-70
  }
  
  return {
    score: Math.min(100, score),
    phrases: allFluffyPhrases
  };
}

// =============================================================================
// AI-Candy Element Detection
// =============================================================================

/**
 * Count AI-friendly elements in content.
 * 
 * **Property 22: AI-Candy Element Detection Accuracy**
 * Correctly counts tables, bullets, JSON-LD, pros/cons, bold attributes.
 */
export interface AICandyElements {
  tables: number;
  bulletLists: number;
  numberedLists: number;
  jsonLdPresent: boolean;
  prosConsSections: number;
  boldAttributes: number;
}

export function countAICandyElements(content: string): AICandyElements {
  // Count lists
  const numberedMatches = content.match(PATTERNS.numberedList) || [];
  
  // Count JSON-LD presence
  const jsonLdMatches = content.match(PATTERNS.jsonLd) || [];
  
  // Count pros/cons sections
  const prosConsMatches = content.match(PATTERNS.prosConsSection) || [];
  
  // Count bold text (attributes)
  const boldMatches = content.match(PATTERNS.boldText) || [];
  
  return {
    tables: countTables(content),
    bulletLists: countBulletLists(content),
    numberedLists: numberedMatches.length > 0 ? 1 : 0, // Count as 1 if any numbered items
    jsonLdPresent: jsonLdMatches.length > 0,
    prosConsSections: prosConsMatches.length,
    boldAttributes: boldMatches.length
  };
}
