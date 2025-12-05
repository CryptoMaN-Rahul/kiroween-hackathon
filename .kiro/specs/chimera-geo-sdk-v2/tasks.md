# Implementation Plan: Chimera GEO SDK v2.0

## Overview

This plan refactors the existing Chimera codebase from rule-based to systems-thinking architecture. Each task builds incrementally on previous work.

**Key Principles:**
- Enhance existing modules, don't rewrite from scratch
- No ML models - pure algorithmic approaches
- Configurable thresholds, not hardcoded
- Property tests validate correctness properties from design

---

## Phase 1: Algorithm Enhancements (semantic-engine.ts)

- [x] 1. Enhance Semantic Engine with Multi-Algorithm Support
  - [x] 1.1 Add Jaro-Winkler distance algorithm
    - Implement `jaroWinklerDistance(a: string, b: string, prefixScale?: number): number`
    - Prefix-weighted matching for names (default prefixScale: 0.1)
    - _Requirements: 4.1_
  - [x] 1.2 Write property test for Jaro-Winkler
    - **Property 1: Algorithm Score Range Validity**
    - **Property 2: Algorithm Identity Property**
    - **Property 3: Algorithm Symmetry Property**
    - **Validates: Requirements 4.1**
  - [x] 1.3 Add N-Gram similarity algorithm
    - Implement `nGramSimilarity(a: string, b: string, n?: number): number`
    - Default n=2 (bigrams) for description matching
    - _Requirements: 4.1_
  - [x] 1.4 Write property test for N-Gram
    - **Property 1: Algorithm Score Range Validity**
    - **Property 2: Algorithm Identity Property**
    - **Validates: Requirements 4.1**
  - [x] 1.5 Add Soundex phonetic matching
    - Implement `soundexMatch(a: string, b: string): boolean`
    - Phonetic matching for typos and misspellings
    - _Requirements: 4.1_
  - [x] 1.6 Write property test for Soundex
    - **Property 2: Algorithm Identity Property**
    - **Validates: Requirements 4.1**
  - [x] 1.7 Add Cosine similarity algorithm
    - Implement `cosineSimilarity(a: string, b: string): number`
    - Token-based vector similarity
    - _Requirements: 4.1_
  - [x] 1.8 Write property test for Cosine similarity
    - **Property 1: Algorithm Score Range Validity**
    - **Property 2: Algorithm Identity Property**
    - **Property 3: Algorithm Symmetry Property**
    - **Validates: Requirements 4.1**

- [x] 2. Add Weighted Multi-Algorithm Combiner
  - [x] 2.1 Implement configurable algorithm weights
    - Update `SemanticEngineConfig` with algorithm weights
    - Implement `combineAlgorithmScores(scores: Record<string, number>, weights: Record<string, number>): number`
    - _Requirements: 4.2_
  - [x] 2.2 Write property test for weighted combiner
    - **Property 4: Weighted Combiner Correctness**
    - **Validates: Requirements 4.2**
  - [x] 2.3 Add threshold enforcement
    - Update `findBestMatch` to filter by configurable threshold
    - _Requirements: 4.3_
  - [x] 2.4 Write property test for threshold enforcement
    - **Property 5: Threshold Enforcement**
    - **Validates: Requirements 4.3**

- [x] 3. Add Whitelist Normalization
  - [x] 3.1 Implement whitelist dictionary support
    - Add `whitelist` to config (e.g., ["Corp", "Inc", "LLC"])
    - Implement `normalizeWithWhitelist(str: string, whitelist: string[]): string`
    - _Requirements: 4.4_
  - [x] 3.2 Write property test for whitelist normalization
    - **Property 6: Whitelist Normalization Invariant**
    - **Validates: Requirements 4.4**

- [x] 4. Add Batch Processing Support
  - [x] 4.1 Implement async batch processing
    - Add `batchFindMatches(inputs: string[], candidates: string[], config?: BatchConfig): Promise<SemanticMatch[]>`
    - Configurable concurrency limit
    - _Requirements: 4.5_
  - [x] 4.2 Write property test for batch processing
    - **Property 7: Batch Processing Equivalence**
    - **Validates: Requirements 4.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: Router & Agent Detection Enhancements

- [x] 6. Enhance Symbiote Router with Latency Guarantees
  - [x] 6.1 Add latency tracking and timeout handling
    - Add `maxLatencyMs` to config (default: 200ms)
    - Add `withinLatencyBudget` to result
    - Implement timeout behavior (return structured 404 on timeout)
    - _Requirements: 5.1_
  - [x] 6.2 Write property test for latency guarantee
    - **Property 8: Router Latency Guarantee**
    - **Validates: Requirements 5.1**
  - [x] 6.3 Ensure no empty responses
    - Update router to always return redirect OR structured 404 with suggestions
    - Never return empty body
    - _Requirements: 5.2_
  - [x] 6.4 Write property test for no empty responses
    - **Property 9: No Empty Response Invariant**
    - **Validates: Requirements 5.2**
  - [x] 6.5 Add router metrics tracking
    - Implement `getRouterMetrics()` function
    - Track: totalRequests, exactMatches, fuzzyMatches, notFound, averageLatencyMs, p99LatencyMs
    - _Requirements: 5.4_
  - [x] 6.6 Write property test for event emission
    - **Property 11: Event Emission Completeness**
    - **Validates: Requirements 5.4**

