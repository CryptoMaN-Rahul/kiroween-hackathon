/**
 * Semantic Similarity Engine for Symbiote Router
 * 
 * Performs semantic matching between hallucinated paths and valid routes
 * using token-based similarity (Jaccard similarity) with synonym expansion.
 * 
 * @module semantic-engine
 * Requirements: 2.5, 2.6
 */

import { tokenizePath, calculateTokenOverlap } from './tokenizer';
import type { SemanticMatch } from '@/types';
import {
  createSynonymDictionary,
  SynonymDictionary,
  SYNONYM_WEIGHT,
} from './ai-search/synonym-dictionary';

/**
 * Configuration for the semantic engine
 */
export interface SemanticEngineConfig {
  /** Minimum confidence threshold for a match (0-1) */
  minConfidence: number;
  /** Whether to use fuzzy token matching (Levenshtein) */
  useFuzzyTokens: boolean;
  /** Maximum edit distance for fuzzy token matching */
  maxEditDistance: number;
  /** Whether to use synonym expansion for matching */
  useSynonyms: boolean;
  /** Custom synonym dictionary (uses default if not provided) */
  synonymDictionary?: SynonymDictionary;
  /** Whitelist of terms to ignore during normalization (e.g., ["Corp", "Inc", "LLC"]) */
  whitelist?: string[];
}

const DEFAULT_CONFIG: SemanticEngineConfig = {
  minConfidence: 0.3,
  useFuzzyTokens: true,
  maxEditDistance: 2,
  useSynonyms: true,
  whitelist: [],
};

/**
 * Default whitelist of common business suffixes to ignore during matching.
 */
export const DEFAULT_WHITELIST = [
  'corp', 'corporation', 'inc', 'incorporated', 'llc', 'ltd', 'limited',
  'co', 'company', 'plc', 'gmbh', 'ag', 'sa', 'nv', 'bv'
];

/**
 * Normalizes a string by removing whitelisted terms.
 * Useful for matching company names where suffixes like "Corp", "Inc" should be ignored.
 * 
 * @param str - Input string to normalize
 * @param whitelist - Array of terms to remove (case-insensitive)
 * @returns Normalized string with whitelist terms removed
 * 
 * @example
 * normalizeWithWhitelist('Apple Inc', ['inc', 'corp']) // 'Apple'
 * normalizeWithWhitelist('Microsoft Corporation', ['corporation']) // 'Microsoft'
 */
export function normalizeWithWhitelist(str: string, whitelist: string[]): string {
  if (!whitelist || whitelist.length === 0) return str;
  
  const lowerWhitelist = whitelist.map(w => w.toLowerCase());
  
  // Split into words, filter out whitelist terms, rejoin
  const words = str.split(/\s+/);
  const filtered = words.filter(word => 
    !lowerWhitelist.includes(word.toLowerCase())
  );
  
  return filtered.join(' ').trim();
}

/**
 * Calculates Levenshtein edit distance between two strings.
 * Used for fuzzy token matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates Jaro similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (exact match).
 * 
 * The Jaro similarity is based on:
 * - Number of matching characters
 * - Number of transpositions
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Jaro similarity score (0-1)
 */
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Calculate match window
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);

  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);

    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  // Calculate Jaro similarity
  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Calculates Jaro-Winkler distance between two strings.
 * Extends Jaro similarity by giving more weight to strings that match from the beginning.
 * 
 * This is particularly useful for name matching where common prefixes indicate higher similarity.
 * 
 * @param a - First string
 * @param b - Second string
 * @param prefixScale - Scaling factor for common prefix bonus (default: 0.1, max: 0.25)
 * @returns Jaro-Winkler similarity score (0-1)
 * 
 * @example
 * jaroWinklerDistance('MARTHA', 'MARHTA') // ~0.961
 * jaroWinklerDistance('DWAYNE', 'DUANE')  // ~0.840
 * jaroWinklerDistance('DIXON', 'DICKSONX') // ~0.813
 */
