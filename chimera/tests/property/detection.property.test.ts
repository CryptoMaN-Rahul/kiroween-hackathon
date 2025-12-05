/**
 * Property-Based Tests for Agent Detection
 * 
 * Tests Property 21: Agent Detection and Classification
 * Tests Property 22: Agent Analytics Logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  detectAgentFromUserAgent, 
  AGENT_SIGNATURES,
  getKnownSignatures 
} from '../../src/lib/agent-detector';
import type { AgentType } from '../../src/types';

/**
 * **Feature: chimera-ai-first-edge, Property 21: Agent Detection and Classification**
 * **Validates: Requirements 8.1, 8.2**
 * 
 * For any HTTP request with a User-Agent header matching a known AI agent signature,
 * the detector SHALL correctly classify and tag the request with the appropriate agent type.
 */
describe('Property 21: Agent Detection and Classification', () => {
  // Generator for known agent User-Agent strings
  const knownAgentUserAgentGen = fc.oneof(
    // ChatGPT variants
    fc.constantFrom(
      'Mozilla/5.0 (compatible; ChatGPT-User/1.0)',
      'OpenAI-SearchBot/1.0',
      'GPTBot/1.0 (+https://openai.com/gptbot)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) ChatGPT/1.0'
    ),
    // Perplexity variants
    fc.constantFrom(
      'PerplexityBot/1.0',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0)',
      'Perplexity-User/1.0'
    ),
    // Claude variants
    fc.constantFrom(
      'ClaudeBot/1.0',
      'Anthropic-AI/1.0',
      'Mozilla/5.0 (compatible; Claude/1.0)'
    ),
    // Gemini variants
    fc.constantFrom(
      'Google-Extended/1.0',
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; Gemini/1.0)'
    ),
    // Generic bots
    fc.constantFrom(
      'Mozilla/5.0 (compatible; GenericBot/1.0)',
      'WebCrawler/1.0',
      'Spider/1.0',
      'DataScraper/1.0'
    )
  );

  // Generator for human-like User-Agent strings
  const humanUserAgentGen = fc.constantFrom(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  );

  it('should detect ChatGPT agents with high confidence', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'ChatGPT-User/1.0',
          'OpenAI-SearchBot',
          'GPTBot/1.0'
        ),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.type).toBe('ChatGPT');
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          expect(result.signals.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect Perplexity agents with high confidence', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'PerplexityBot/1.0',
          'Perplexity-User'
        ),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.type).toBe('Perplexity');
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect Claude agents with high confidence', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'ClaudeBot/1.0',
          'Anthropic-AI',
          'Claude-Web'
        ),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.type).toBe('Claude');
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect Gemini/Google agents with high confidence', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Google-Extended/1.0',
          'Googlebot/2.1',
          'Gemini-User'
        ),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.type).toBe('Gemini');
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect generic bots', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'SomeBot/1.0',
          'WebCrawler/2.0',
          'DataSpider/1.0',
          'ContentScraper/1.0'
        ),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.type).toBe('Generic-Bot');
          expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify human browsers correctly', () => {
    fc.assert(
      fc.property(humanUserAgentGen, (userAgent) => {
        const result = detectAgentFromUserAgent(userAgent);
        expect(result.type).toBe('Human');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      }),
      { numRuns: 100 }
    );
  });

  it('should always return a valid AgentType', () => {
    const validAgentTypes: AgentType[] = [
      'ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot', 'Human'
    ];

    fc.assert(
      fc.property(fc.string(), (userAgent) => {
        const result = detectAgentFromUserAgent(userAgent);
        expect(validAgentTypes).toContain(result.type);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(Array.isArray(result.signals)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should return confidence between 0 and 1 for any input', () => {
    fc.assert(
      fc.property(
        fc.oneof(knownAgentUserAgentGen, humanUserAgentGen, fc.string()),
        (userAgent) => {
          const result = detectAgentFromUserAgent(userAgent);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide signals explaining detection reasoning', () => {
    fc.assert(
      fc.property(knownAgentUserAgentGen, (userAgent) => {
        const result = detectAgentFromUserAgent(userAgent);
        if (result.type !== 'Human') {
          expect(result.signals.length).toBeGreaterThan(0);
          expect(result.signals.some(s => s.includes('matches'))).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: chimera-ai-first-edge, Property 22: Agent Analytics Logging**
 * **Validates: Requirements 8.3**
 * 
 * For any detected AI agent visit, the analytics log SHALL contain
 * agent type, requested path, and outcome (redirected/404/success).
 */
describe('Property 22: Agent Analytics Logging Structure', () => {
  // This tests the structure requirements for analytics logging
  // The actual logging is tested in integration tests
  
  it('should have all required signature fields', () => {
    const signatures = getKnownSignatures();
    
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: signatures.length - 1 }),
        (index) => {
          const signature = signatures[index];
          expect(signature).toHaveProperty('type');
          expect(signature).toHaveProperty('patterns');
          expect(signature).toHaveProperty('description');
          expect(Array.isArray(signature.patterns)).toBe(true);
          expect(signature.patterns.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have unique agent types in signatures', () => {
    const signatures = getKnownSignatures();
    const types = signatures.map(s => s.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it('detection result should have all fields needed for logging', () => {
    fc.assert(
      fc.property(fc.string(), (userAgent) => {
        const result = detectAgentFromUserAgent(userAgent);
        
        // All fields required for analytics logging
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('signals');
        
        // Type should be loggable
        expect(typeof result.type).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(Array.isArray(result.signals)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Additional detection edge cases
 */
describe('Agent Detection Edge Cases', () => {
  it('should handle empty User-Agent strings', () => {
    const result = detectAgentFromUserAgent('');
    expect(result.type).toBe('Human');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle very long User-Agent strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1000, maxLength: 5000 }),
        (longString) => {
          const result = detectAgentFromUserAgent(longString);
          expect(['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot', 'Human']).toContain(result.type);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should be case-insensitive for agent detection', () => {
    const variations = [
      'chatgpt', 'CHATGPT', 'ChatGPT', 'cHaTgPt',
      'perplexity', 'PERPLEXITY', 'Perplexity',
      'claude', 'CLAUDE', 'Claude',
      'googlebot', 'GOOGLEBOT', 'Googlebot'
    ];

    for (const ua of variations) {
      const result = detectAgentFromUserAgent(ua);
      expect(result.type).not.toBe('Human');
    }
  });

  it('should prioritize specific agents over generic bot detection', () => {
    // A User-Agent that matches both ChatGPT and generic bot patterns
    const result = detectAgentFromUserAgent('ChatGPT-Bot/1.0');
    expect(result.type).toBe('ChatGPT'); // Should be ChatGPT, not Generic-Bot
  });
});


/**
 * Property tests for Analytics Logger
 * 
 * **Feature: chimera-ai-first-edge, Property 22: Agent Analytics Logging**
 * **Validates: Requirements 8.3**
 */
import {
  logAnalytics,
  logAIAgentVisit,
  getAnalyticsRecords,
  getAIAgentTraffic,
  getHumanTraffic,
  getTrafficSummary,
  clearAnalytics,
  isValidAnalyticsRecord
} from '../../src/lib/analytics-logger';

describe('Property 22: Agent Analytics Logging', () => {
  beforeEach(() => {
    clearAnalytics();
  });

  // Generator for valid paths
  const pathGen = fc.array(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-_]+$/.test(s)),
    { minLength: 1, maxLength: 5 }
  ).map(parts => '/' + parts.join('/'));

  // Generator for agent types
  const agentTypeGen = fc.constantFrom<AgentType>(
    'ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot', 'Human'
  );

  // Generator for outcomes
  const outcomeGen = fc.constantFrom<'redirected' | '404' | 'success'>(
    'redirected', '404', 'success'
  );

  it('should log all required fields for any AI agent visit', () => {
    fc.assert(
      fc.property(pathGen, agentTypeGen, outcomeGen, (path, agentType, outcome) => {
        clearAnalytics();
        const record = logAIAgentVisit(path, agentType, outcome);
        
        // All required fields must be present
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('timestamp');
        expect(record).toHaveProperty('path');
        expect(record).toHaveProperty('agentType');
        expect(record).toHaveProperty('wasRedirected');
        expect(record).toHaveProperty('sessionId');
        
        // Values must be correct
        expect(record.path).toBe(path);
        expect(record.agentType).toBe(agentType);
        expect(record.wasRedirected).toBe(outcome === 'redirected');
      }),
      { numRuns: 100 }
    );
  });

  it('should separate AI traffic from human traffic', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(pathGen, agentTypeGen), { minLength: 1, maxLength: 20 }),
        (visits) => {
          clearAnalytics();
          
          for (const [path, agentType] of visits) {
            logAnalytics(path, agentType, false);
          }
          
          const aiTraffic = getAIAgentTraffic();
          const humanTraffic = getHumanTraffic();
          const allRecords = getAnalyticsRecords();
          
          // AI traffic should not include humans
          expect(aiTraffic.every(r => r.agentType !== 'Human')).toBe(true);
          
          // Human traffic should only include humans
          expect(humanTraffic.every(r => r.agentType === 'Human')).toBe(true);
          
          // Combined should equal total
          expect(aiTraffic.length + humanTraffic.length).toBe(allRecords.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly count traffic by agent type', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(pathGen, agentTypeGen), { minLength: 0, maxLength: 50 }),
        (visits) => {
          clearAnalytics();
          
          // Count expected visits per agent type
          const expectedCounts: Record<AgentType, number> = {
            'ChatGPT': 0,
            'Perplexity': 0,
            'Claude': 0,
            'Gemini': 0,
            'Bing': 0,
            'Generic-Bot': 0,
            'Human': 0
          };
          
          for (const [path, agentType] of visits) {
            logAnalytics(path, agentType, false);
            expectedCounts[agentType]++;
          }
          
          const summary = getTrafficSummary();
          
          // Summary should match expected counts
          for (const agentType of Object.keys(expectedCounts) as AgentType[]) {
            expect(summary[agentType]).toBe(expectedCounts[agentType]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique IDs for each record', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(pathGen, agentTypeGen), { minLength: 2, maxLength: 20 }),
        (visits) => {
          clearAnalytics();
          
          const ids = new Set<string>();
          for (const [path, agentType] of visits) {
            const record = logAnalytics(path, agentType, false);
            ids.add(record.id);
          }
          
          // All IDs should be unique
          expect(ids.size).toBe(visits.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate analytics records correctly', () => {
    fc.assert(
      fc.property(pathGen, agentTypeGen, (path, agentType) => {
        clearAnalytics();
        const record = logAnalytics(path, agentType, false);
        
        expect(isValidAnalyticsRecord(record)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid analytics records', () => {
    const invalidRecords = [
      null,
      undefined,
      {},
      { id: 123 }, // wrong type
      { id: 'test', timestamp: 'not a date' },
      { id: 'test', timestamp: new Date(), path: 123 },
    ];

    for (const invalid of invalidRecords) {
      expect(isValidAnalyticsRecord(invalid)).toBe(false);
    }
  });

  it('should preserve record order (FIFO)', () => {
    fc.assert(
      fc.property(
        fc.array(pathGen, { minLength: 2, maxLength: 10 }),
        (paths) => {
          clearAnalytics();
          
          const recordIds: string[] = [];
          for (const path of paths) {
            const record = logAnalytics(path, 'ChatGPT', false);
            recordIds.push(record.id);
          }
          
          const storedRecords = getAnalyticsRecords();
          const storedIds = storedRecords.map(r => r.id);
          
          // Order should be preserved
          expect(storedIds).toEqual(recordIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: chimera-geo-sdk-v2, Property 10: AI Agent Detection Consistency**
 * **Validates: Requirements 5.3**
 * 
 * For any request with a known AI crawler User-Agent (GPTBot, ClaudeBot, PerplexityBot),
 * the AgentDetectionService SHALL identify it as an AI agent with confidence > 0.8.
 */
import { 
  detectAgentEnhanced, 
  getRecommendedRendering,
  detectBehaviorSignals,
  BehaviorSignals
} from '../../src/lib/agent-detector';

describe('Property 10: AI Agent Detection Consistency', () => {
  // Mock NextRequest for testing
  const createMockRequest = (headers: Record<string, string>) => ({
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null
    }
  }) as unknown as import('next/server').NextRequest;

  it('known AI crawlers are detected with confidence > 0.8', () => {
    const knownCrawlers = [
      'GPTBot/1.0',
      'ClaudeBot/1.0',
      'PerplexityBot/1.0',
      'Google-Extended/1.0',
      'Anthropic-AI/1.0',
      'OpenAI-SearchBot/1.0'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...knownCrawlers),
        (userAgent) => {
          const request = createMockRequest({ 'user-agent': userAgent });
          const result = detectAgentEnhanced(request);
          
          expect(result.type).not.toBe('Human');
          expect(result.confidence).toBeGreaterThan(0.8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enhanced detection includes behavior signals', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'GPTBot/1.0',
          'Mozilla/5.0 Chrome/120.0.0.0',
          'ClaudeBot/1.0'
        ),
        (userAgent) => {
          const request = createMockRequest({ 'user-agent': userAgent });
          const result = detectAgentEnhanced(request);
          
          expect(result).toHaveProperty('behaviorSignals');
          expect(result.behaviorSignals).toHaveProperty('acceptsJson');
          expect(result.behaviorSignals).toHaveProperty('noJsExecution');
          expect(result.behaviorSignals).toHaveProperty('rapidRequests');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enhanced detection includes rendering recommendation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'GPTBot/1.0',
          'Mozilla/5.0 Chrome/120.0.0.0',
          'ClaudeBot/1.0'
        ),
        (userAgent) => {
          const request = createMockRequest({ 'user-agent': userAgent });
          const result = detectAgentEnhanced(request);
          
          expect(result).toHaveProperty('recommendedRendering');
          expect(['ssr', 'csr', 'json']).toContain(result.recommendedRendering);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('behavior signals boost confidence for AI agents', () => {
    // AI agent with JSON preference should have higher confidence
    const requestWithJson = createMockRequest({ 
      'user-agent': 'GPTBot/1.0',
      'accept': 'application/json'
    });
    const requestWithoutJson = createMockRequest({ 
      'user-agent': 'GPTBot/1.0',
      'accept': 'text/html'
    });
    
    const resultWithJson = detectAgentEnhanced(requestWithJson);
    const resultWithoutJson = detectAgentEnhanced(requestWithoutJson);
    
    // Both should be detected as AI agents
    expect(resultWithJson.type).not.toBe('Human');
    expect(resultWithoutJson.type).not.toBe('Human');
    
    // JSON preference should boost confidence
    expect(resultWithJson.confidence).toBeGreaterThanOrEqual(resultWithoutJson.confidence);
  });
});

/**
 * Tests for getRecommendedRendering function
 */
describe('getRecommendedRendering', () => {
  it('returns csr for human users', () => {
    fc.assert(
      fc.property(
        fc.record({
          acceptsJson: fc.boolean(),
          noJsExecution: fc.boolean(),
          rapidRequests: fc.boolean()
        }),
        (behaviorSignals: BehaviorSignals) => {
          const result = getRecommendedRendering(
            { type: 'Human', confidence: 0.9, signals: [] },
            behaviorSignals
          );
          expect(result).toBe('csr');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns json for AI agents that accept JSON', () => {
    const aiAgentTypes: AgentType[] = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...aiAgentTypes),
        (agentType) => {
          const result = getRecommendedRendering(
            { type: agentType, confidence: 0.9, signals: [] },
            { acceptsJson: true, noJsExecution: false, rapidRequests: false }
          );
          expect(result).toBe('json');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns ssr for AI agents that do not execute JS', () => {
    const aiAgentTypes: AgentType[] = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...aiAgentTypes),
        (agentType) => {
          const result = getRecommendedRendering(
            { type: agentType, confidence: 0.9, signals: [] },
            { acceptsJson: false, noJsExecution: true, rapidRequests: false }
          );
          expect(result).toBe('ssr');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns ssr as default for AI agents without specific signals', () => {
    const aiAgentTypes: AgentType[] = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...aiAgentTypes),
        (agentType) => {
          const result = getRecommendedRendering(
            { type: agentType, confidence: 0.9, signals: [] },
            { acceptsJson: false, noJsExecution: false, rapidRequests: false }
          );
          expect(result).toBe('ssr');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('json takes priority over ssr when both signals present', () => {
    const aiAgentTypes: AgentType[] = ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...aiAgentTypes),
        (agentType) => {
          const result = getRecommendedRendering(
            { type: agentType, confidence: 0.9, signals: [] },
            { acceptsJson: true, noJsExecution: true, rapidRequests: false }
          );
          // JSON preference takes priority
          expect(result).toBe('json');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Tests for detectBehaviorSignals function
 */
describe('detectBehaviorSignals', () => {
  const createMockRequest = (headers: Record<string, string>) => ({
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null
    }
  }) as unknown as import('next/server').NextRequest;

  it('detects JSON acceptance from Accept header', () => {
    const jsonAcceptHeaders = [
      'application/json',
      'application/ld+json',
      'application/json, text/html',
      'text/html, application/json'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...jsonAcceptHeaders),
        (acceptHeader) => {
          const request = createMockRequest({ 
            'accept': acceptHeader,
            'user-agent': 'TestBot/1.0'
          });
          const signals = detectBehaviorSignals(request);
          expect(signals.acceptsJson).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects no JS execution from missing browser signatures', () => {
    const nonBrowserUserAgents = [
      'GPTBot/1.0',
      'ClaudeBot/1.0',
      'curl/7.64.1',
      'Python-urllib/3.9'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...nonBrowserUserAgents),
        (userAgent) => {
          const request = createMockRequest({ 'user-agent': userAgent });
          const signals = detectBehaviorSignals(request);
          expect(signals.noJsExecution).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects browser signatures correctly', () => {
    const browserUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Mozilla/5.0 Safari/605.1.15',
      'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...browserUserAgents),
        (userAgent) => {
          const request = createMockRequest({ 'user-agent': userAgent });
          const signals = detectBehaviorSignals(request);
          expect(signals.noJsExecution).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid BehaviorSignals structure for any request', () => {
    fc.assert(
      fc.property(
        fc.record({
          'user-agent': fc.string(),
          'accept': fc.string(),
          'x-forwarded-for': fc.option(fc.ipV4(), { nil: undefined })
        }),
        (headers) => {
          const cleanHeaders: Record<string, string> = {};
          if (headers['user-agent']) cleanHeaders['user-agent'] = headers['user-agent'];
          if (headers['accept']) cleanHeaders['accept'] = headers['accept'];
          if (headers['x-forwarded-for']) cleanHeaders['x-forwarded-for'] = headers['x-forwarded-for'];
          
          const request = createMockRequest(cleanHeaders);
          const signals = detectBehaviorSignals(request);
          
          expect(typeof signals.acceptsJson).toBe('boolean');
          expect(typeof signals.noJsExecution).toBe('boolean');
          expect(typeof signals.rapidRequests).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