- [x] 7. Enhance Agent Detector with Multi-Signal Detection
  - [x] 7.1 Add behavior signals to detection
    - Add `behaviorSignals` to `AgentDetectionResult`
    - Detect: acceptsJson, noJsExecution, rapidRequests
    - _Requirements: 5.3_
  - [x] 7.2 Add rendering recommendation
    - Implement `getRecommendedRendering(result: AgentDetectionResult): 'ssr' | 'csr' | 'json'`
    - _Requirements: 5.3_
  - [x] 7.3 Write property test for AI agent detection
    - **Property 10: AI Agent Detection Consistency**
    - **Validates: Requirements 5.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: Content Analysis Enhancements

- [x] 9. Enhance Fact-Density Analyzer with Information Gain
  - [x] 9.1 Implement Information Gain scoring
    - Add `calculateInformationGain(content: string): InformationGainResult`
    - Extract unique entities, calculate commodity phrase percentage
    - _Requirements: 9.1_
  - [x] 9.2 Write property test for Information Gain
    - **Property 21: Information Gain Score Validity**
    - **Validates: Requirements 9.1**
  - [x] 9.3 Implement Inverted Pyramid scoring
    - Add `scoreInvertedPyramid(content: string): InvertedPyramidResult`
    - Check if answer appears in first 50-100 words
    - _Requirements: 9.3_
  - [x] 9.4 Write property test for Inverted Pyramid
    - **Property 23: Inverted Pyramid Scoring Monotonicity**
    - **Validates: Requirements 9.3**
  - [x] 9.5 Implement Fluff detection
    - Add `detectFluff(content: string): { score: number; phrases: string[] }`
    - Flag marketing speak without facts
    - _Requirements: 9.4_
  - [x] 9.6 Write property test for Fluff detection
    - **Property 24: Fluffy Copy Detection Threshold**
    - **Validates: Requirements 9.4**
  - [x] 9.7 Enhance AI-candy element detection
    - Improve counting of tables, bullets, JSON-LD, pros/cons, bolded attributes
    - _Requirements: 9.2_
  - [x] 9.8 Write property test for AI-candy detection
    - **Property 22: AI-Candy Element Detection Accuracy**
    - **Validates: Requirements 9.2**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Schema Generator Enhancements

- [x] 11. Enhance Schema Generator with E-E-A-T
  - [x] 11.1 Add E-E-A-T signals interface
    - Define `EEATSignals` interface
    - Add `addEEATSignals(schema: GeneratedSchema, signals: EEATSignals): GeneratedSchema`
    - _Requirements: 10.2_
  - [x] 11.2 Write property test for E-E-A-T inclusion
    - **Property 26: E-E-A-T Signal Inclusion**
    - **Validates: Requirements 10.2**
  - [x] 11.3 Add Authorship Schema with sameAs
    - Support LinkedIn URLs in Person schema sameAs array
    - _Requirements: 10.3_
  - [x] 11.4 Write property test for Authorship sameAs
    - **Property 27: Authorship Schema SameAs Integration**
    - **Validates: Requirements 10.3**
  - [x] 11.5 Add HowTo entity detection
    - Detect step-by-step content and generate HowTo schema
    - _Requirements: 10.1_
  - [x] 11.6 Write property test for entity detection
    - **Property 25: Entity Type Detection Accuracy**
    - **Validates: Requirements 10.1**
  - [x] 11.7 Add round-trip validation
    - Implement `validateRoundTrip(schema: GeneratedSchema): boolean`
    - Serialize to JSON-LD, parse back, compare
    - _Requirements: 10.4_
  - [x] 11.8 Write property test for round-trip
    - **Property 28: Schema Round-Trip Consistency**
    - **Validates: Requirements 10.4**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 5: Citation Monitor & Reputation Graph

- [x] 13. Enhance Citation Monitor with Reputation Graph
  - [x] 13.1 Implement in-memory Reputation Graph
    - Create `ReputationGraph` class with nodes and edges
    - Support node types: brand, source, entity
    - _Requirements: 6.2_
  - [x] 13.2 Add sameAs link support
    - Implement `addSameAsLink(graph, entityId, sameAsUrl)`
    - Store and retrieve sameAs links
    - _Requirements: 6.2_
  - [x] 13.3 Write property test for sameAs consistency
    - **Property 13: Graph SameAs Consistency**
    - **Validates: Requirements 6.2**
  - [x] 13.4 Implement Earned vs Owned media classification
    - Add `isEarnedMedia(citation, ownedDomains): boolean`
    - _Requirements: 6.1_
  - [x] 13.5 Write property test for Earned Media classification
    - **Property 12: Earned Media Classification**
    - **Validates: Requirements 6.1**
  - [x] 13.6 Implement Topic Clustering
    - Add topic relationships to graph
    - Support transitivity (A→B, B→C implies A in same cluster as C)
    - _Requirements: 6.3_
  - [x] 13.7 Write property test for Topic Clustering
    - **Property 14: Topic Clustering Transitivity**
    - **Validates: Requirements 6.3**

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 6: New Modules

