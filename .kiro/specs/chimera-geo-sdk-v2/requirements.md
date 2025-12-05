# Requirements Document: Chimera GEO SDK v2.0

## Introduction

This specification defines the comprehensive overhaul of the Chimera GEO SDK from a rule-based implementation to a systems-thinking, adaptive architecture. The SDK serves as the foundational library for Generative Engine Optimization (GEO), AI Search Optimization (AIO), and Large Language Model Optimization (LLMO).

**⚠️ CRITICAL: Analysis-First Approach**

This spec follows a strict **analysis-before-implementation** methodology:
1. **Phase 1**: Deep codebase audit and understanding (NO code changes)
2. **Phase 2**: Design and architecture decisions based on audit findings
3. **Phase 3**: Implementation only after full understanding

**DO NOT generate implementation code until Phase 1 audit is complete and reviewed.**

## Glossary

- **GEO**: Generative Engine Optimization for AI search engines
- **LLMO**: Large Language Model Optimization
- **AI Bounce**: When AI agents abandon a site due to errors
- **E-E-A-T**: Experience, Expertise, Authoritativeness, Trustworthiness
- **RAG**: Retrieval-Augmented Generation
- **Query Fan-Out**: AI engines issuing 3-5 sub-queries per question
- **Earned Media**: Third-party mentions (92.1% AI bias per Chen et al., 2025)
- **Information Gain**: Unique facts per paragraph (ranking factor)
- **Fuzzy Matching**: Probabilistic string comparison (Levenshtein, Jaro-Winkler)

---

## PHASE 1: CODEBASE ANALYSIS (NO CODE CHANGES)

### Requirement 1: Deep Codebase Audit

**User Story:** As a SDK maintainer, I want a comprehensive analysis of the current codebase before any changes, so that I understand all dependencies, patterns, and risks.

#### Acceptance Criteria

1. WHEN auditing begins THEN the Audit SHALL produce a file-by-file analysis of `/src/lib/`, `/src/app/`, `/src/middleware.ts`
2. THE Audit SHALL categorize each finding in a structured table:

| File | Issue | Severity | Current Implementation | Recommended Migration | Impact Estimate |
|------|-------|----------|----------------------|----------------------|-----------------|

3. THE Audit SHALL identify all hardcoded rules: regex patterns, if-else chains, static thresholds, string equality comparisons
4. THE Audit SHALL map all module dependencies and data flows between components
5. THE Audit SHALL document current test coverage and identify untested paths
6. THE Audit SHALL NOT recommend any code changes until findings are reviewed and approved

### Requirement 2: Current Fuzzy System Analysis

**User Story:** As a developer, I want to understand the current fuzzy matching implementation gaps, so that I can plan targeted improvements.

#### Acceptance Criteria

1. THE Analysis SHALL document current algorithms used in `semantic-engine.ts` (Levenshtein, Jaccard)
2. THE Analysis SHALL identify missing algorithms: Jaro-Winkler, N-Gram, Soundex, Cosine Similarity
3. THE Analysis SHALL benchmark current matching accuracy on test datasets
4. THE Analysis SHALL identify where simple string equality is used instead of fuzzy matching
5. THE Analysis SHALL document current threshold values and their origins (hardcoded vs configurable)

### Requirement 3: AI Agent Handling Analysis

**User Story:** As a developer, I want to understand current AI agent detection and handling, so that I can identify zero-tolerance policy gaps.

#### Acceptance Criteria

1. THE Analysis SHALL document current User-Agent detection in `agent-detector.ts`
2. THE Analysis SHALL identify any client-side fallbacks that could expose blank pages
3. THE Analysis SHALL measure current 404 resolution latency against 200ms target
4. THE Analysis SHALL document current SSR/SSG vs CSR rendering paths for AI crawlers
5. THE Analysis SHALL identify gaps in Hydration Guard implementation

---

## PHASE 2: REQUIREMENTS FOR IMPLEMENTATION (After Audit Approval)

### Requirement 4: Enhanced Fuzzy Matching System

**User Story:** As a developer, I want multi-algorithm fuzzy matching with ML feedback loops.

#### Acceptance Criteria

1. WHEN comparing strings THEN the Fuzzy Engine SHALL support: Levenshtein, Jaro-Winkler, N-Gram, Soundex, Cosine Similarity
2. THE Engine SHALL use weighted multi-field matching (e.g., 70% primary + 30% secondary)
3. THE Engine SHALL support dynamic thresholds: 90-95% for precision, 80-85% for recall
4. THE Engine SHALL support whitelisting dictionaries (ignore "Corp", "Inc" variants)
5. THE Engine SHALL process 1M+ records via batch processing with worker threads

