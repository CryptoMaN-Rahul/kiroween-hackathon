/**
 * Agent Analytics Logger
 * 
 * Logs AI agent traffic separately from human traffic for analysis.
 * Tracks agent type, path, and outcome for each AI agent visit.
 * 
 * @module analytics-logger
 */

import type { AgentType, AnalyticsRecord } from '@/types';

/**
 * In-memory analytics store (would be replaced with database in production)
 */
let analyticsStore: AnalyticsRecord[] = [];

/**
 * Generate a unique ID for analytics records
 */
function generateId(): string {
  return `analytics_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a session ID based on request characteristics
 */
function generateSessionId(agentType: AgentType): string {
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 5)); // 5-minute windows
  return `session_${agentType}_${timestamp}`;
}

/**
 * Log an analytics record for a request
 */
export function logAnalytics(
  path: string,
  agentType: AgentType,
  wasRedirected: boolean,
  conversionEvent: string | null = null
): AnalyticsRecord {
  const record: AnalyticsRecord = {
    id: generateId(),
    timestamp: new Date(),
    path,
    agentType,
    wasRedirected,
    sessionId: generateSessionId(agentType),
    conversionEvent
  };

  analyticsStore.push(record);
  return record;
}

/**
 * Log an AI agent visit specifically
 */
export function logAIAgentVisit(
  path: string,
  agentType: AgentType,
  outcome: 'redirected' | '404' | 'success'
): AnalyticsRecord {
  return logAnalytics(
    path,
    agentType,
    outcome === 'redirected',
    null
  );
}

/**
 * Get all analytics records
 */
export function getAnalyticsRecords(): AnalyticsRecord[] {
  return [...analyticsStore];
}

/**
 * Get analytics records filtered by agent type
 */
export function getRecordsByAgentType(agentType: AgentType): AnalyticsRecord[] {
  return analyticsStore.filter(r => r.agentType === agentType);
}

/**
 * Get AI agent traffic only (excludes human traffic)
 */
export function getAIAgentTraffic(): AnalyticsRecord[] {
  return analyticsStore.filter(r => r.agentType !== 'Human');
}

/**
 * Get human traffic only
 */
export function getHumanTraffic(): AnalyticsRecord[] {
  return analyticsStore.filter(r => r.agentType === 'Human');
}

/**
 * Get traffic summary by agent type
 */
export function getTrafficSummary(): Record<AgentType, number> {
  const summary: Record<AgentType, number> = {
    'ChatGPT': 0,
    'Perplexity': 0,
    'Claude': 0,
    'Gemini': 0,
    'Bing': 0,
    'Generic-Bot': 0,
    'Human': 0
  };

  for (const record of analyticsStore) {
    summary[record.agentType]++;
  }

  return summary;
}

/**
 * Get redirect statistics
 */
export function getRedirectStats(): {
  totalRedirects: number;
  redirectsByAgentType: Record<AgentType, number>;
  redirectRate: number;
} {
  const redirects = analyticsStore.filter(r => r.wasRedirected);
  const redirectsByAgentType: Record<AgentType, number> = {
    'ChatGPT': 0,
    'Perplexity': 0,
    'Claude': 0,
    'Gemini': 0,
    'Bing': 0,
    'Generic-Bot': 0,
    'Human': 0
  };

  for (const record of redirects) {
    redirectsByAgentType[record.agentType]++;
  }

  return {
    totalRedirects: redirects.length,
    redirectsByAgentType,
    redirectRate: analyticsStore.length > 0 
      ? redirects.length / analyticsStore.length 
      : 0
  };
}

/**
 * Get analytics for a specific time range
 */
export function getAnalyticsInRange(
  startDate: Date,
  endDate: Date
): AnalyticsRecord[] {
  return analyticsStore.filter(r => 
    r.timestamp >= startDate && r.timestamp <= endDate
  );
}

/**
 * Get most visited paths by AI agents
 */
export function getTopAIAgentPaths(limit: number = 10): Array<{
  path: string;
  visits: number;
  agentTypes: AgentType[];
}> {
  const aiTraffic = getAIAgentTraffic();
  const pathStats = new Map<string, { visits: number; agentTypes: Set<AgentType> }>();

  for (const record of aiTraffic) {
    const existing = pathStats.get(record.path);
    if (existing) {
      existing.visits++;
      existing.agentTypes.add(record.agentType);
    } else {
      pathStats.set(record.path, {
        visits: 1,
        agentTypes: new Set([record.agentType])
      });
    }
  }

  return Array.from(pathStats.entries())
    .map(([path, stats]) => ({
      path,
      visits: stats.visits,
      agentTypes: Array.from(stats.agentTypes)
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

/**
 * Clear all analytics records (for testing)
 */
export function clearAnalytics(): void {
  analyticsStore = [];
}

/**
 * Get total record count
 */
export function getRecordCount(): number {
  return analyticsStore.length;
}

/**
 * Validate that an analytics record has all required fields
 */
export function isValidAnalyticsRecord(record: unknown): record is AnalyticsRecord {
  if (!record || typeof record !== 'object') return false;
  
  const r = record as Record<string, unknown>;
  
  return (
    typeof r.id === 'string' &&
    r.timestamp instanceof Date &&
    typeof r.path === 'string' &&
    typeof r.agentType === 'string' &&
    typeof r.wasRedirected === 'boolean' &&
    typeof r.sessionId === 'string' &&
    (r.conversionEvent === null || typeof r.conversionEvent === 'string')
  );
}