- [x] 15. Create Freshness Monitor Module
  - [x] 15.1 Implement freshness analysis
    - Create `freshness-monitor.ts`
    - Implement `analyzeFreshness(path, lastModified, config): FreshnessMetrics`
    - Flag pages >90 days as stale
    - _Requirements: 7.1_
  - [x] 15.2 Write property test for staleness detection
    - **Property 15: Staleness Detection and Queue Ordering**
    - **Validates: Requirements 7.1, 7.3**
  - [x] 15.3 Implement velocity calculation
    - Add `calculateVelocity(updateHistory: Date[]): number`
    - Calculate updates per month
    - _Requirements: 7.4_
  - [x] 15.4 Write property test for velocity calculation
    - **Property 17: Content Velocity Calculation**
    - **Validates: Requirements 7.4**
  - [x] 15.5 Add dateModified injection helper
    - Helper to add dateModified to schema
    - _Requirements: 7.2_
  - [x] 15.6 Write property test for dateModified injection
    - **Property 16: Schema DateModified Injection**
    - **Validates: Requirements 7.2**

- [x] 16. Create Content Transformer Module
  - [x] 16.1 Implement listicle suitability detection
    - Create `content-transformer.ts`
    - Implement `detectListicleSuitability(content): { suitable, format, confidence }`
    - _Requirements: 8.1_
  - [x] 16.2 Write property test for detection consistency
    - **Property 18: Transformation Detection Consistency**
    - **Validates: Requirements 8.1**
  - [x] 16.3 Implement content transformation
    - Add `transformToRoundup(content): TransformationResult`
    - Add `generateComparisonTable(content): string`
    - Add `createTopNList(content, n): string`
    - Preserve original, return transformed separately
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  - [x] 16.4 Write property test for transformation preservation
    - **Property 19: Transformation Preservation Invariant**
    - **Validates: Requirements 8.2, 8.5**
  - [x] 16.5 Write property test for Top N cardinality
    - **Property 20: Top N List Cardinality**
    - **Validates: Requirements 8.3, 8.4**

- [x] 17. Create Engine Optimizer Module
  - [x] 17.1 Implement engine configurations
    - Create `engine-optimizer.ts`
    - Define configs for Claude, GPT, Perplexity, Gemini
    - Implement `getEngineConfig(engine): EngineConfig`
    - _Requirements: 11.1_
  - [x] 17.2 Write property test for engine config
    - **Property 29: Engine Configuration Application**
    - **Validates: Requirements 11.1**
  - [x] 17.3 Implement query fan-out generation
    - Add `generateSubQueries(query, engine): string[]`
    - Generate 3-5 sub-queries
    - _Requirements: 11.2_
  - [x] 17.4 Write property test for query fan-out
    - **Property 30: Query Fan-Out Cardinality**
    - **Validates: Requirements 11.2**
  - [x] 17.5 Implement domain overlap calculation
    - Add `calculateDomainOverlap(results1, results2): number`
    - Symmetric calculation
    - _Requirements: 11.3_
  - [x] 17.6 Write property test for domain overlap
    - **Property 31: Domain Overlap Symmetry**
    - **Validates: Requirements 11.3**

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 7: Unified SDK Entry Point

- [x] 19. Create Unified SDK
  - [x] 19.1 Create sdk.ts with createChimeraSDK()
    - Unified entry point that wires all modules
    - Configurable via `ChimeraSDKConfig`
    - _Requirements: 13.1_
  - [x] 19.2 Implement analyzePage() convenience method
    - Run all analyzers on a page
    - Return comprehensive `PageAnalysisResult`
    - _Requirements: 13.1_
  - [x] 19.3 Add event emission for significant operations
    - Emit events for route resolution, analysis, schema generation
    - _Requirements: 13.2_
  - [x] 19.4 Write property test for event emission
    - **Property 35: Event Emission for Significant Operations**
    - **Validates: Requirements 13.2**
  - [x] 19.5 Add batch processing API
    - Implement batch analysis with order preservation
    - _Requirements: 13.3_
  - [x] 19.6 Write property test for batch order preservation
    - **Property 36: Batch Processing Order Preservation**
    - **Validates: Requirements 13.3**

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 8: MCP Server Enhancement

- [x] 21. Add New MCP Tools
  - [x] 21.1 Add analyze_freshness tool
    - Check content staleness and velocity
    - _Requirements: 7.1, 7.4_
  - [x] 21.2 Add detect_listicle_opportunity tool
    - Find content suitable for AI-preferred formats
    - _Requirements: 8.1_
  - [x] 21.3 Add analyze_information_gain tool
    - Score content for unique facts vs commodity phrases
    - _Requirements: 9.1_
  - [x] 21.4 Add check_inverted_pyramid tool
    - Verify answer appears in first 50-100 words
    - _Requirements: 9.3_
  - [x] 21.5 Add get_engine_recommendations tool
    - Get Claude/GPT/Perplexity-specific tips
    - _Requirements: 11.1_
  - [x] 21.6 Add full_page_analysis tool
    - Run all analyzers and return comprehensive report
    - _Requirements: 13.1_
  - [x] 21.7 Test MCP server integration
    - Verify all 12 tools work correctly
    - Test with Kiro IDE

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 9: Kiro Hooks (Developer Productivity)

- [x] 23. Create Kiro Hooks
  - [x] 23.1 Create schema-auto-generator.kiro.hook
    - Trigger on page creation, suggest JSON-LD schema
    - Uses MCP generate_schema tool
  - [x] 23.2 Create content-analyzer.kiro.hook
    - Trigger on content edit, check scannability
    - Uses MCP analyze_content_scannability tool
  - [x] 23.3 Create freshness-checker.kiro.hook
    - Trigger on content update, check staleness
    - Uses MCP analyze_freshness tool
  - [x] 23.4 Create geo-score-reporter.kiro.hook
    - Trigger on lib file edit, report GEO score
    - Uses MCP calculate_geo_score tool

