/**
 * Deduplication Detector
 *
 * Detects commodity phrases and low differentiation content to help
 * identify content that AI agents have no reason to cite specifically.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { DedupResult, COMMODITY_PHRASES } from './types';
import { hasStatistic, isUnique } from './snippet-extractor';

// =============================================================================
// Constants
// =============================================================================

/** Threshold for flagging low differentiation content */
export const LOW_DIFFERENTIATION_THRESHOLD = 0.3; // 30%

/** Suggestions for improving differentiated content */
export const DIFFERENTIATION_SUGGESTIONS = [
  'Add specific statistics or data points unique to your business',
  'Include case studies or customer success stories with measurable outcomes',
  'Reference original research or proprietary methodologies',
  'Replace generic claims with specific, verifiable facts',
  'Add industry-specific terminology and expertise',
  'Include unique insights or perspectives not found elsewhere',
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalizes text for comparison (lowercase, trim whitespace)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Counts total words in content
 */
function countWords(content: string): number {
  if (!content || content.trim().length === 0) {
    return 0;
  }
  return content.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Counts words in commodity phrases found in content
 */
function countCommodityWords(content: string, phrases: string[]): number {
  const normalizedContent = normalizeText(content);
  let commodityWordCount = 0;

  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    const phraseWords = normalizedPhrase.split(/\s+/).length;
    
    // Count occurrences of this phrase
    let index = 0;
    while ((index = normalizedContent.indexOf(normalizedPhrase, index)) !== -1) {
      commodityWordCount += phraseWords;
      index += normalizedPhrase.length;
    }
  }

  return commodityWordCount;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Identifies commodity phrases in content
 * Requirements: 7.1
 *
 * @param content - The content to analyze
 * @returns Array of commodity phrases found in the content
 */
export function identifyCommodityPhrases(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const normalizedContent = normalizeText(content);
  const foundPhrases: string[] = [];

  for (const phrase of COMMODITY_PHRASES) {
    if (normalizedContent.includes(normalizeText(phrase))) {
      foundPhrases.push(phrase);
    }
  }

  return foundPhrases;
}

/**
 * Calculates the percentage of content that is commodity phrases
 * Requirements: 7.2
 *
 * @param content - The content to analyze
 * @param phrases - The commodity phrases found
 * @returns Percentage (0-1) of content that is commodity phrases
 */
export function calculateCommodityPercentage(content: string, phrases: string[]): number {
  const totalWords = countWords(content);
  
  if (totalWords === 0) {
    return 0;
  }

  const commodityWords = countCommodityWords(content, phrases);
  return commodityWords / totalWords;
}

/**
 * Finds citation anchors - unique content with statistics
 * Requirements: 7.4
 *
 * @param content - The content to analyze
 * @returns Array of sentences that are citation anchors
 */
export function findCitationAnchors(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  return sentences.filter(sentence => {
    // A citation anchor must have a statistic AND be unique (not commodity content)
    return hasStatistic(sentence) && isUnique(sentence);
  });
}

/**
 * Generates suggestions for improving content differentiation
 * Requirements: 7.3
 *
 * @param result - The dedup analysis result
 * @returns Array of suggestions
 */
function generateSuggestions(result: Partial<DedupResult>): string[] {
  const suggestions: string[] = [];

  if (result.isLowDifferentiation) {
    // Add general suggestions for low differentiation
    suggestions.push(...DIFFERENTIATION_SUGGESTIONS.slice(0, 3));
  }

  if (result.commodityPhrases && result.commodityPhrases.length > 0) {
    suggestions.push(
      `Replace these commodity phrases with specific claims: ${result.commodityPhrases.slice(0, 3).join(', ')}`
    );
  }

  if (result.citationAnchors && result.citationAnchors.length === 0) {
    suggestions.push('Add unique statistics or data points to create citation anchors');
  }

  return suggestions;
}

/**
 * Analyzes content for differentiation and commodity phrases
 * Requirements: 7.1, 7.2, 7.3, 7.4
 *
 * @param content - The content to analyze
 * @returns DedupResult with analysis
 */
export function analyze(content: string): DedupResult {
  const commodityPhrases = identifyCommodityPhrases(content);
  const commodityPhrasePercentage = calculateCommodityPercentage(content, commodityPhrases);
  const isLowDifferentiation = commodityPhrasePercentage > LOW_DIFFERENTIATION_THRESHOLD;
  const citationAnchors = findCitationAnchors(content);

  const partialResult: Partial<DedupResult> = {
    commodityPhrasePercentage,
    isLowDifferentiation,
    commodityPhrases,
    citationAnchors,
  };

  const suggestions = generateSuggestions(partialResult);

  return {
    commodityPhrasePercentage,
    isLowDifferentiation,
    commodityPhrases,
    citationAnchors,
    suggestions,
  };
}

// =============================================================================
// Factory Function
// =============================================================================

export interface DedupDetector {
  analyze(content: string): DedupResult;
  identifyCommodityPhrases(content: string): string[];
  findCitationAnchors(content: string): string[];
  calculateCommodityPercentage(content: string, phrases: string[]): number;
}

/**
 * Creates a dedup detector instance
 */
export function createDedupDetector(): DedupDetector {
  return {
    analyze,
    identifyCommodityPhrases,
    findCitationAnchors,
    calculateCommodityPercentage,
  };
}