export function jaroWinklerDistance(a: string, b: string, prefixScale: number = 0.1): number {
  // Clamp prefix scale to valid range (0 to 0.25)
  const p = Math.min(0.25, Math.max(0, prefixScale));
  
  const jaroSim = jaroSimilarity(a, b);
  
  // Find common prefix length (max 4 characters)
  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefixLength++;
    } else {
      break;
    }
  }
  
  // Calculate Jaro-Winkler similarity
  return jaroSim + prefixLength * p * (1 - jaroSim);
}

/**
 * Generates N-grams from a string.
 * N-grams are contiguous sequences of n characters.
 * 
 * @param str - Input string
 * @param n - Size of each gram (default: 2 for bigrams)
 * @returns Set of n-grams
 */
function generateNGrams(str: string, n: number = 2): Set<string> {
  const ngrams = new Set<string>();
  const normalized = str.toLowerCase();
  
  if (normalized.length < n) {
    // If string is shorter than n, return the whole string as a single gram
    if (normalized.length > 0) {
      ngrams.add(normalized);
    }
    return ngrams;
  }
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n));
  }
  
  return ngrams;
}

/**
 * Calculates N-Gram similarity between two strings using Dice coefficient.
 * 
 * N-Gram similarity is useful for matching descriptions and longer text
 * where character-level patterns matter.
 * 
 * @param a - First string
 * @param b - Second string
 * @param n - Size of each gram (default: 2 for bigrams)
 * @returns Similarity score (0-1)
 * 
 * @example
 * nGramSimilarity('night', 'nacht') // ~0.25 (bigrams)
 * nGramSimilarity('hello', 'hello') // 1.0
 * nGramSimilarity('abc', 'xyz')     // 0.0
 */
export function nGramSimilarity(a: string, b: string, n: number = 2): number {
  if (a === b) return 1;
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const ngramsA = generateNGrams(a, n);
  const ngramsB = generateNGrams(b, n);
  
  if (ngramsA.size === 0 && ngramsB.size === 0) return 1;
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;
  
  // Calculate intersection
  let intersection = 0;
  ngramsA.forEach((gram) => {
    if (ngramsB.has(gram)) {
      intersection++;
    }
  });
  
  // Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
  return (2 * intersection) / (ngramsA.size + ngramsB.size);
}

/**
 * Generates Soundex code for a string.
 * Soundex is a phonetic algorithm that encodes words by their sound.
 * 
 * @param str - Input string
 * @returns Soundex code (letter + 3 digits)
 */
export function soundexCode(str: string): string {
  if (!str || str.length === 0) return '';
  
  const normalized = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized.length === 0) return '';
  
  // Soundex mapping
  const mapping: Record<string, string> = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  };
  
  // Keep first letter
  let code = normalized[0];
  let prevCode = mapping[normalized[0]] || '0';
  
  // Process remaining letters
  for (let i = 1; i < normalized.length && code.length < 4; i++) {
    const char = normalized[i];
    const charCode = mapping[char];
    
    // Skip vowels and H, W (they don't have codes)
    if (!charCode) continue;
    
    // Skip if same as previous code (adjacent similar sounds)
    if (charCode === prevCode) continue;
    
    code += charCode;
    prevCode = charCode;
  }
  
  // Pad with zeros to make 4 characters
  return (code + '000').substring(0, 4);
}

/**
 * Checks if two strings match phonetically using Soundex.
 * 
 * Soundex is useful for matching names and words that sound similar
 * but are spelled differently (e.g., "Smith" and "Smyth").
 * 
 * @param a - First string
 * @param b - Second string
 * @returns True if the strings have the same Soundex code
 * 
 * @example
 * soundexMatch('Robert', 'Rupert')  // true (both R163)
 * soundexMatch('Smith', 'Smyth')    // true (both S530)
 * soundexMatch('John', 'Jane')      // false (J500 vs J500... actually true!)
 */
export function soundexMatch(a: string, b: string): boolean {
  const codeA = soundexCode(a);
  const codeB = soundexCode(b);
  
  // Both empty = match
  if (codeA === '' && codeB === '') return true;
  // One empty = no match
  if (codeA === '' || codeB === '') return false;
  
  return codeA === codeB;
}