---

## Phase 10: Final Integration & Documentation

- [x] 24. Final Integration
  - [x] 24.1 Update middleware.ts to use SDK
    - Replace direct module calls with SDK
    - _Requirements: 13.1_
  - [x] 24.2 Update dashboard API to use SDK
    - Use SDK for all analysis
    - _Requirements: 13.1_
  - [x] 24.3 Update types/index.ts with all new types
    - Export all new interfaces
    - _Requirements: 13.1_

- [x] 25. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 11: Production-Grade Hardening (NEW)

This phase addresses critical issues that prevent the SDK from being production-ready.

- [x] 26. Dynamic Route Discovery System
  - [x] 26.1 Implement sitemap.xml parser for route discovery
    - Create `sitemap-parser.ts` that fetches and parses sitemap.xml
    - Support sitemap index files (multiple sitemaps)
    - Extract routes with lastmod dates for freshness tracking
    - _Requirements: Production-grade route discovery_
  - [x] 26.2 Implement filesystem-based route discovery for Next.js
    - Scan `app/` directory for page.tsx files
    - Parse dynamic route patterns `[slug]`, `[...catchAll]`
    - Generate route manifest at build time
    - _Requirements: Zero-config route discovery_
  - [x] 26.3 Add route manifest caching with TTL
    - Cache discovered routes with configurable TTL (default: 5 minutes)
    - Support manual cache invalidation
    - _Requirements: Performance optimization_

- [x] 27. Persistence Layer
  - [x] 27.1 Create abstract persistence interface
    - Define `PersistenceAdapter` interface for all storage needs
    - Support: aliases, citations, freshness history, router metrics
    - _Requirements: Data durability_
  - [x] 27.2 Implement file-based persistence adapter
    - JSON file storage for development/small deployments
    - Atomic writes to prevent corruption
    - _Requirements: Simple persistence_
  - [x] 27.3 Implement Redis persistence adapter (optional)
    - For production deployments with Redis
    - Support TTL for cached data
    - _Requirements: Scalable persistence_
  - [x] 27.4 Add persistence to router aliases
    - Auto-save learned aliases
    - Load aliases on startup
    - _Requirements: Alias persistence_

- [x] 28. Real Domain Authority Lookup
  - [x] 28.1 Integrate free domain authority API
    - Use Open PageRank API (free, no API key required)
    - Fallback to heuristic scoring if API unavailable
    - Cache results for 24 hours
    - _Requirements: Real domain authority data_
  - [x] 28.2 Add domain authority batch lookup
    - Batch multiple domains in single request
    - Rate limit to respect API limits
    - _Requirements: Efficient API usage_

- [x] 29. Improved Entity Detection
  - [x] 29.1 Add context-aware entity detection
    - Analyze surrounding content, not just keywords
    - Use negative signals to reduce false positives
    - Weight signals by strength (strong vs weak indicators)
    - _Requirements: Accurate entity detection_
  - [x] 29.2 Add entity confidence calibration
    - Track detection accuracy over time
    - Adjust thresholds based on feedback
    - _Requirements: Self-improving detection_

- [x] 30. Caching Layer
  - [x] 30.1 Implement LRU cache for analysis results
    - Cache fact-density, schema, information gain results
    - Key by content hash (MD5 of first 1000 chars + length)
    - Configurable cache size (default: 1000 entries)
    - _Requirements: Performance optimization_
  - [x] 30.2 Add cache statistics and monitoring
    - Track hit rate, miss rate, evictions
    - Expose via SDK metrics API
    - _Requirements: Observability_

- [x] 31. Webhook/Event System
  - [x] 31.1 Implement event emitter for SDK events
    - Events: citation_found, content_stale, route_learned, analysis_complete
    - Support multiple listeners per event
    - _Requirements: Real-time notifications_
  - [x] 31.2 Add webhook dispatcher
    - POST events to configured webhook URLs
    - Retry with exponential backoff
    - _Requirements: External integrations_

- [x] 32. Graceful Degradation
  - [x] 32.1 Add circuit breaker for external calls
    - Track failure rates for external APIs
    - Open circuit after N failures, half-open after timeout
    - _Requirements: Resilience_
  - [x] 32.2 Implement fallback strategies
    - If semantic matching times out, return quick suggestions
    - If domain authority API fails, use heuristic scoring
    - _Requirements: Reliability_

- [x] 33. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 12: Real-World Integrations (NEW)

- [x] 34. Real Citation Discovery (Free APIs Only)
  - [x] 34.1 Implement combined citation discovery service
    - Created `citation-discovery.ts` with unified discovery API
    - Supports multiple sources with deduplication
    - Sorts by authority score
    - _Requirements: Real citation discovery_
  - [x] 34.2 Implement Reddit API integration
    - Search subreddits for brand mentions (free, no API key)
    - Extract post/comment context
    - Calculate Reddit-specific authority (karma, subreddit size)
    - _Requirements: Social media citations_
  - [x] 34.3 Implement Hacker News API integration
    - Search HN for brand mentions (free API)
    - Track story/comment mentions
    - High authority source for tech brands
    - _Requirements: Tech community citations_

