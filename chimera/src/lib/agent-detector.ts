/**
 * AI Agent Detector
 * 
 * Identifies AI agents (ChatGPT, Perplexity, Claude, etc.) from request signatures.
 * Enhanced with behavior signals and rendering recommendations.
 * 
 * @module agent-detector
 */

import type { NextRequest } from 'next/server';
import type { AgentDetectionResult, AgentSignature } from '@/types';

/**
 * Behavior signals detected from request patterns.
 */
export interface BehaviorSignals {
  /** Agent prefers JSON responses */
  acceptsJson: boolean;
  /** Agent doesn't execute JavaScript */
  noJsExecution: boolean;
  /** Agent is making rapid sequential requests */
  rapidRequests: boolean;
}

/**
 * Enhanced agent detection result with rendering recommendation.
 */
export interface EnhancedAgentDetectionResult extends AgentDetectionResult {
  /** Recommended rendering strategy for this agent */
  recommendedRendering: 'ssr' | 'csr' | 'json';
  /** Behavior signals detected from request */
  behaviorSignals: BehaviorSignals;
}

/**
 * LRU Cache for request timing tracking.
 * Prevents memory leaks under high load by evicting oldest entries.
 */
class LRUTimingCache {
  private cache: Map<string, { timings: number[]; lastAccess: number }> = new Map();
  private readonly maxSize: number;
  private readonly windowMs: number;

  constructor(maxSize: number = 5000, windowMs: number = 5000) {
    this.maxSize = maxSize;
    this.windowMs = windowMs;
  }

  get(key: string): number[] {
    const entry = this.cache.get(key);
    if (!entry) return [];
    
    const now = Date.now();
    const recentTimings = entry.timings.filter(t => now - t < this.windowMs);
    entry.timings = recentTimings;
    entry.lastAccess = now;
    
    return recentTimings;
  }

  record(key: string): number[] {
    const now = Date.now();
    const existing = this.get(key);
    existing.push(now);
    
    this.cache.set(key, { timings: existing, lastAccess: now });
    this.evictIfNeeded();
    
    return existing;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;
    
    const evictCount = Math.max(1, Math.floor(this.cache.size * 0.1));
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const requestTimings = new LRUTimingCache(5000, 5000);
const RAPID_REQUEST_THRESHOLD = 5;

/**
 * Known AI agent signatures with comprehensive patterns.
 */
export const AGENT_SIGNATURES: AgentSignature[] = [
  {
    type: 'ChatGPT',
    patterns: [/ChatGPT/i, /OpenAI/i, /GPTBot/i, /OAI-SearchBot/i],
    description: 'OpenAI ChatGPT browsing agent'
  },
  {
    type: 'Perplexity',
    patterns: [/PerplexityBot/i, /Perplexity/i],
    description: 'Perplexity AI search agent'
  },
  {
    type: 'Claude',
    patterns: [/ClaudeBot/i, /Anthropic/i, /Claude-Web/i, /\bClaude\b/i],
    description: 'Anthropic Claude agent'
  },
  {
    type: 'Gemini',
    patterns: [/Google-Extended/i, /Gemini/i, /Google-InspectionTool/i, /Googlebot/i],
    description: 'Google Gemini agent'
  },
  {
    type: 'Bing',
    patterns: [/bingbot/i, /BingPreview/i, /msnbot/i],
    description: 'Microsoft Bing crawler'
  },
  {
    type: 'Generic-Bot',
    patterns: [/bot\b/i, /crawler/i, /spider/i, /scraper/i, /headless/i],
    description: 'Generic bot or crawler'
  }
];

export function detectAgent(request: NextRequest): AgentDetectionResult {
  const userAgent = request.headers.get('user-agent') || '';
  const signals: string[] = [];
  
  for (const signature of AGENT_SIGNATURES) {
    for (const pattern of signature.patterns) {
      if (pattern.test(userAgent)) {
        signals.push(`User-Agent matches: ${pattern.source}`);
        return { type: signature.type, confidence: 0.9, signals };
      }
    }
  }

  const acceptHeader = request.headers.get('accept') || '';
  const hasJsonPreference = acceptHeader.includes('application/json');
  
  if (hasJsonPreference && !userAgent.includes('Mozilla')) {
    signals.push('Prefers JSON, no browser signature');
    return { type: 'Generic-Bot', confidence: 0.6, signals };
  }

  return { type: 'Human', confidence: 0.8, signals: ['No bot signatures detected'] };
}

export function detectBehaviorSignals(request: NextRequest): BehaviorSignals {
  const acceptHeader = request.headers.get('accept') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 'unknown';
  
  const acceptsJson = acceptHeader.includes('application/json') || 
                      acceptHeader.includes('application/ld+json');
  
  const noJsExecution = !userAgent.includes('Mozilla') && 
                        !userAgent.includes('Chrome') && 
                        !userAgent.includes('Safari') &&
                        !request.headers.get('sec-ch-ua');
  
  const recentTimings = requestTimings.record(clientIp);
  const rapidRequests = recentTimings.length >= RAPID_REQUEST_THRESHOLD;
  
  return { acceptsJson, noJsExecution, rapidRequests };
}

export function getRecommendedRendering(
  result: AgentDetectionResult,
  behaviorSignals?: BehaviorSignals
): 'ssr' | 'csr' | 'json' {
  if (result.type === 'Human') return 'csr';
  if (behaviorSignals?.acceptsJson) return 'json';
  if (behaviorSignals?.noJsExecution) return 'ssr';
  return 'ssr';
}

export function detectAgentEnhanced(request: NextRequest): EnhancedAgentDetectionResult {
  const baseResult = detectAgent(request);
  const behaviorSignals = detectBehaviorSignals(request);
  const recommendedRendering = getRecommendedRendering(baseResult, behaviorSignals);
  
  const enhancedSignals = [...baseResult.signals];
  if (behaviorSignals.acceptsJson) enhancedSignals.push('Behavior: Accepts JSON');
  if (behaviorSignals.noJsExecution) enhancedSignals.push('Behavior: No JS execution');
  if (behaviorSignals.rapidRequests) enhancedSignals.push('Behavior: Rapid requests detected');
  
  let confidence = baseResult.confidence;
  if (baseResult.type !== 'Human') {
    const signalCount = [
      behaviorSignals.acceptsJson,
      behaviorSignals.noJsExecution,
      behaviorSignals.rapidRequests
    ].filter(Boolean).length;
    confidence = Math.min(0.99, confidence + signalCount * 0.03);
  }
  
  return {
    type: baseResult.type,
    confidence,
    signals: enhancedSignals,
    recommendedRendering,
    behaviorSignals
  };
}

export function isAIAgent(request: NextRequest): boolean {
  return detectAgent(request).type !== 'Human';
}

export function getKnownSignatures(): AgentSignature[] {
  return [...AGENT_SIGNATURES];
}

export function detectAgentFromUserAgent(userAgent: string): AgentDetectionResult {
  const signals: string[] = [];
  
  for (const signature of AGENT_SIGNATURES) {
    for (const pattern of signature.patterns) {
      if (pattern.test(userAgent)) {
        signals.push(`User-Agent matches: ${pattern.source}`);
        return { type: signature.type, confidence: 0.9, signals };
      }
    }
  }

  return { type: 'Human', confidence: 0.8, signals: ['No bot signatures detected'] };
}

/** Export for testing */
export function _resetTimingCache(): void {
  requestTimings.clear();
}
