/**
 * Quotable Snippet Extractor
 *
 * Extracts and scores quotable snippets from content for AI citation optimization.
 * Identifies sentences with statistics, unique claims, and citation anchors.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import {
  QuotableSnippet,
  SNIPPET_WEIGHTS,
  STATISTIC_PATTERNS,
  COMMODITY_PHRASES,
} from './types';

/** Maximum character length for preferred snippets (tweetable length) */
export const PREFERRED_SNIPPET_LENGTH = 280;

/** Maximum number of snippets to return */
export const MAX_SNIPPETS = 5;

/** Patterns for detecting source attribution */
export const ATTRIBUTION_PATTERNS: RegExp[] = [
  /according to\s+[\w\s]+/i,
  /source:\s*[\w\s]+/i,
  /\([\w\s]+,\s*\d{4}\)/,           // (Author, Year) format
  /\[[\d,\s]+\]/,                    // [1], [1,2] citation format
  /study\s+(by|from)\s+[\w\s]+/i,
  /research\s+(by|from)\s+[\w\s]+/i,
  /report\s+(by|from)\s+[\w\s]+/i,
  /data\s+from\s+[\w\s]+/i,
  /per\s+[\w\s]+\s+report/i,
  /cited\s+in\s+[\w\s]+/i,
];

/** Patterns for detecting specific/named entities */
const SPECIFICITY_PATTERNS: RegExp[] = [
  /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/,  // Proper nouns (multi-word)
  /\b[A-Z]{2,}\b/,                    // Acronyms
  /\b\d{4}\b/,                        // Years
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  /\bv?\d+\.\d+(?:\.\d+)?\b/,        // Version numbers
];

/**
 * Splits content into sentences
 */
export function splitIntoSentences(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  // Split on sentence-ending punctuation followed by space or end
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Checks if text contains a statistic (numbers, percentages, comparisons)
 * Requirements: 3.1
 */
export function hasStatistic(text: string): boolean {
  return STATISTIC_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Checks if text contains source attribution
 * Requirements: 3.6
 */
export function hasAttribution(text: string): boolean {
  return ATTRIBUTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Checks if text contains specific/named entities
 */
export function isSpecific(text: string): boolean {
  return SPECIFICITY_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Checks if text is under the preferred length (280 chars)
 * Requirements: 3.3
 */
export function isConcise(text: string): boolean {
  return text.length <= PREFERRED_SNIPPET_LENGTH;
}

/**
 * Checks if text contains commodity phrases (not unique)
 */
export function isUnique(text: string): boolean {
  const lowerText = text.toLowerCase();
  return !COMMODITY_PHRASES.some(phrase => lowerText.includes(phrase.toLowerCase()));
}

/**
 * Scores a snippet based on weighted criteria
 * Requirements: 3.4
 *
 * Scoring weights:
 * - hasStatistic: 30 points
 * - isUnique: 25 points
 * - isSpecific: 20 points
 * - isConcise: 15 points
 * - hasAttribution: 10 points
 */
export function scoreSnippet(text: string): number {
  let score = 0;

  if (hasStatistic(text)) {
    score += SNIPPET_WEIGHTS.hasStatistic;
  }

  if (isUnique(text)) {
    score += SNIPPET_WEIGHTS.isUnique;
  }

  if (isSpecific(text)) {
    score += SNIPPET_WEIGHTS.isSpecific;
  }

  if (isConcise(text)) {
    score += SNIPPET_WEIGHTS.isConcise;
  }

  if (hasAttribution(text)) {
    score += SNIPPET_WEIGHTS.hasAttribution;
  }

  return score;
}

/**
 * Generates improvement suggestions for a snippet
 * Requirements: 3.6
 */
export function generateSuggestions(text: string): string[] {
  const suggestions: string[] = [];

  if (!hasAttribution(text)) {
    suggestions.push('Add a source or methodology citation to increase credibility');
  }

  if (!hasStatistic(text)) {
    suggestions.push('Include specific statistics or data points to make the claim more quotable');
  }

  if (!isConcise(text)) {
    suggestions.push(`Condense to under ${PREFERRED_SNIPPET_LENGTH} characters for better quotability`);
  }

  if (!isUnique(text)) {
    suggestions.push('Replace generic marketing language with specific, differentiated claims');
  }

  return suggestions;
}

/**
 * Identifies citation anchors - sentences with unique claims and supporting data
 * Requirements: 3.2
 */
export function identifyCitationAnchors(content: string): string[] {
  const sentences = splitIntoSentences(content);

  return sentences.filter(sentence => {
    // A citation anchor must have a statistic AND be unique (not commodity content)
    return hasStatistic(sentence) && isUnique(sentence);
  });
}

/**
 * Extracts quotable snippets from content
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * @param content - The content to analyze
 * @param source - Optional source identifier for the snippets
 * @returns Array of up to 5 quotable snippets, ordered by citation score descending
 */
export function extract(content: string, source: string = ''): QuotableSnippet[] {
  const sentences = splitIntoSentences(content);

  if (sentences.length === 0) {
    return [];
  }

  // Score and create snippets for all sentences
  const snippets: QuotableSnippet[] = sentences.map(text => {
    const score = scoreSnippet(text);
    const hasStats = hasStatistic(text);
    const unique = isUnique(text);

    return {
      text,
      source,
      citationScore: score,
      hasStatistic: hasStats,
      hasUniqueData: hasStats && unique, // Unique data = has stats AND is unique
      characterCount: text.length,
      suggestedImprovements: generateSuggestions(text),
    };
  });

  // Sort by citation score descending
  snippets.sort((a, b) => b.citationScore - a.citationScore);

  // Return top MAX_SNIPPETS
  return snippets.slice(0, MAX_SNIPPETS);
}

/**
 * Creates a snippet extractor instance with configurable options
 */
export interface SnippetExtractorOptions {
  maxSnippets?: number;
  preferredLength?: number;
}

export interface SnippetExtractor {
  extract(content: string, source?: string): QuotableSnippet[];
  scoreSnippet(text: string): number;
  identifyCitationAnchors(content: string): string[];
  hasStatistic(text: string): boolean;
  hasAttribution(text: string): boolean;
}

export function createSnippetExtractor(
  options: SnippetExtractorOptions = {}
): SnippetExtractor {
  const maxSnippets = options.maxSnippets ?? MAX_SNIPPETS;

  return {
    extract(content: string, source: string = ''): QuotableSnippet[] {
      const allSnippets = extract(content, source);
      return allSnippets.slice(0, maxSnippets);
    },

    scoreSnippet,
    identifyCitationAnchors,
    hasStatistic,
    hasAttribution,
  };
}