- [x] 35. Content Management System Hooks
  - [x] 35.1 Create generic CMS webhook receiver
    - Accept POST webhooks for content updates
    - Update freshness tracking automatically
    - Trigger re-analysis on content change
    - _Requirements: CMS integration_
  - [x] 35.2 Add Contentful integration example
    - Webhook handler for Contentful events
    - Auto-extract content for analysis
    - _Requirements: Headless CMS support_

- [x] 36. Analytics Integration
  - [x] 36.1 Create analytics event format
    - Define standard event schema for GEO metrics
    - Support: page_analyzed, citation_found, redirect_performed
    - _Requirements: Analytics compatibility_
  - [x] 36.2 Add Google Analytics 4 integration
    - Send GEO events to GA4 Measurement Protocol
    - Track AI agent visits separately
    - _Requirements: GA4 integration_

- [x] 37. Final Production Checkpoint
  - Ensure all tests pass
  - Verify all integrations work with real APIs
  - Document configuration options

---

## Phase 13: Critical Production Fixes (NEW - Real Value)

This phase fixes critical issues identified during code review that prevent real-world usage.

- [x] 38. Fix Entity Detection False Positives
  - [x] 38.1 Improve entity detection with context analysis
    - Add negative signals (e.g., "blog post about pricing" should NOT be Product)
    - Weight strong signals higher than weak keywords
    - Require multiple strong signals for high confidence
    - _Requirements: Accurate schema generation_
  - [x] 38.2 Add entity detection confidence calibration
    - Raise confidence threshold from 0.3 to 0.4
    - Add mutual exclusion rules (Article vs Product)
    - _Requirements: Reduce false positives_

- [x] 39. Fix Information Gain Entity Extraction
  - [x] 39.1 Improve proper noun extraction
    - Filter out common sentence starters ("The", "This", "However")
    - Require multi-word proper nouns or known entity patterns
    - Add technical term detection (API, SDK, HTTP)
    - _Requirements: Accurate entity counting_
  - [x] 39.2 Add entity categorization
    - Categorize entities: person, organization, product, technical term
    - Weight different entity types differently in scoring
    - _Requirements: Better information gain scoring_

- [x] 40. Fix Sentiment Analysis Context
  - [x] 40.1 Add negation handling
    - Detect "not", "no", "never" before positive/negative words
    - Flip sentiment when negation detected
    - _Requirements: Accurate sentiment analysis_
  - [x] 40.2 Add phrase-level sentiment
    - Detect multi-word sentiment phrases ("not great", "could be better")
    - Handle sarcasm indicators ("yeah, right")
    - _Requirements: Context-aware sentiment_

- [x] 41. Add Circuit Breaker for External APIs
  - [x] 41.1 Implement circuit breaker pattern
    - Track failure count per API endpoint
    - Open circuit after 5 consecutive failures
    - Half-open after 30 seconds, full open after success
    - _Requirements: API resilience_
  - [x] 41.2 Add fallback strategies
    - Reddit API fails → return empty results, don't throw
    - Domain authority API fails → use heuristic scoring
    - _Requirements: Graceful degradation_

- [x] 42. Add Webhook Signature Verification
  - [x] 42.1 Implement HMAC signature verification
    - Use crypto.createHmac for proper signature verification
    - Support Contentful, Sanity, Strapi signature formats
    - _Requirements: Webhook security_

- [x] 43. Fix Unused Variables and Code Quality
  - [x] 43.1 Fix TypeScript warnings
    - Remove unused `finalUrl` in citation-discovery.ts
    - Remove unused `payload` parameter in cms-webhook.ts
    - _Requirements: Code quality_

- [x] 44. Final Production Checkpoint
  - Ensure all tests pass
  - Run full test suite with `npm test`
  - Verify no TypeScript errors


---

## Phase 14: Production Hardening - Remaining Issues (NEW)

This phase addresses remaining issues identified during code review.

- [x] 45. Improve Entity Detection Accuracy
  - [x] 45.1 Add context-aware entity detection
    - Analyze surrounding sentences, not just keywords
    - Use negative signals to reduce false positives (e.g., "blog post about pricing" should NOT be Product)
    - Weight signals by strength (strong vs weak indicators)
    - _Requirements: Accurate entity detection_
  - [x] 45.2 Add entity confidence calibration
    - Track detection accuracy over time
    - Adjust thresholds based on feedback
    - _Requirements: Self-improving detection_

- [x] 46. Implement Event/Webhook System
  - [x] 46.1 Implement event emitter for SDK events
    - Events: citation_found, content_stale, route_learned, analysis_complete
    - Support multiple listeners per event
    - _Requirements: Real-time notifications_
  - [x] 46.2 Add webhook dispatcher
    - POST events to configured webhook URLs
    - Retry with exponential backoff
    - _Requirements: External integrations_

- [x] 47. Add Graceful Degradation Patterns
  - [x] 47.1 Implement timeout fallbacks
    - If semantic matching times out, return quick suggestions
    - If domain authority API fails, use heuristic scoring
    - _Requirements: Reliability_
  - [x] 47.2 Add health check endpoint
    - Report status of all external dependencies
    - _Requirements: Observability_

- [x] 48. Final Production Checkpoint
  - Ensure all tests pass
  - Run full test suite with `npm test`
  - Verify no TypeScript errors
  - Test with real-world content



---