/**
 * Tokenizes a string into words for cosine similarity.
 * 
 * @param str - Input string
 * @returns Array of lowercase tokens
 */
function tokenizeForCosine(str: string): string[] {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Calculates Cosine similarity between two strings using token-based vectors.
 * 
 * Cosine similarity measures the cosine of the angle between two vectors,
 * where each dimension represents a unique token and the value is the frequency.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score (0-1)
 * 
 * @example
 * cosineSimilarity('hello world', 'hello world') // 1.0
 * cosineSimilarity('hello world', 'hello there') // ~0.5
 * cosineSimilarity('abc', 'xyz')                 // 0.0
 */
export function cosineSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  
  const tokensA = tokenizeForCosine(a);
  const tokensB = tokenizeForCosine(b);
  
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  
  // Build frequency maps
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  
  for (const token of tokensA) {
    freqA.set(token, (freqA.get(token) || 0) + 1);
  }
  for (const token of tokensB) {
    freqB.set(token, (freqB.get(token) || 0) + 1);
  }
  
  // Get all unique tokens
  const allTokens = new Set([...Array.from(freqA.keys()), ...Array.from(freqB.keys())]);
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  allTokens.forEach((token) => {
    const valA = freqA.get(token) || 0;
    const valB = freqB.get(token) || 0;
    
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  });
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Combines multiple algorithm scores using weighted averaging.
 * 
 * @param scores - Record of algorithm names to their scores
 * @param weights - Record of algorithm names to their weights (should sum to 1.0)
 * @returns Combined weighted score (0-1)
 * 
 * @example
 * combineAlgorithmScores(
 *   { levenshtein: 0.8, jaroWinkler: 0.9, cosine: 0.7 },
 *   { levenshtein: 0.3, jaroWinkler: 0.4, cosine: 0.3 }
 * ) // 0.3*0.8 + 0.4*0.9 + 0.3*0.7 = 0.81
 */
export function combineAlgorithmScores(
  scores: Record<string, number>,
  weights: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const [algorithm, weight] of Object.entries(weights)) {
    if (algorithm in scores && weight > 0) {
      weightedSum += scores[algorithm] * weight;
      totalWeight += weight;
    }
  }
  
  // If no valid weights, return 0
  if (totalWeight === 0) return 0;
  
  // Normalize by total weight (in case weights don't sum to 1)
  return weightedSum / totalWeight;
}

// Helper functions for token comparison are integrated into getTokenSimilarityWeight

/**
 * Gets the similarity weight between two tokens considering synonyms
 * Returns 1.0 for exact match, 0.8 for synonym match, 0 for no match
 */
function getTokenSimilarityWeight(
  token1: string,
  token2: string,
  dictionary: SynonymDictionary | undefined,
  maxEditDistance: number
): number {
  // Exact match
  if (token1 === token2) return 1.0;
  
  // Synonym match (0.8x weight)
  if (dictionary) {
    const synonymWeight = dictionary.getSimilarityWeight(token1, token2);
    if (synonymWeight > 0) return synonymWeight;
  }
  
  // Fuzzy match (Levenshtein) - treat as slightly lower than synonym
  if (Math.abs(token1.length - token2.length) <= maxEditDistance &&
      levenshteinDistance(token1, token2) <= maxEditDistance) {
    return SYNONYM_WEIGHT; // Same weight as synonyms
  }
  
  return 0;
}

/**
 * Calculates similarity between two paths using Jaccard similarity
 * with optional fuzzy token matching and synonym expansion.
 * 
 * Synonym matches are weighted at 0.8x exact match weight per Requirements 2.5.
 */
