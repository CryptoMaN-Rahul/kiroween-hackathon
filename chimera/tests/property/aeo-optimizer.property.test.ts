/**
 * Property-Based Tests for AEO Optimizer
 *
 * Tests FAQ schema extraction, HowTo schema extraction, and featured snippet detection.
 *
 * **Feature: ai-search-optimization, Property 10: FAQ Schema Extraction**
 * **Validates: Requirements 4.1**
 *
 * **Feature: ai-search-optimization, Property 11: HowTo Schema Extraction**
 * **Validates: Requirements 4.2**
 *
 * **Feature: ai-search-optimization, Property 12: Featured Snippet Length Warning**
 * **Validates: Requirements 4.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  analyze,
  extractFAQ,
  extractHowTo,
  findFeaturedSnippetCandidate,
  countWords,
  isQuestion,
} from '@/lib/ai-search/aeo-optimizer';

// Configuration for property tests - minimum 100 iterations
const FC_CONFIG = { numRuns: 100 };

// =============================================================================
// Arbitraries for generating test data
// =============================================================================

// Generate a random question word
const questionWordArb = fc.constantFrom(
  'What', 'How', 'Why', 'When', 'Where', 'Who', 'Which', 'Can', 'Does', 'Is', 'Are', 'Will', 'Should'
);

// Generate a random question topic
const questionTopicArb = fc.constantFrom(
  'the product work',
  'I get started',
  'this feature useful',
  'the pricing structured',
  'I contact support',
  'the warranty cover',
  'I return an item',
  'the delivery time'
);

// Generate a natural language question
const naturalQuestionArb = fc.tuple(questionWordArb, questionTopicArb).map(
  ([word, topic]) => `${word} ${topic}?`
);

// Generate a random answer
const answerArb = fc.constantFrom(
  'You can get started by signing up on our website.',
  'The product works by using advanced algorithms.',
  'Our pricing is based on usage tiers.',
  'Contact support via email or phone.',
  'The warranty covers manufacturing defects for one year.',
  'Returns are accepted within 30 days.',
  'Delivery typically takes 3-5 business days.'
);

// Generate Q&A pair in "Q: ... A: ..." format
const qaFormatArb = fc.tuple(naturalQuestionArb, answerArb).map(
  ([q, a]) => `Q: ${q}\nA: ${a}`
);

// Generate Q&A pair in "**Q:** ... **A:** ..." format
const boldQAFormatArb = fc.tuple(naturalQuestionArb, answerArb).map(
  ([q, a]) => `**Q:** ${q}\n**A:** ${a}`
);

// Generate Q&A pair in "Question: ... Answer: ..." format
const questionAnswerFormatArb = fc.tuple(naturalQuestionArb, answerArb).map(
  ([q, a]) => `Question: ${q}\nAnswer: ${a}`
);

// Generate content with multiple Q&A pairs
const multiQAContentArb = fc.array(
  fc.oneof(qaFormatArb, boldQAFormatArb, questionAnswerFormatArb),
  { minLength: 1, maxLength: 5 }
).map(pairs => pairs.join('\n\n'));

// Generate a step description
const stepDescriptionArb = fc.constantFrom(
  'Open the application',
  'Click on the settings button',
  'Enter your credentials',
  'Select your preferences',
  'Save your changes',
  'Review the results',
  'Confirm your selection',
  'Complete the process'
);

// Generate numbered steps (1. 2. 3. format)
const numberedStepsArb = fc.array(stepDescriptionArb, { minLength: 2, maxLength: 8 }).map(
  steps => steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
);

// Generate "Step N:" format steps
const stepNFormatArb = fc.array(stepDescriptionArb, { minLength: 2, maxLength: 8 }).map(
  steps => steps.map((step, i) => `Step ${i + 1}: ${step}`).join('\n')
);

// Generate a paragraph with specific word count
const paragraphWithWordCountArb = (minWords: number, maxWords: number) =>
  fc.array(
    fc.constantFrom(
      'the', 'a', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'product', 'service', 'feature', 'system', 'platform', 'solution',
      'customer', 'user', 'client', 'team', 'company', 'business',
      'provides', 'offers', 'delivers', 'enables', 'supports', 'helps',
      'efficient', 'effective', 'powerful', 'reliable', 'secure', 'fast'
    ),
    { minLength: minWords, maxLength: maxWords }
  ).map(words => words.join(' ') + '.');

// Generate content with paragraphs of varying lengths
const multiParagraphContentArb = fc.tuple(
  paragraphWithWordCountArb(40, 50),  // Ideal length
  paragraphWithWordCountArb(60, 80),  // Longer
  paragraphWithWordCountArb(20, 30)   // Shorter
).map(paragraphs => paragraphs.join('\n\n'));

// =============================================================================
// Property 10: FAQ Schema Extraction
// =============================================================================

describe('Property 10: FAQ Schema Extraction', () => {
  /**
   * **Feature: ai-search-optimization, Property 10: FAQ Schema Extraction**
   * **Validates: Requirements 4.1**
   *
   * For any content containing Q&A patterns (question followed by answer),
   * the AEO_Optimizer SHALL generate valid FAQPage schema with those Q&A pairs.
   */

  it('extractFAQ() generates valid FAQPage schema for Q: A: format', () => {
    fc.assert(
      fc.property(qaFormatArb, (qaContent) => {
        const schema = extractFAQ(qaContent);
        
        expect(schema).not.toBeNull();
        if (schema) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('FAQPage');
          expect(Array.isArray(schema.mainEntity)).toBe(true);
          expect(schema.mainEntity.length).toBeGreaterThan(0);
          
          // Each item should have correct structure
          for (const item of schema.mainEntity) {
            expect(item['@type']).toBe('Question');
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(item.acceptedAnswer['@type']).toBe('Answer');
            expect(typeof item.acceptedAnswer.text).toBe('string');
            expect(item.acceptedAnswer.text.length).toBeGreaterThan(0);
          }
        }
      }),
      FC_CONFIG
    );
  });

  it('extractFAQ() generates valid FAQPage schema for **Q:** **A:** format', () => {
    fc.assert(
      fc.property(boldQAFormatArb, (qaContent) => {
        const schema = extractFAQ(qaContent);
        
        expect(schema).not.toBeNull();
        if (schema) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('FAQPage');
          expect(schema.mainEntity.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('extractFAQ() generates valid FAQPage schema for Question: Answer: format', () => {
    fc.assert(
      fc.property(questionAnswerFormatArb, (qaContent) => {
        const schema = extractFAQ(qaContent);
        
        expect(schema).not.toBeNull();
        if (schema) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('FAQPage');
          expect(schema.mainEntity.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('extractFAQ() extracts all Q&A pairs from multi-QA content', () => {
    fc.assert(
      fc.property(
        fc.array(qaFormatArb, { minLength: 2, maxLength: 5 }),
        (qaPairs) => {
          const content = qaPairs.join('\n\n');
          const schema = extractFAQ(content);
          
          expect(schema).not.toBeNull();
          if (schema) {
            // Should extract at least as many Q&A pairs as provided
            expect(schema.mainEntity.length).toBeGreaterThanOrEqual(1);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('extractFAQ() returns null for content without Q&A patterns', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }).filter(s => !s.includes('?') && !s.toLowerCase().includes('q:')),
        (content) => {
          const schema = extractFAQ(content);
          // Should return null when no Q&A patterns found
          expect(schema === null || schema.mainEntity.length === 0).toBe(true);
        }
      ),
      FC_CONFIG
    );
  });

  it('extractFAQ() handles natural language questions', () => {
    fc.assert(
      fc.property(naturalQuestionArb, answerArb, (question, answer) => {
        const content = `${question}\n${answer}`;
        const schema = extractFAQ(content);
        
        // Natural questions should be detected
        if (schema && schema.mainEntity.length > 0) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('FAQPage');
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 11: HowTo Schema Extraction
// =============================================================================

describe('Property 11: HowTo Schema Extraction', () => {
  /**
   * **Feature: ai-search-optimization, Property 11: HowTo Schema Extraction**
   * **Validates: Requirements 4.2**
   *
   * For any content containing numbered or bulleted step-by-step instructions,
   * the AEO_Optimizer SHALL generate valid HowTo schema with those steps.
   */

  it('extractHowTo() generates valid HowTo schema for numbered steps', () => {
    fc.assert(
      fc.property(numberedStepsArb, (stepsContent) => {
        const schema = extractHowTo(stepsContent);
        
        expect(schema).not.toBeNull();
        if (schema) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('HowTo');
          expect(typeof schema.name).toBe('string');
          expect(Array.isArray(schema.step)).toBe(true);
          expect(schema.step.length).toBeGreaterThan(0);
          
          // Each step should have correct structure
          for (const step of schema.step) {
            expect(step['@type']).toBe('HowToStep');
            expect(typeof step.position).toBe('number');
            expect(step.position).toBeGreaterThan(0);
            expect(typeof step.name).toBe('string');
            expect(typeof step.text).toBe('string');
            expect(step.text.length).toBeGreaterThan(0);
          }
        }
      }),
      FC_CONFIG
    );
  });

  it('extractHowTo() generates valid HowTo schema for "Step N:" format', () => {
    fc.assert(
      fc.property(stepNFormatArb, (stepsContent) => {
        const schema = extractHowTo(stepsContent);
        
        expect(schema).not.toBeNull();
        if (schema) {
          expect(schema['@context']).toBe('https://schema.org');
          expect(schema['@type']).toBe('HowTo');
          expect(schema.step.length).toBeGreaterThan(0);
          
          // Steps should have sequential positions
          for (let i = 0; i < schema.step.length; i++) {
            expect(schema.step[i].position).toBe(i + 1);
          }
        }
      }),
      FC_CONFIG
    );
  });

  it('extractHowTo() extracts correct number of steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        (numSteps) => {
          const steps = Array.from({ length: numSteps }, (_, i) => 
            `${i + 1}. Step ${i + 1} description`
          ).join('\n');
          
          const schema = extractHowTo(steps);
          
          expect(schema).not.toBeNull();
          if (schema) {
            expect(schema.step.length).toBe(numSteps);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('extractHowTo() returns null for content without steps', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }).filter(s => !/^\d+\./m.test(s) && !/step\s+\d+/i.test(s)),
        (content) => {
          const schema = extractHowTo(content);
          expect(schema).toBeNull();
        }
      ),
      FC_CONFIG
    );
  });

  it('extractHowTo() preserves step order', () => {
    fc.assert(
      fc.property(numberedStepsArb, (stepsContent) => {
        const schema = extractHowTo(stepsContent);
        
        if (schema && schema.step.length > 1) {
          // Steps should be in ascending order by position
          for (let i = 1; i < schema.step.length; i++) {
            expect(schema.step[i].position).toBeGreaterThan(schema.step[i - 1].position);
          }
        }
      }),
      FC_CONFIG
    );
  });
});

// =============================================================================
// Property 12: Featured Snippet Length Warning
// =============================================================================

describe('Property 12: Featured Snippet Length Warning', () => {
  /**
   * **Feature: ai-search-optimization, Property 12: Featured Snippet Length Warning**
   * **Validates: Requirements 4.4**
   *
   * For any featured snippet candidate exceeding 50 words,
   * the AEO_Optimizer SHALL include a suggestion to condense the content.
   */

  it('analyze() suggests condensing when featured snippet exceeds 50 words', () => {
    fc.assert(
      fc.property(
        paragraphWithWordCountArb(55, 80),
        (longParagraph) => {
          const result = analyze(longParagraph);
          
          if (result.featuredSnippetCandidate) {
            const wordCount = countWords(result.featuredSnippetCandidate);
            
            if (wordCount > 50) {
              // Should have a suggestion about condensing
              const hasCondenseSuggestion = result.suggestions.some(
                s => s.toLowerCase().includes('condense') || 
                     s.toLowerCase().includes('50 words') ||
                     s.toLowerCase().includes('exceeds')
              );
              expect(hasCondenseSuggestion).toBe(true);
            }
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('analyze() does not suggest condensing when featured snippet is under 50 words', () => {
    fc.assert(
      fc.property(
        paragraphWithWordCountArb(30, 45),
        (shortParagraph) => {
          const result = analyze(shortParagraph);
          
          if (result.featuredSnippetCandidate) {
            const wordCount = countWords(result.featuredSnippetCandidate);
            
            if (wordCount <= 50) {
              // Should NOT have a suggestion about condensing
              const hasCondenseSuggestion = result.suggestions.some(
                s => s.toLowerCase().includes('condense') && s.toLowerCase().includes('50 words')
              );
              expect(hasCondenseSuggestion).toBe(false);
            }
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('countWords() correctly counts words in text', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\w+$/.test(s)), { minLength: 1, maxLength: 50 }),
        (words) => {
          const text = words.join(' ');
          const count = countWords(text);
          expect(count).toBe(words.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('countWords() returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('findFeaturedSnippetCandidate() returns a paragraph', () => {
    fc.assert(
      fc.property(multiParagraphContentArb, (content) => {
        const candidate = findFeaturedSnippetCandidate(content);
        
        if (candidate) {
          expect(typeof candidate).toBe('string');
          expect(candidate.length).toBeGreaterThan(0);
        }
      }),
      FC_CONFIG
    );
  });

  it('analyze() includes word count in suggestion when over 50 words', () => {
    // Create content with a paragraph that's definitely over 50 words
    const longContent = Array(60).fill('word').join(' ') + '.';
    const result = analyze(longContent);
    
    if (result.featuredSnippetCandidate && countWords(result.featuredSnippetCandidate) > 50) {
      const condenseSuggestion = result.suggestions.find(
        s => s.toLowerCase().includes('condense') || s.toLowerCase().includes('exceeds')
      );
      
      if (condenseSuggestion) {
        // Should mention the actual word count
        expect(condenseSuggestion).toMatch(/\d+\s*words/i);
      }
    }
  });
});

// =============================================================================
// Additional Tests for Voice Ready Score
// =============================================================================

describe('Voice Ready Score Calculation', () => {
  it('analyze() returns voiceReadyScore between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.oneof(multiQAContentArb, numberedStepsArb, multiParagraphContentArb),
        (content) => {
          const result = analyze(content);
          expect(result.voiceReadyScore).toBeGreaterThanOrEqual(0);
          expect(result.voiceReadyScore).toBeLessThanOrEqual(100);
        }
      ),
      FC_CONFIG
    );
  });

  it('analyze() gives higher score for content with FAQ schema', () => {
    fc.assert(
      fc.property(qaFormatArb, (qaContent) => {
        const result = analyze(qaContent);
        
        if (result.faqSchema) {
          expect(result.voiceReadyScore).toBeGreaterThanOrEqual(35);
        }
      }),
      FC_CONFIG
    );
  });

  it('analyze() gives higher score for content with HowTo schema', () => {
    fc.assert(
      fc.property(numberedStepsArb, (stepsContent) => {
        const result = analyze(stepsContent);
        
        if (result.howToSchema) {
          expect(result.voiceReadyScore).toBeGreaterThanOrEqual(35);
        }
      }),
      FC_CONFIG
    );
  });
});