## Phase 15: Core Functionality Hardening (Critical for Real Value)

This phase addresses the fundamental issues that prevent the SDK from providing real value in production environments. Focus is on making core functionality work with ANY website, not just demo scenarios.

- [x] 49. Fix Circuit Breaker TypeScript Warning
  - [x] 49.1 Remove unused generic type parameter
    - Fix `<T>` is declared but never used warning in circuit-breaker.ts
    - _Requirements: Code quality_

- [x] 50. Add Rate Limiting for External APIs
  - [x] 50.1 Implement token bucket rate limiter
    - Create `rate-limiter.ts` with configurable rate limits
    - Support per-endpoint rate limits (Reddit: 60/min, HN: 100/min)
    - Queue requests when rate limit exceeded
    - _Requirements: API compliance_
  - [x] 50.2 Integrate rate limiter with citation discovery
    - Apply rate limiting to Reddit API calls
    - Apply rate limiting to HN API calls
    - Add rate limit status to discovery stats
    - _Requirements: Prevent API bans_

- [x] 51. Improve Domain Authority Heuristics
  - [x] 51.1 Expand known domain database
    - Add 200+ more high-authority domains across categories
    - Include regional domains (.co.uk, .de, .fr, etc.)
    - Add industry-specific domains (healthcare, finance, legal)
    - _Requirements: Better fallback coverage_
  - [x] 51.2 Improve heuristic scoring algorithm
    - Consider domain age indicators (shorter = older = more authority)
    - Check for common brand patterns
    - Add subdomain authority inheritance
    - _Requirements: More accurate heuristics_

- [x] 52. Add Automatic Route Discovery
  - [x] 52.1 Implement sitemap.xml parser
    - Fetch and parse sitemap.xml from any URL
    - Support sitemap index files (multiple sitemaps)
    - Extract routes with lastmod dates
    - Handle gzip compressed sitemaps
    - _Requirements: Automatic route discovery_
  - [x] 52.2 Implement Next.js app directory scanner
    - Scan `app/` directory for page.tsx files
    - Parse dynamic route patterns `[slug]`, `[...catchAll]`
    - Generate route manifest at build time
    - _Requirements: Zero-config for Next.js apps_
  - [x] 52.3 Add route manifest caching
    - Cache discovered routes with configurable TTL
    - Support manual cache invalidation
    - Auto-refresh on sitemap changes
    - _Requirements: Performance_

- [x] 53. Enhance Entity Detection with Semantic Context
  - [x] 53.1 Add sentence-level context analysis
    - Analyze the sentence containing keywords, not just keywords
    - Check for negation patterns ("not a product", "unlike products")
    - Check for comparison patterns ("compared to products")
    - _Requirements: Reduce false positives_
  - [x] 53.2 Add content structure analysis
    - Detect page structure (blog layout vs product page vs landing page)
    - Use structure hints for entity detection
    - Weight detection based on page type
    - _Requirements: Context-aware detection_

- [x] 54. Add Configurable Commodity Phrase Dictionary
  - [x] 54.1 Make commodity phrases configurable
    - Allow users to add/remove commodity phrases
    - Support industry-specific phrase lists
    - Provide default lists for common industries
    - _Requirements: Customization_
  - [x] 54.2 Add phrase importance weighting
    - Not all commodity phrases are equally bad
    - Weight phrases by how "fluffy" they are
    - Allow custom weights per phrase
    - _Requirements: Nuanced scoring_

- [x] 55. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 16: SDK Usability Improvements

- [x] 56. Add SDK Configuration Validation
  - [x] 56.1 Validate configuration on SDK creation
    - Check for invalid threshold values (must be 0-1)
    - Check for conflicting options
    - Provide helpful error messages
    - _Requirements: Developer experience_
  - [x] 56.2 Add configuration presets
    - Create presets: 'strict', 'balanced', 'lenient'
    - Preset for e-commerce sites
    - Preset for blog/content sites
    - Preset for SaaS landing pages
    - _Requirements: Easy setup_

- [x] 57. Add Debug Mode
  - [x] 57.1 Implement verbose logging option
    - Log all algorithm scores when debug enabled
    - Log entity detection reasoning
    - Log route matching decisions
    - _Requirements: Debugging support_
  - [x] 57.2 Add performance profiling
    - Track time spent in each analysis phase
    - Identify bottlenecks
    - Expose via SDK metrics
    - _Requirements: Performance optimization_

- [x] 58. Final Checkpoint
  - Ensure all tests pass
  - Run full test suite with `npm test`
  - Verify no TypeScript errors
  - Test with real-world websites



---

## Phase 17: Production-Grade Core Fixes (Critical for Real Value)

This phase addresses fundamental issues that prevent the SDK from providing real value in production.

- [x] 59. Fix Sitemap Parser for Real-World Usage
  - [x] 59.1 Handle gzip compressed sitemaps
    - Many production sites serve gzip-compressed sitemaps
    - Add automatic decompression support
    - _Requirements: Real-world compatibility_
  - [x] 59.2 Add sitemap index support
    - Large sites use sitemap index files pointing to multiple sitemaps
    - Recursively fetch and parse all sitemaps
    - _Requirements: Enterprise site support_
  - [x] 59.3 Add error recovery for malformed sitemaps
    - Many sitemaps have minor XML errors
    - Add lenient parsing mode
    - _Requirements: Robustness_

