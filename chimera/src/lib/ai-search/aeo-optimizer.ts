/**
 * AEO (Answer Engine Optimization) Optimizer
 *
 * Optimizes content for voice assistants and featured snippets by extracting
 * FAQ schemas, HowTo schemas, and identifying featured snippet candidates.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import {
  AEOResult,
  FAQSchema,
  FAQItem,
  HowToSchema,
  HowToStep,
} from './types';

// =============================================================================
// Q&A Detection Patterns (Requirement 4.1)
// =============================================================================

/** Patterns for detecting questions */
export const QUESTION_PATTERNS: RegExp[] = [
  /^(what|how|why|when|where|who|which|can|does|is|are|will|should)\s+.+\?/im,
  /^\*\*Q:\*\*\s*(.+)/m,
  /^Q:\s*(.+)/m,
  /^Question:\s*(.+)/im,
];

/** Pattern to match Q&A blocks in various formats */
export const QA_BLOCK_PATTERNS: RegExp[] = [
  // **Q:** Question? **A:** Answer format
  /\*\*Q:\*\*\s*(.+?)\s*\*\*A:\*\*\s*(.+?)(?=\*\*Q:\*\*|$)/gi,
  // Q: Question? A: Answer format
  /Q:\s*(.+?)\s*A:\s*(.+?)(?=Q:|$)/gi,
  // Question: ... Answer: ... format
  /Question:\s*(.+?)\s*Answer:\s*(.+?)(?=Question:|$)/gi,
];

// =============================================================================
// Step Detection Patterns (Requirement 4.2)
// =============================================================================

/** Patterns for detecting numbered steps */
export const STEP_PATTERNS: RegExp[] = [
  /^(\d+)\.\s+(.+)/gm,           // 1. Step text
  /^Step\s+(\d+):\s*(.+)/gim,    // Step 1: text
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Counts words in a text string
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Splits content into paragraphs
 */
export function splitIntoParagraphs(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }
  return content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Checks if a line is a question
 */
export function isQuestion(line: string): boolean {
  const trimmed = line.trim();
  return QUESTION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Extracts question text from various formats
 */
export function extractQuestionText(line: string): string {
  const trimmed = line.trim();
  
  // Try **Q:** format
  const boldQMatch = trimmed.match(/^\*\*Q:\*\*\s*(.+)/i);
  if (boldQMatch) return boldQMatch[1].trim();
  
  // Try Q: format
  const qMatch = trimmed.match(/^Q:\s*(.+)/i);
  if (qMatch) return qMatch[1].trim();
  
  // Try Question: format
  const questionMatch = trimmed.match(/^Question:\s*(.+)/i);
  if (questionMatch) return questionMatch[1].trim();
  
  // Return as-is for natural questions
  return trimmed;
}

// =============================================================================
// FAQ Schema Extraction (Requirement 4.1)
// =============================================================================

/**
 * Extracts FAQ schema from content containing Q&A patterns
 * Requirements: 4.1
 *
 * @param content - The content to analyze
 * @returns FAQSchema if Q&A patterns found, null otherwise
 */
export function extractFAQ(content: string): FAQSchema | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  const faqItems: FAQItem[] = [];

  // Try structured Q&A block patterns first
  for (const pattern of QA_BLOCK_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      if (question && answer) {
        faqItems.push({
          '@type': 'Question',
          name: question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
        });
      }
    }
  }

  // If no structured Q&A found, try line-by-line question detection
  if (faqItems.length === 0) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (isQuestion(line)) {
        const question = extractQuestionText(line);
        // Look for answer in next non-empty line(s)
        let answer = '';
        let j = i + 1;
        while (j < lines.length && !isQuestion(lines[j])) {
          // Skip A: or Answer: prefix if present
          let answerLine = lines[j];
          const aMatch = answerLine.match(/^(?:\*\*)?A(?:nswer)?:\*?\*?\s*(.+)/i);
          if (aMatch) {
            answerLine = aMatch[1];
          }
          answer += (answer ? ' ' : '') + answerLine;
          j++;
        }
        
        if (question && answer.trim()) {
          faqItems.push({
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer.trim(),
            },
          });
        }
      }
    }
  }

  if (faqItems.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems,
  };
}

// =============================================================================
// HowTo Schema Extraction (Requirement 4.2)
// =============================================================================

/**
 * Extracts HowTo schema from content containing step-by-step instructions
 * Requirements: 4.2
 *
 * @param content - The content to analyze
 * @returns HowToSchema if steps found, null otherwise
 */
