/**
 * Property-Based Tests for Hallucination Logging
 * 
 * **Feature: chimera-ai-first-edge, Property 4: Hallucination Logging Completeness**
 * **Validates: Requirements 1.5**
 * 
 * Tests that hallucination logging captures all required fields.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  logHallucination,
  getHallucinationLog,
  clearHallucinationLog,
  createHallucinationEntry,
  validateEntry,
  getEntriesByOutcome,
  getEntriesByAgentType,
  getMostCommonHallucinations,
  getHallucinationStats,
  exportLogAsJson,
  importLogFromJson
} from '@/lib/hallucination-logger';
import type { AgentType, HallucinationEntry } from '@/types';

// Configuration for property tests
const FC_CONFIG = { numRuns: 100 };

// Arbitrary for agent types
const agentTypeArb = fc.constantFrom<AgentType>(
  'ChatGPT', 'Perplexity', 'Claude', 'Gemini', 'Generic-Bot', 'Human'
);

// Arbitrary for outcomes
const outcomeArb = fc.constantFrom<'redirected' | '404' | 'alias-used'>(
  'redirected', '404', 'alias-used'
);

// Arbitrary for paths
const pathArb = fc.string({ 
  minLength: 1, 
  maxLength: 50,
  unit: fc.constantFrom(...'/abcdefghijklmnopqrstuvwxyz0123456789-_'.split(''))
}).map(s => '/' + s);

// Arbitrary for confidence (0-1)
const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

// Arbitrary for latency (positive number)
const latencyArb = fc.double({ min: 0, max: 1000, noNaN: true });

// Arbitrary for complete hallucination entries
const entryArb = fc.record({
  hallucinatedPath: pathArb,
  matchedPath: fc.option(pathArb, { nil: null }),
  confidence: confidenceArb,
  agentType: agentTypeArb,
  outcome: outcomeArb,
  latencyMs: latencyArb
}).map(({ hallucinatedPath, matchedPath, confidence, agentType, outcome, latencyMs }) =>
  createHallucinationEntry(hallucinatedPath, matchedPath, confidence, agentType, outcome, latencyMs)
);

describe('Property 4: Hallucination Logging Completeness', () => {

  beforeEach(() => {
    clearHallucinationLog();
  });

  it('createHallucinationEntry produces valid entries with all required fields', () => {
    fc.assert(
      fc.property(
        pathArb,
        fc.option(pathArb, { nil: null }),
        confidenceArb,
        agentTypeArb,
        outcomeArb,
        latencyArb,
        (hallucinatedPath, matchedPath, confidence, agentType, outcome, latencyMs) => {
          const entry = createHallucinationEntry(
            hallucinatedPath,
            matchedPath,
            confidence,
            agentType,
            outcome,
            latencyMs
          );

          // All required fields must be present
          expect(entry.id).toBeDefined();
          expect(entry.id.length).toBeGreaterThan(0);
          expect(entry.timestamp).toBeInstanceOf(Date);
          expect(entry.hallucinatedPath).toBe(hallucinatedPath);
          expect(entry.matchedPath).toBe(matchedPath);
          expect(entry.confidence).toBe(confidence);
          expect(entry.agentType).toBe(agentType);
          expect(entry.outcome).toBe(outcome);
          expect(entry.latencyMs).toBe(latencyMs);
        }
      ),
      FC_CONFIG
    );
  });

  it('validateEntry returns true for valid entries', () => {
    fc.assert(
      fc.property(entryArb, (entry) => {
        expect(validateEntry(entry)).toBe(true);
      }),
      FC_CONFIG
    );
  });

  it('logged entries can be retrieved', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 20 }),
        (entries) => {
          clearHallucinationLog();
          
          for (const entry of entries) {
            logHallucination(entry);
          }

          const log = getHallucinationLog();
          expect(log.length).toBe(entries.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('entries are retrievable by outcome', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 5, maxLength: 20 }),
        outcomeArb,
        (entries, targetOutcome) => {
          clearHallucinationLog();
          
          for (const entry of entries) {
            logHallucination(entry);
          }

          const filtered = getEntriesByOutcome(targetOutcome);
          const expected = entries.filter(e => e.outcome === targetOutcome);
          
          expect(filtered.length).toBe(expected.length);
          for (const entry of filtered) {
            expect(entry.outcome).toBe(targetOutcome);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('entries are retrievable by agent type', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 5, maxLength: 20 }),
        agentTypeArb,
        (entries, targetAgent) => {
          clearHallucinationLog();
          
          for (const entry of entries) {
            logHallucination(entry);
          }

          const filtered = getEntriesByAgentType(targetAgent);
          const expected = entries.filter(e => e.agentType === targetAgent);
          
          expect(filtered.length).toBe(expected.length);
          for (const entry of filtered) {
            expect(entry.agentType).toBe(targetAgent);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('getMostCommonHallucinations returns correct counts', () => {
    // Create entries with known paths
    clearHallucinationLog();
    
    const path1 = '/common/path';
    const path2 = '/less/common';
    
    // Log path1 three times
    for (let i = 0; i < 3; i++) {
      logHallucination(createHallucinationEntry(path1, null, 0.5, 'Human', '404', 10));
    }
    
    // Log path2 once
    logHallucination(createHallucinationEntry(path2, null, 0.5, 'Human', '404', 10));
    
    const common = getMostCommonHallucinations(10);
    
    expect(common[0].path).toBe(path1);
    expect(common[0].count).toBe(3);
    expect(common[1].path).toBe(path2);
    expect(common[1].count).toBe(1);
  });

  it('getHallucinationStats returns accurate statistics', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 20 }),
        (entries) => {
          clearHallucinationLog();
          
          for (const entry of entries) {
            logHallucination(entry);
          }

          const stats = getHallucinationStats();
          
          expect(stats.total).toBe(entries.length);
          expect(stats.redirected + stats.notFound + stats.aliasUsed).toBe(entries.length);
          
          // Verify agent type counts
          let agentTotal = 0;
          for (const count of Object.values(stats.byAgentType)) {
            agentTotal += count;
          }
          expect(agentTotal).toBe(entries.length);
        }
      ),
      FC_CONFIG
    );
  });

  it('export and import preserves entries (round-trip)', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 10 }),
        (entries) => {
          clearHallucinationLog();
          
          for (const entry of entries) {
            logHallucination(entry);
          }

          const exported = exportLogAsJson();
          clearHallucinationLog();
          
          const imported = importLogFromJson(exported);
          expect(imported).toBe(entries.length);
          
          const log = getHallucinationLog();
          expect(log.length).toBe(entries.length);
          
          // Verify key fields are preserved
          for (let i = 0; i < entries.length; i++) {
            expect(log[i].hallucinatedPath).toBe(entries[i].hallucinatedPath);
            expect(log[i].outcome).toBe(entries[i].outcome);
            expect(log[i].agentType).toBe(entries[i].agentType);
          }
        }
      ),
      FC_CONFIG
    );
  });

  it('clearHallucinationLog removes all entries', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 20 }),
        (entries) => {
          for (const entry of entries) {
            logHallucination(entry);
          }
          
          clearHallucinationLog();
          
          expect(getHallucinationLog().length).toBe(0);
        }
      ),
      FC_CONFIG
    );
  });

  it('each entry has a unique ID', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 2, maxLength: 20 }),
        (entries) => {
          const ids = entries.map(e => e.id);
          const uniqueIds = new Set(ids);
          
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      FC_CONFIG
    );
  });
});