### Requirement 5: AI Agent Navigation (Zero-Tolerance)

**User Story:** As a website owner, I want AI agents to never encounter errors.

#### Acceptance Criteria

1. WHEN an AI agent requests non-existent URL THEN Router SHALL resolve within 200ms
2. THE Router SHALL return semantic redirect with confidence, never blank pages
3. WHEN detecting AI crawler THEN Hydration Guard SHALL serve pre-rendered HTML
4. THE Router SHALL log all AI interactions for pattern analysis

### Requirement 6: Citation Economy & Authority Building

**User Story:** As a content strategist, I want to build earned media authority.

#### Acceptance Criteria

1. THE Citation Monitor SHALL distinguish earned media (92.1% AI bias) from owned content
2. THE Monitor SHALL build Reputation Graph with "sameAs" Schema.org properties
3. THE Knowledge Graph SHALL implement Topic Clustering (Product → Warranty → FAQ)
4. THE Monitor SHALL auto-suggest PR outreach for Reddit, Wikipedia endorsements

### Requirement 7: Content Freshness & Recency Signals

**User Story:** As a content manager, I want automatic staleness detection, so that AI engines see my content as current and authoritative.

#### Acceptance Criteria

1. THE Freshness Monitor SHALL auto-flag pages >3 months since last update
2. THE Monitor SHALL inject "Last Updated" timestamps into Schema.org dateModified
3. WHEN content is stale THEN the Monitor SHALL prioritize in refresh queue
4. THE Monitor SHALL track content velocity (updates/month) as ranking signal
5. THE Monitor SHALL integrate with CMS webhooks for real-time staleness detection

### Requirement 8: Listicle & AI-Preferred Content Transformer

**User Story:** As a content creator, I want automatic content transformation into AI-preferred formats (roundups, comparisons, "best of" lists).

#### Acceptance Criteria

1. THE Listicle Suggester SHALL detect content suitable for roundup transformation
2. THE Suggester SHALL auto-format content as AI-preferred structures (Perplexity bias for listicles)
3. THE Suggester SHALL generate comparison tables from prose descriptions
4. THE Suggester SHALL create "Top N" and "Best X for Y" structures from feature lists
5. THE Suggester SHALL preserve original content while offering transformed alternatives

### Requirement 9: Information Gain Scoring

**User Story:** As a content creator, I want content scored on information density.

#### Acceptance Criteria

1. THE Fact-Density Analyzer SHALL score "Information Gain" using entity extraction
2. THE Analyzer SHALL enforce AI-candy: tables, bullets, JSON-LD, pros/cons, bolded attributes
3. THE Analyzer SHALL enforce Inverted Pyramid: answers in first 50-100 words
4. THE Analyzer SHALL detect and flag "fluffy copy" (marketing speak without facts)

### Requirement 10: Schema & E-E-A-T Intelligence

**User Story:** As a developer, I want auto-generated JSON-LD with E-E-A-T signals.

#### Acceptance Criteria

1. THE Schema Generator SHALL auto-detect: Product, Article, Organization, Person, FAQ, HowTo
2. THE Generator SHALL include E-E-A-T: author credentials, datePublished, dateModified
3. THE Generator SHALL support Authorship Schema for employee profiles with LinkedIn signals
4. WHEN schema serialized then parsed THEN it SHALL produce equivalent object (round-trip)

### Requirement 11: Engine-Specific Optimization

**User Story:** As a GEO practitioner, I want engine-specific configurations.

#### Acceptance Criteria

1. THE Optimizer SHALL support modular configs for Claude, GPT, Perplexity
2. THE Optimizer SHALL account for query fan-out patterns (3-5 sub-queries)
3. THE Optimizer SHALL track domain overlap metrics (15-32% between engines)

### Requirement 12: Crawler Simulation & Testing

**User Story:** As a QA engineer, I want to simulate AI agent behavior.

#### Acceptance Criteria

1. THE Simulator SHALL mimic GPTBot, ClaudeBot, PerplexityBot User-Agents
2. THE Simulator SHALL test: 404 bounces, JS rendering fails, justification density
3. THE Simulator SHALL measure error rate (<0.1% 404s) and latency (<200ms)

### Requirement 13: SaaS Extensibility Foundation

**User Story:** As a product manager, I want SDK architected for SaaS layering.

#### Acceptance Criteria

1. THE SDK SHALL expose typed, documented APIs for SaaS consumption
2. THE SDK SHALL support webhook/event emission for dashboards
3. THE SDK SHALL provide batch processing APIs for content generation at scale
