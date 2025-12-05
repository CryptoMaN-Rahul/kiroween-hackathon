/**
 * Citation Score Calculator
 *
 * Calculates how likely content is to be cited by AI agents based on
 * unique data, source attribution, quotable snippets, and schema coverage.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import {
  CitationScore,
  CitationScoreBreakdown,
  RankedPage,
  PageContent,
  CITATION_RECOMMENDATIONS,
} from './types';
import { extract, hasStatistic, hasAttribution } from './snippet-extractor';
import { extractFAQ, extractHowTo } from './aeo-optimizer';

// =============================================================================
// Score Weights (Requirement 6.2)
// =============================================================================

/** Weight distribution for citation score calculation */
export const SCORE_WEIGHTS = {
  uniqueData: 40,        // 40% - unique statistics, case studies, original research
  sourceAttribution: 20, // 20% - source citations and methodology descriptions
  quotableSnippets: 20,  // 20% - concise, quotable statements
  schemaCoverage: 20,    // 20% - FAQ or HowTo structured data
} as const;

/** Threshold below which recommendations are provided */
export const LOW_SCORE_THRESHOLD = 50;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Counts sentences with statistics in content
 */
function countStatisticSentences(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.filter(s => hasStatistic(s)).length;
}

/**
 * Counts sentences with attribution in content
 */
function countAttributionSentences(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.filter(s => hasAttribution(s)).length;
}

/**
 * Calculates unique data score (0-40)
 * Based on presence of statistics, specific data, and original claims
 */
function calculateUniqueDataScore(content: string): number {
  if (!content || content.trim().length === 0) {
    return 0;
  }

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalSentences = sentences.length;
  
  if (totalSentences === 0) {
    return 0;
  }

  const statisticCount = countStatisticSentences(content);
  const statisticRatio = statisticCount / totalSentences;

  // Score based on ratio of sentences with statistics
  // 20%+ sentences with stats = full score
  const normalizedRatio = Math.min(statisticRatio / 0.2, 1);
  
  return Math.round(normalizedRatio * SCORE_WEIGHTS.uniqueData);
}

/**
 * Calculates source attribution score (0-20)
 * Based on presence of citations, sources, and methodology descriptions
 */
function calculateAttributionScore(content: string): number {
  if (!content || content.trim().length === 0) {
    return 0;
  }

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalSentences = sentences.length;
  
  if (totalSentences === 0) {
    return 0;
  }

  const attributionCount = countAttributionSentences(content);
  const attributionRatio = attributionCount / totalSentences;

  // Score based on ratio of sentences with attribution
  // 10%+ sentences with attribution = full score
  const normalizedRatio = Math.min(attributionRatio / 0.1, 1);
  
  return Math.round(normalizedRatio * SCORE_WEIGHTS.sourceAttribution);
}

/**
 * Calculates quotable snippets score (0-20)
 * Based on presence of concise, high-scoring snippets
 */
function calculateSnippetsScore(content: string): number {
  if (!content || content.trim().length === 0) {
    return 0;
  }

  const snippets = extract(content);
  
  if (snippets.length === 0) {
    return 0;
  }

  // Average citation score of top snippets
  const avgScore = snippets.reduce((sum, s) => sum + s.citationScore, 0) / snippets.length;
  
  // Normalize to 0-20 range (max snippet score is 100)
  const normalizedScore = (avgScore / 100) * SCORE_WEIGHTS.quotableSnippets;
  
  return Math.round(normalizedScore);
}

/**
 * Calculates schema coverage score (0-20)
 * Based on presence of FAQ and HowTo schemas
 */
function calculateSchemaScore(content: string): number {
  if (!content || content.trim().length === 0) {
    return 0;
  }

  let score = 0;
  
  const faqSchema = extractFAQ(content);
  const howToSchema = extractHowTo(content);
  
  // 10 points for FAQ schema
  if (faqSchema && faqSchema.mainEntity.length > 0) {
    score += 10;
  }
  
  // 10 points for HowTo schema
  if (howToSchema && howToSchema.step.length > 0) {
    score += 10;
  }
  
  return score;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Calculates citation score for a page
 * Requirements: 6.1, 6.2, 6.3
 *
 * @param page - The page content to analyze
 * @returns CitationScore with total, breakdown, and recommendations
 */
export function calculate(page: PageContent): CitationScore {
  const content = page.content;
  
  const breakdown: CitationScoreBreakdown = {
    uniqueData: calculateUniqueDataScore(content),
    sourceAttribution: calculateAttributionScore(content),
    quotableSnippets: calculateSnippetsScore(content),
    schemaCoverage: calculateSchemaScore(content),
  };

  const total = breakdown.uniqueData + 
                breakdown.sourceAttribution + 
                breakdown.quotableSnippets + 
                breakdown.schemaCoverage;

  const recommendations = getRecommendations({ total, breakdown, recommendations: [] });

  return {
    total,
    breakdown,
    recommendations,
  };
}

/**
 * Gets recommendations for improving citation score
 * Requirements: 6.3
 *
 * @param score - The current citation score
 * @returns Array of specific recommendations
 */
export function getRecommendations(score: CitationScore): string[] {
  const recommendations: string[] = [];

  // Only provide recommendations if total score is below threshold
  if (score.total >= LOW_SCORE_THRESHOLD) {
    return recommendations;
  }

  // Check each component and add relevant recommendations
  if (score.breakdown.uniqueData < SCORE_WEIGHTS.uniqueData * 0.5) {
    recommendations.push(CITATION_RECOMMENDATIONS.lowUniqueData);
  }

  if (score.breakdown.sourceAttribution < SCORE_WEIGHTS.sourceAttribution * 0.5) {
    recommendations.push(CITATION_RECOMMENDATIONS.lowAttribution);
  }

  if (score.breakdown.quotableSnippets < SCORE_WEIGHTS.quotableSnippets * 0.5) {
    recommendations.push(CITATION_RECOMMENDATIONS.lowSnippets);
  }

  if (score.breakdown.schemaCoverage < SCORE_WEIGHTS.schemaCoverage * 0.5) {
    recommendations.push(CITATION_RECOMMENDATIONS.lowSchema);
  }

  return recommendations;
}

/**
 * Ranks pages by citation potential in descending order
 * Requirements: 6.5
 *
 * @param pages - Array of pages to rank
 * @returns Array of ranked pages with scores and top snippets
 */
export function rankPages(pages: PageContent[]): RankedPage[] {
  const rankedPages: RankedPage[] = pages.map(page => {
    const score = calculate(page);
    const snippets = extract(page.content);
    const topSnippet = snippets.length > 0 ? snippets[0].text : '';

    return {
      url: page.url,
      citationScore: score.total,
      topSnippet,
    };
  });

  // Sort by citation score descending
  rankedPages.sort((a, b) => b.citationScore - a.citationScore);

  return rankedPages;
}

// =============================================================================
// Factory Function
// =============================================================================

export interface CitationCalculator {
  calculate(page: PageContent): CitationScore;
  rankPages(pages: PageContent[]): RankedPage[];
  getRecommendations(score: CitationScore): string[];
}

/**
 * Creates a citation calculator instance
 */
export function createCitationCalculator(): CitationCalculator {
  return {
    calculate,
    rankPages,
    getRecommendations,
  };
}