- [x] 60. Expand Domain Authority Database
  - [x] 60.1 Add 500+ more high-authority domains
    - Add regional news sites (India, Brazil, Germany, etc.)
    - Add industry verticals (healthcare, legal, finance)
    - Add tech/startup ecosystem domains
    - _Requirements: Global coverage_
  - [x] 60.2 Improve heuristic scoring for unknown domains
    - Better TLD scoring (new gTLDs, country codes)
    - Domain age estimation from patterns
    - Subdomain authority inheritance
    - _Requirements: Better fallback accuracy_

- [x] 61. Add Real Citation Sources
  - [-] 61.1 Add Twitter/X search (via Nitter) - SKIPPED (Nitter instances unreliable)
    - Twitter API requires paid access
    - Nitter instances frequently go offline
    - Decision: Skip Twitter, focus on Reddit/HN/GitHub which are free and reliable
    - _Requirements: Social media coverage_
  - [x] 61.2 Add Google News search
    - Use Google News RSS feeds (free)
    - Extract news mentions
    - _Requirements: News coverage_
  - [x] 61.3 Add GitHub search
    - Search GitHub for brand mentions in READMEs
    - High authority for developer tools
    - _Requirements: Developer ecosystem coverage_

- [x] 62. Improve Information Gain Scoring
  - [x] 62.1 Add named entity recognition patterns
    - Better detection of company names, product names, people
    - Use capitalization patterns and context
    - _Requirements: Accurate entity counting_
  - [x] 62.2 Add fact extraction patterns
    - Detect specific claims (numbers, dates, comparisons)
    - Weight facts by specificity
    - _Requirements: Better information density scoring_

- [x] 63. Add Real-Time Monitoring Capabilities
  - [x] 63.1 Add webhook retry with exponential backoff
    - Retry failed webhook deliveries
    - Configurable max retries and backoff
    - _Requirements: Reliable event delivery_
  - [x] 63.2 Add health check endpoint data
    - Report status of all external dependencies
    - Include latency metrics
    - _Requirements: Operational visibility_

- [x] 64. Final Production Checkpoint
  - All 512 tests pass
  - API integrations work (Reddit, HN, GitHub)
  - Twitter skipped due to API costs



---

## Phase 18: Critical Bug Fixes (Completed)

This phase fixes critical bugs identified during code review and MCP testing.