export function calculateSimilarity(
  path1: string,
  path2: string,
  config: SemanticEngineConfig = DEFAULT_CONFIG
): number {
  const tokens1 = tokenizePath(path1);
  const tokens2 = tokenizePath(path2);

  if (tokens1.length === 0 && tokens2.length === 0) {
    return 1; // Both empty = perfect match
  }

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0; // One empty = no match
  }

  if (!config.useFuzzyTokens && !config.useSynonyms) {
    // Simple Jaccard similarity
    return calculateTokenOverlap(path1, path2);
  }

  // Get synonym dictionary if enabled
  const dictionary = config.useSynonyms 
    ? (config.synonymDictionary || createSynonymDictionary())
    : undefined;

  // Weighted Jaccard: count tokens with weighted similarity
  let weightedMatches1 = 0;
  let weightedMatches2 = 0;

  for (const t1 of tokens1) {
    let bestWeight = 0;
    for (const t2 of tokens2) {
      const weight = getTokenSimilarityWeight(t1, t2, dictionary, config.maxEditDistance);
      bestWeight = Math.max(bestWeight, weight);
    }
    weightedMatches1 += bestWeight;
  }

  for (const t2 of tokens2) {
    let bestWeight = 0;
    for (const t1 of tokens1) {
      const weight = getTokenSimilarityWeight(t2, t1, dictionary, config.maxEditDistance);
      bestWeight = Math.max(bestWeight, weight);
    }
    weightedMatches2 += bestWeight;
  }

  // Average of both directions for symmetry
  const similarity1 = weightedMatches1 / tokens1.length;
  const similarity2 = weightedMatches2 / tokens2.length;

  return (similarity1 + similarity2) / 2;
}

/**
 * Finds the best matching route for a hallucinated path.
 * 
 * @param hallucinatedPath - The path that was requested but doesn't exist
 * @param validRoutes - Array of valid routes to match against
 * @param config - Engine configuration
 * @returns The best match with confidence score, or null if no match above threshold
 */
export function findBestMatch(
  hallucinatedPath: string,
  validRoutes: string[],
  config: SemanticEngineConfig = DEFAULT_CONFIG
): SemanticMatch | null {
  if (validRoutes.length === 0) {
    return null;
  }

  const hallucinatedTokens = tokenizePath(hallucinatedPath);
  const dictionary = config.useSynonyms 
    ? (config.synonymDictionary || createSynonymDictionary())
    : undefined;
  
  let bestMatch: SemanticMatch | null = null;
  let bestConfidence = 0;

  for (const route of validRoutes) {
    const confidence = calculateSimilarity(hallucinatedPath, route, config);
    
    if (confidence > bestConfidence && confidence >= config.minConfidence) {
      const routeTokens = tokenizePath(route);
      const matchedTokens = hallucinatedTokens.filter(t => 
        routeTokens.some(rt => {
          const weight = getTokenSimilarityWeight(t, rt, dictionary, config.maxEditDistance);
          return weight > 0;
        })
      );

      bestMatch = {
        route,
        confidence,
        matchedTokens,
        reasoning: generateReasoning(hallucinatedPath, route, matchedTokens, confidence)
      };
      bestConfidence = confidence;
    }
  }

  return bestMatch;
}

/**
 * Generates a human-readable explanation of why a match was made.
 */
function generateReasoning(
  hallucinatedPath: string,
  matchedRoute: string,
  matchedTokens: string[],
  confidence: number
): string {
  const hallucinatedTokens = tokenizePath(hallucinatedPath);
  const routeTokens = tokenizePath(matchedRoute);

  if (matchedTokens.length === 0) {
    return `No common tokens found, but structure similarity is ${(confidence * 100).toFixed(1)}%`;
  }

  const matchedStr = matchedTokens.join(', ');
  const unmatchedHallucinated = hallucinatedTokens.filter(t => !matchedTokens.includes(t));
  const unmatchedRoute = routeTokens.filter(t => !matchedTokens.includes(t));

  let reasoning = `Matched tokens: [${matchedStr}]`;
  
  if (unmatchedHallucinated.length > 0) {
    reasoning += `. Unmatched from request: [${unmatchedHallucinated.join(', ')}]`;
  }
  
  if (unmatchedRoute.length > 0) {
    reasoning += `. Additional in route: [${unmatchedRoute.join(', ')}]`;
  }

  reasoning += `. Confidence: ${(confidence * 100).toFixed(1)}%`;

  return reasoning;
}

/**
 * Ranks all valid routes by similarity to the hallucinated path.
 * 
 * @param hallucinatedPath - The path that was requested
 * @param validRoutes - Array of valid routes
 * @param config - Engine configuration
 * @returns Array of matches sorted by confidence (descending)
 */