export function extractHowTo(content: string): HowToSchema | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  const steps: HowToStep[] = [];
  
  // Try "Step N:" pattern first
  const stepNPattern = /^Step\s+(\d+):\s*(.+)/gim;
  let match;
  while ((match = stepNPattern.exec(content)) !== null) {
    const position = parseInt(match[1], 10);
    const text = match[2].trim();
    if (text) {
      steps.push({
        '@type': 'HowToStep',
        position,
        name: `Step ${position}`,
        text,
      });
    }
  }

  // If no "Step N:" found, try numbered list pattern (1. 2. 3.)
  if (steps.length === 0) {
    const numberedPattern = /^(\d+)\.\s+(.+)/gm;
    while ((match = numberedPattern.exec(content)) !== null) {
      const position = parseInt(match[1], 10);
      const text = match[2].trim();
      if (text) {
        steps.push({
          '@type': 'HowToStep',
          position,
          name: `Step ${position}`,
          text,
        });
      }
    }
  }

  if (steps.length === 0) {
    return null;
  }

  // Sort by position and ensure sequential numbering
  steps.sort((a, b) => a.position - b.position);

  // Extract a title from the content (first heading or first line)
  const titleMatch = content.match(/^#\s+(.+)/m) || content.match(/^(.+?)(?:\n|$)/);
  const name = titleMatch ? titleMatch[1].trim() : 'How To Guide';

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps,
  };
}

// =============================================================================
// Featured Snippet Candidate Detection (Requirement 4.3, 4.4)
// =============================================================================

/**
 * Finds the most concise answer paragraph as a featured snippet candidate
 * Requirements: 4.3, 4.4
 *
 * @param content - The content to analyze
 * @returns The best featured snippet candidate, or null if none found
 */
export function findFeaturedSnippetCandidate(content: string): string | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  const paragraphs = splitIntoParagraphs(content);
  
  if (paragraphs.length === 0) {
    return null;
  }

  // Filter out very short paragraphs (likely headings) and very long ones
  const candidates = paragraphs.filter(p => {
    const wordCount = countWords(p);
    return wordCount >= 10 && wordCount <= 100;
  });

  if (candidates.length === 0) {
    // Fall back to first substantial paragraph
    const firstSubstantial = paragraphs.find(p => countWords(p) >= 5);
    return firstSubstantial || paragraphs[0];
  }

  // Find the most concise candidate (closest to 40-50 words is ideal for featured snippets)
  const idealWordCount = 45;
  candidates.sort((a, b) => {
    const aDiff = Math.abs(countWords(a) - idealWordCount);
    const bDiff = Math.abs(countWords(b) - idealWordCount);
    return aDiff - bDiff;
  });

  return candidates[0];
}

// =============================================================================
// Main Analysis Function
// =============================================================================

/**
 * Analyzes content for AEO optimization opportunities
 * Requirements: 4.1, 4.2, 4.3, 4.4
 *
 * @param content - The content to analyze
 * @returns AEOResult with schemas, featured snippet candidate, and suggestions
 */
export function analyze(content: string): AEOResult {
  const suggestions: string[] = [];
  
  // Extract schemas
  const faqSchema = extractFAQ(content);
  const howToSchema = extractHowTo(content);
  const featuredSnippetCandidate = findFeaturedSnippetCandidate(content);

  // Calculate voice-ready score (0-100)
  let voiceReadyScore = 0;
  
  if (faqSchema && faqSchema.mainEntity.length > 0) {
    voiceReadyScore += 35;
  } else {
    suggestions.push('Add Q&A content to generate FAQ schema for voice search');
  }
  
  if (howToSchema && howToSchema.step.length > 0) {
    voiceReadyScore += 35;
  } else {
    suggestions.push('Add numbered step-by-step instructions to generate HowTo schema');
  }
  
  if (featuredSnippetCandidate) {
    const wordCount = countWords(featuredSnippetCandidate);
    if (wordCount <= 50) {
      voiceReadyScore += 30;
    } else {
      voiceReadyScore += 15;
      // Requirement 4.4: Suggest condensing if over 50 words
      suggestions.push(`Featured snippet candidate exceeds 50 words (${wordCount} words). Consider condensing for better voice search compatibility.`);
    }
  } else {
    suggestions.push('Add a concise answer paragraph (40-50 words) as a featured snippet candidate');
  }

  return {
    faqSchema,
    howToSchema,
    featuredSnippetCandidate,
    voiceReadyScore,
    suggestions,
  };
}

// =============================================================================
// Factory Function
// =============================================================================

export interface AEOOptimizer {
  analyze(content: string): AEOResult;
  extractFAQ(content: string): FAQSchema | null;
  extractHowTo(content: string): HowToSchema | null;
  findFeaturedSnippetCandidate(content: string): string | null;
  countWords(text: string): number;
}

/**
 * Creates an AEO optimizer instance
 */
export function createAEOOptimizer(): AEOOptimizer {
  return {
    analyze,
    extractFAQ,
    extractHowTo,
    findFeaturedSnippetCandidate,
    countWords,
  };
}