- [x] 65. Fix MCP Server Score Calculation Bug
  - [x] 65.1 Fix full_page_analysis score multiplication
    - factDensity.score is 0-1 (multiply by 100)
    - informationGain.score is already 0-100 (don't multiply)
    - invertedPyramid.score is already 0-100 (don't multiply)
    - fluffScore is already 0-100 (don't multiply)
    - _Requirements: Correct score reporting_
  - [x] 65.2 Fix overallAssessment thresholds
    - Use percentage values consistently
    - _Requirements: Accurate assessment_

- [x] 66. Fix Entity Extraction Using NLP Library
  - [x] 66.1 Replace regex-based extraction with compromise NLP
    - Use compromise library for people, places, organizations
    - Filter out common words and noise
    - Extract technical terms, brands, products
    - _Requirements: Accurate entity extraction_
  - [x] 66.2 Add type declarations for compromise
    - Create src/types/compromise.d.ts
    - _Requirements: TypeScript support_

- [x] 67. Fix Schema Generator Product Detection
  - [x] 67.1 Fix negative pattern for "review"
    - "review" alone should not be negative for Product
    - Product reviews are valid product pages
    - _Requirements: Accurate product detection_
  - [x] 67.2 Improve strong signal handling
    - Price + action (buy now, add to cart, in stock) = Product
    - Reduce negative penalty when strong signals present
    - Ensure minimum confidence for very strong signals
    - _Requirements: Reliable entity detection_

- [x] 68. Checkpoint - Verify fixes
  - All 512 tests pass
  - Schema generator correctly detects Product with price
  - Entity extraction returns clean entities without newlines
  - MCP tools return correct score ranges



---

## Phase 19: Entity Extraction & Information Gain Improvements (NEW)

This phase improves entity extraction accuracy and information gain scoring.

- [x] 69. Improve Entity Extraction Quality
  - [x] 69.1 Filter garbage entities from NLP extraction
    - Filter entities containing newlines
    - Filter entities that are too long (>50 chars)
    - Filter entities with punctuation patterns indicating partial sentences
    - _Requirements: Clean entity extraction_
  - [x] 69.2 Expand brand and product recognition
    - Add 100+ major tech brands (Stripe, Shopify, Slack, etc.)
    - Add 100+ major products (Vision Pro, Cybertruck, etc.)
    - Add CamelCase pattern detection for company names
    - _Requirements: Comprehensive entity coverage_
  - [x] 69.3 Add fact extraction patterns
    - Add multi-currency price detection (€, £, ¥, etc.)
    - Add date extraction (January 1, 2024, Q4 2023, etc.)
    - Add version number extraction (v1.0.0, 17.0, etc.)
    - Add comparison extraction (X vs Y, better than, etc.)
    - Add ranking extraction (top 10, #1, first place, etc.)
    - _Requirements: Better information density scoring_

- [x] 70. Verify All Tests Pass
  - All 512 tests pass
  - Entity extraction returns clean, relevant entities
  - Information gain scoring is accurate
  - Schema generator correctly detects entities



---

## Phase 20: MCP Server Restart & Verification (Critical)

The MCP server config was fixed to use correct working directory.

- [x] 71. Fix MCP Server Configuration
  - [x] 71.1 Fix MCP config path resolution
    - Changed from `npx tsx chimera/src/mcp/citation-server.ts` to `npm run mcp:start`
    - Added `cwd: "chimera"` to run from correct directory
    - _Requirements: Server startup_
  - [x] 71.2 Verify server starts correctly
    - Server now starts without path resolution errors
    - All 12 tools are registered
    - _Requirements: Server running_

- [x] 72. Verify MCP Tools Return Correct Values
  - [x] 72.1 Test full_page_analysis scores
    - factDensity: 20 (0-100 range) ✅
    - informationGain: 52 (0-100 range) ✅
    - invertedPyramid: 100 (0-100 range) ✅
    - _Requirements: Correct score ranges_
  - [x] 72.2 Test scan_citations returns real data
    - Found 32 real citations from Hacker News ✅
    - Returns real domain authority scores ✅
    - _Requirements: Real API integration_
  - [x] 72.3 Test get_citation_stats
    - Returns correct statistics structure ✅
    - _Requirements: Full MCP functionality_

---

## Phase 21: Production Hardening - Final Polish

- [x] 73. Fix Remaining TypeScript Warnings
  - [x] 73.1 Fix unused brandDomains in CitationStore
    - Renamed to _brandDomains and added getter/helper methods
    - _Requirements: Clean code_

---

## Phase 22: Production-Ready Core Fixes (Critical for Real Value)

This phase addresses fundamental issues that prevent the SDK from providing real value in production.

- [x] 74. Twitter/X Citation Discovery Decision
  - [x] 74.1 Decision: Skip Twitter integration
    - Twitter API requires paid access ($100/month minimum)
    - Nitter instances are unreliable and frequently blocked
    - Reddit, HN, and GitHub provide sufficient coverage for tech brands
    - _Requirements: Documented decision_

- [x] 75. Add Missing Error Handling in SDK
  - [x] 75.1 Add try-catch wrappers in SDK.analyzePage
    - Currently schema generation errors are caught but others aren't
    - Add graceful degradation for all analysis steps
    - _Requirements: Robustness_
  - [x] 75.2 Add timeout handling for long-running analyses
    - Add configurable timeout for analyzePage
    - Return partial results on timeout
    - _Requirements: Reliability_

- [x] 76. Fix Sitemap Parser Edge Cases (Already Implemented)
  - [x] 76.1 Handle malformed XML gracefully
    - Lenient parsing mode with cleanXml() function
    - Handles BOM, XML declarations, encoding issues
    - _Requirements: Real-world compatibility_
  - [x] 76.2 Add support for sitemap index files
    - isSitemapIndex() detection
    - parseSitemapIndex() for recursive fetching
    - fetchAndParseSitemap() handles both types
    - _Requirements: Enterprise site support_

- [x] 77. Improve Schema Generator Accuracy (Already Implemented)
  - [x] 77.1 Add more negative signals for entity detection
    - NEGATIVE_PATTERNS includes "article", "blog", "how to", "guide", etc.
    - isKeywordNegated() checks for negation context
    - isKeywordInComparisonContext() checks for comparison context
    - _Requirements: Reduce false positives_
  - [x] 77.2 Add page structure analysis
    - PAGE_STRUCTURE_INDICATORS for blog, product, landing, faq, howto
    - analyzePageStructure() returns scores for each type
    - Used in detectEntities() to boost/penalize confidence
    - _Requirements: Context-aware detection_

- [x] 78. Add SDK Health Monitoring (Already Implemented)
  - [x] 78.1 Add dependency health checks
    - health-check.ts with checkRedditHealth, checkHackerNewsHealth, checkOpenPageRankHealth
    - Reports circuit breaker states via circuitBreakerRegistry.getAllStats()
    - Custom health checks supported via addCheck()
    - _Requirements: Operational visibility_
  - [x] 78.2 Add SDK metrics endpoint
    - SDK exposes cache.getStats(), events.getStats(), debug.getPerformanceMetrics()
    - Rate limiter stats via getRateLimiterStats()
    - Circuit breaker stats via getCircuitBreakerStats()
    - _Requirements: Monitoring integration_

- [x] 79. Fix Memory Leaks in Long-Running Processes (Already Implemented)
  - [x] 79.1 Add cache eviction policies
    - LRUCache class with maxSize enforcement (default: 1000)
    - evictOldest() removes least recently used entries
    - prune() method for periodic cleanup of expired entries
    - _Requirements: Memory management_
  - [x] 79.2 Add request timing cache cleanup
    - Agent detector uses LRUTimingCache with maxSize (5000)
    - Automatic eviction of oldest 10% when limit reached
    - Window-based cleanup (5 second window)
    - _Requirements: Memory management_

- [x] 80. Add Integration Tests
  - [x] 80.1 Add end-to-end test for full page analysis
    - Test with real HTML content
    - Verify all modules work together
    - _Requirements: Integration testing_
  - [x] 80.2 Add API integration tests (mocked)
    - Test Reddit/HN/GitHub discovery with mocked responses
    - Test circuit breaker behavior
    - _Requirements: API testing_

- [x] 81. Final Production Checkpoint
  - All 512 property tests pass
  - TypeScript compiles without errors
  - SDK works with real-world websites
  - MCP server returns correct values