export function rankRoutes(
  hallucinatedPath: string,
  validRoutes: string[],
  config: SemanticEngineConfig = DEFAULT_CONFIG
): SemanticMatch[] {
  const hallucinatedTokens = tokenizePath(hallucinatedPath);
  const dictionary = config.useSynonyms 
    ? (config.synonymDictionary || createSynonymDictionary())
    : undefined;
  
  const matches: SemanticMatch[] = validRoutes
    .map(route => {
      const confidence = calculateSimilarity(hallucinatedPath, route, config);
      const routeTokens = tokenizePath(route);
      const matchedTokens = hallucinatedTokens.filter(t => 
        routeTokens.some(rt => {
          const weight = getTokenSimilarityWeight(t, rt, dictionary, config.maxEditDistance);
          return weight > 0;
        })
      );

      return {
        route,
        confidence,
        matchedTokens,
        reasoning: generateReasoning(hallucinatedPath, route, matchedTokens, confidence)
      };
    })
    .filter(match => match.confidence >= config.minConfidence)
    .sort((a, b) => b.confidence - a.confidence);

  return matches;
}

/**
 * Configuration for batch processing
 */
export interface BatchConfig {
  /** Maximum concurrent operations (default: 10) */
  concurrency?: number;
}

/**
 * Processes multiple inputs in batch, finding best matches for each.
 * Results are returned in the same order as inputs.
 * 
 * @param inputs - Array of paths to find matches for
 * @param candidates - Array of valid routes to match against
 * @param engineConfig - Semantic engine configuration
 * @param batchConfig - Batch processing configuration
 * @returns Promise resolving to array of matches (null for no match) in input order
 * 
 * @example
 * const results = await batchFindMatches(
 *   ['/prodcts/iphone', '/abot/us'],
 *   ['/products/iphone', '/about/us', '/contact'],
 *   { minConfidence: 0.5 }
 * );
 */
export async function batchFindMatches(
  inputs: string[],
  candidates: string[],
  engineConfig: Partial<SemanticEngineConfig> = {},
  batchConfig: BatchConfig = {}
): Promise<(SemanticMatch | null)[]> {
  const config: SemanticEngineConfig = { ...DEFAULT_CONFIG, ...engineConfig };
  const concurrency = batchConfig.concurrency ?? 10;
  
  // Process in chunks for controlled concurrency
  const results: (SemanticMatch | null)[] = new Array(inputs.length);
  
  // Simple sequential processing with async wrapper for consistency
  // In a real implementation, this could use worker threads for true parallelism
  const processChunk = async (startIdx: number, endIdx: number) => {
    for (let i = startIdx; i < endIdx; i++) {
      results[i] = findBestMatch(inputs[i], candidates, config);
    }
  };
  
  // Process in chunks
  const chunkSize = Math.ceil(inputs.length / concurrency);
  const promises: Promise<void>[] = [];
  
  for (let i = 0; i < inputs.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, inputs.length);
    promises.push(processChunk(i, end));
  }
  
  await Promise.all(promises);
  
  return results;
}

/**
 * Creates a semantic engine instance with custom configuration.
 */
export function createSemanticEngine(config: Partial<SemanticEngineConfig> = {}) {
  const mergedConfig: SemanticEngineConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    findBestMatch: (hallucinatedPath: string, validRoutes: string[]) =>
      findBestMatch(hallucinatedPath, validRoutes, mergedConfig),
    
    rankRoutes: (hallucinatedPath: string, validRoutes: string[]) =>
      rankRoutes(hallucinatedPath, validRoutes, mergedConfig),
    
    calculateSimilarity: (path1: string, path2: string) =>
      calculateSimilarity(path1, path2, mergedConfig),
    
    batchFindMatches: (inputs: string[], candidates: string[], batchConfig?: BatchConfig) =>
      batchFindMatches(inputs, candidates, mergedConfig, batchConfig),
    
    config: mergedConfig
  };
}

export { DEFAULT_CONFIG };
