/**
 * Hallucination Logger
 * 
 * Logs and persists hallucinated URL attempts for analysis and alias learning.
 * 
 * @module hallucination-logger
 */

import type { HallucinationEntry, AgentType } from '@/types';

/**
 * In-memory store for hallucination entries.
 * In production, this would be backed by a database.
 */
let hallucinationStore: HallucinationEntry[] = [];

/**
 * Maximum entries to keep in memory.
 */
const MAX_ENTRIES = 10000;

/**
 * Logs a hallucination entry.
 */
export function logHallucination(entry: HallucinationEntry): void {
  hallucinationStore.push(entry);
  
  // Trim if exceeds max
  if (hallucinationStore.length > MAX_ENTRIES) {
    hallucinationStore = hallucinationStore.slice(-MAX_ENTRIES);
  }
}

/**
 * Gets all hallucination entries.
 */
export function getHallucinationLog(): HallucinationEntry[] {
  return [...hallucinationStore];
}

/**
 * Gets entries filtered by outcome.
 */
export function getEntriesByOutcome(
  outcome: 'redirected' | '404' | 'alias-used'
): HallucinationEntry[] {
  return hallucinationStore.filter(e => e.outcome === outcome);
}

/**
 * Gets entries filtered by agent type.
 */
export function getEntriesByAgentType(agentType: AgentType): HallucinationEntry[] {
  return hallucinationStore.filter(e => e.agentType === agentType);
}

/**
 * Gets entries within a time range.
 */
export function getEntriesInRange(start: Date, end: Date): HallucinationEntry[] {
  return hallucinationStore.filter(e => 
    e.timestamp >= start && e.timestamp <= end
  );
}

/**
 * Gets the most common hallucinated paths.
 */
export function getMostCommonHallucinations(limit: number = 10): Array<{
  path: string;
  count: number;
  lastSeen: Date;
}> {
  const counts = new Map<string, { count: number; lastSeen: Date }>();
  
  for (const entry of hallucinationStore) {
    const existing = counts.get(entry.hallucinatedPath);
    if (existing) {
      existing.count++;
      if (entry.timestamp > existing.lastSeen) {
        existing.lastSeen = entry.timestamp;
      }
    } else {
      counts.set(entry.hallucinatedPath, {
        count: 1,
        lastSeen: entry.timestamp
      });
    }
  }
  
  return Array.from(counts.entries())
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Gets statistics about hallucinations.
 */
export function getHallucinationStats(): {
  total: number;
  redirected: number;
  notFound: number;
  aliasUsed: number;
  byAgentType: Record<AgentType, number>;
  averageConfidence: number;
  averageLatencyMs: number;
} {
  const stats = {
    total: hallucinationStore.length,
    redirected: 0,
    notFound: 0,
    aliasUsed: 0,
    byAgentType: {} as Record<AgentType, number>,
    averageConfidence: 0,
    averageLatencyMs: 0
  };

  let totalConfidence = 0;
  let totalLatency = 0;

  for (const entry of hallucinationStore) {
    // Count by outcome
    if (entry.outcome === 'redirected') stats.redirected++;
    else if (entry.outcome === '404') stats.notFound++;
    else if (entry.outcome === 'alias-used') stats.aliasUsed++;

    // Count by agent type
    stats.byAgentType[entry.agentType] = 
      (stats.byAgentType[entry.agentType] || 0) + 1;

    totalConfidence += entry.confidence;
    totalLatency += entry.latencyMs;
  }

  if (stats.total > 0) {
    stats.averageConfidence = totalConfidence / stats.total;
    stats.averageLatencyMs = totalLatency / stats.total;
  }

  return stats;
}

/**
 * Clears all hallucination entries.
 */
export function clearHallucinationLog(): void {
  hallucinationStore = [];
}

/**
 * Creates a hallucination entry with all required fields.
 */
export function createHallucinationEntry(
  hallucinatedPath: string,
  matchedPath: string | null,
  confidence: number,
  agentType: AgentType,
  outcome: 'redirected' | '404' | 'alias-used',
  latencyMs: number
): HallucinationEntry {
  return {
    id: `hall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    hallucinatedPath,
    matchedPath,
    confidence,
    agentType,
    outcome,
    latencyMs
  };
}

/**
 * Validates that a hallucination entry has all required fields.
 */
export function validateEntry(entry: HallucinationEntry): boolean {
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    entry.timestamp instanceof Date &&
    typeof entry.hallucinatedPath === 'string' &&
    (entry.matchedPath === null || typeof entry.matchedPath === 'string') &&
    typeof entry.confidence === 'number' &&
    entry.confidence >= 0 &&
    entry.confidence <= 1 &&
    ['ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot', 'Human'].includes(entry.agentType) &&
    ['redirected', '404', 'alias-used'].includes(entry.outcome) &&
    typeof entry.latencyMs === 'number' &&
    entry.latencyMs >= 0
  );
}

/**
 * Exports the log as JSON for persistence.
 */
export function exportLogAsJson(): string {
  return JSON.stringify(hallucinationStore, (key, value) => {
    if (key === 'timestamp' && value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

/**
 * Imports a log from JSON.
 */
export function importLogFromJson(json: string): number {
  try {
    const entries = JSON.parse(json) as Array<Omit<HallucinationEntry, 'timestamp'> & { timestamp: string }>;
    let imported = 0;
    
    for (const entry of entries) {
      const parsed: HallucinationEntry = {
        ...entry,
        timestamp: new Date(entry.timestamp)
      };
      
      if (validateEntry(parsed)) {
        hallucinationStore.push(parsed);
        imported++;
      }
    }
    
    return imported;
  } catch {
    return 0;
  }
}
