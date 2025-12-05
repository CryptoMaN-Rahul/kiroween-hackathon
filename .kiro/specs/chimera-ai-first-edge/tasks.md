# Implementation Plan

## Phase 1: Project Foundation

- [x] 1. Initialize Next.js project with TypeScript and core dependencies
  - [x] 1.1 Create Next.js 14 app with App Router, TypeScript, and Tailwind CSS
    - Initialize with `create-next-app` using TypeScript template
    - Configure Tailwind CSS for dashboard styling
    - Set up path aliases in tsconfig.json
    - _Requirements: All_

  - [x] 1.2 Install and configure testing framework
    - Install Vitest, fast-check, and testing utilities
    - Configure vitest.config.ts with coverage settings
    - Set up test scripts in package.json
    - _Requirements: Testing Strategy_

  - [x] 1.3 Create project directory structure
    - Create `src/lib/` for core logic
    - Create `src/middleware/` for Next.js middleware
    - Create `src/components/` for React components
    - Create `src/app/api/` for API routes
    - Create `tests/unit/`, `tests/property/`, `tests/integration/`
    - _Requirements: All_

  - [x] 1.4 Define core TypeScript interfaces and types
    - Create `src/types/index.ts` with all interfaces from design doc
    - Export RouteMatch, SemanticMatch, FactDensityResult, GeneratedSchema, etc.
    - _Requirements: All component interfaces_

## Phase 2: Symbiote Router Core

- [x] 2. Implement URL tokenization and semantic matching foundation
  - [x] 2.1 Implement URL tokenizer
    - Create `src/lib/tokenizer.ts`
    - Implement `tokenizePath()` function splitting on `/`, `-`, `_`
    - Handle edge cases: empty paths, trailing slashes, encoded characters
    - _Requirements: 1.6_

  - [x] 2.2 Write property test for URL tokenization
    - **Property 3: URL Tokenization Consistency**
    - **Validates: Requirements 1.6**

  - [x] 2.3 Implement semantic similarity engine
    - Create `src/lib/semantic-engine.ts`
    - Implement token-based similarity scoring (Jaccard similarity)
    - Implement `findBestMatch()` returning route with highest confidence
    - _Requirements: 1.2_

  - [x] 2.4 Write property test for semantic matching threshold
    - **Property 2: Semantic Match Confidence Threshold**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Implement sitemap management
  - [x] 3.1 Create sitemap parser and indexer
    - Create `src/lib/sitemap-manager.ts`
    - Implement `loadSitemap()` to parse sitemap.xml
    - Implement `indexRoutes()` to build searchable route index
    - _Requirements: 7.1, 7.3_

  - [x] 3.2 Implement sitemap generator
    - Create `src/lib/sitemap-generator.ts`
    - Implement route crawling from Next.js app directory
    - Generate sitemap.xml with proper XML structure
    - Implement sitemap splitting for >1000 routes
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 3.3 Write property tests for sitemap
    - **Property 19: Sitemap Route Completeness**
    - **Property 20: Sitemap Splitting Threshold**
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [x] 4. Implement Symbiote Router middleware
  - [x] 4.1 Create Next.js middleware for 404 interception
    - Create `src/middleware.ts`
    - Implement request interception before 404 response
    - Integrate with semantic engine for fuzzy matching
    - Return 301 redirect for matches above threshold
    - Return 404 with machine-readable payload for no matches
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 4.2 Write property test for 404 interception
    - **Property 1: 404 Interception Completeness**
    - **Validates: Requirements 1.1**

  - [x] 4.3 Implement hallucination logging
    - Create `src/lib/hallucination-logger.ts`
    - Log hallucinated path, matched path, confidence, timestamp, agent type
    - Store in JSON file initially (can upgrade to DB later)
    - _Requirements: 1.5_

  - [x] 4.4 Write property test for logging completeness
    - **Property 4: Hallucination Logging Completeness**
    - **Validates: Requirements 1.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Alias Learning System

- [x] 6. Implement route alias learning
  - [x] 6.1 Create alias storage and management
    - Create `src/lib/alias-manager.ts`
    - Implement `getAliases()`, `createAlias()`, `deleteAlias()`
    - Store aliases in JSON file with hit counts and timestamps
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 6.2 Implement automatic alias creation
    - Track redirect counts per hallucinated path
    - Auto-create alias when count reaches threshold (default: 3)
    - Integrate with middleware to check aliases before semantic matching
    - _Requirements: 2.1, 2.2_

  - [x] 6.3 Write property tests for alias system
    - **Property 5: Alias Learning Threshold**
    - **Property 6: Alias Priority Over Semantic Matching**
    - **Property 7: Alias Deletion Restores Semantic Matching**
    - **Validates: Requirements 2.1, 2.2, 2.4**

## Phase 4: Agent Detection

- [x] 7. Implement AI agent detection
  - [x] 7.1 Create agent detector with known signatures
    - Create `src/lib/agent-detector.ts`
    - Define signatures for ChatGPT, Perplexity, Claude, Gemini, Generic-Bot
    - Implement `detect()` analyzing User-Agent and request patterns
    - Return AgentDetectionResult with type and confidence
    - _Requirements: 8.1, 8.2_

  - [x] 7.2 Write property test for agent detection
    - **Property 21: Agent Detection and Classification**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 7.3 Implement agent analytics logging
    - Create `src/lib/analytics-logger.ts`
    - Log agent type, path, outcome for each AI agent visit
    - Separate AI traffic from human traffic in logs
    - _Requirements: 8.3, 8.4_

  - [x] 7.4 Write property test for analytics logging
    - **Property 22: Agent Analytics Logging**
    - **Validates: Requirements 8.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Fact-Density Analyzer (Kiro Hook)

- [x] 9. Implement content analysis engine
  - [x] 9.1 Create fact-density analyzer core
    - Create `src/lib/fact-density-analyzer.ts`
    - Implement content parsing for tables, bullet lists, statistics, headers
    - Calculate scannability score (0-1) based on element counts
    - Determine justification level (high/medium/low)
    - _Requirements: 3.1, 3.4_

  - [x] 9.2 Write property test for score calculation
    - **Property 8: Fact-Density Score Calculation**
    - **Validates: Requirements 3.1**

  - [x] 9.3 Implement suggestion generator
    - Generate suggestions when score < 0.5
    - Suggest comparison tables for product descriptions
    - Suggest adding statistics for low-justification content
    - _Requirements: 3.2, 3.3_

  - [x] 9.4 Write property test for suggestions
    - **Property 9: Low Scannability Triggers Suggestions**
    - **Validates: Requirements 3.2**

  - [x] 9.5 Implement header hierarchy validator
    - Detect skipped header levels (H1 -> H3)
    - Flag invalid hierarchies in analysis result
    - _Requirements: 3.5_

  - [x] 9.6 Write property test for header validation
    - **Property 10: Header Hierarchy Validation**
    - **Validates: Requirements 3.5**

- [x] 10. Create Kiro hook for fact-density analysis
  - [x] 10.1 Create agent hook configuration
    - Create `.kiro/hooks/fact-density-hook.json`
    - Configure trigger on file save for `**/*.tsx` and `**/*.md`
    - Define hook instructions for content analysis
    - _Requirements: 3.1-3.5_

## Phase 6: JSON-LD Schema Generator (Kiro Hook)

- [x] 11. Implement schema generation engine
  - [x] 11.1 Create entity detector
    - Create `src/lib/schema-generator.ts`
    - Implement `detectEntities()` for Product, Article, Organization, Person, FAQ
    - Use content patterns and keywords for detection
    - _Requirements: 4.1_

  - [x] 11.2 Write property test for entity detection
    - **Property 12: Schema Entity Detection**
    - **Validates: Requirements 4.1**

  - [x] 11.3 Implement JSON-LD generator
    - Generate valid JSON-LD following Schema.org vocabulary
    - Include all required properties per entity type
    - Create @graph for pages with multiple entities
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 11.4 Write property test for required properties
    - **Property 13: Schema Required Properties**
    - **Validates: Requirements 4.3**

  - [x] 11.5 Implement schema serialization with round-trip support
    - Implement `serialize()` and `parse()` methods
    - Ensure round-trip consistency for all valid schemas
    - _Requirements: 4.6_

  - [x] 11.6 Write property test for round-trip consistency
    - **Property 11: JSON-LD Round-Trip Consistency**
    - **Validates: Requirements 4.6**

  - [x] 11.7 Implement schema validator
    - Validate against Schema.org specifications
    - Report errors for missing required properties
    - _Requirements: 4.5_

- [x] 12. Create Kiro hook for schema generation
  - [x] 12.1 Create agent hook configuration
    - Create `.kiro/hooks/schema-generator-hook.json`
    - Configure trigger on file save for page components
    - Define hook instructions for schema generation
    - _Requirements: 4.1-4.6_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Citation Monitor (MCP Server)

- [x] 14. Implement citation monitoring
  - [x] 14.1 Create citation monitor core
    - Create `src/lib/citation-monitor.ts`
    - Implement brand term search (mock search API initially)
    - Extract source domain, mention context, sentiment
    - _Requirements: 5.1, 5.2_

  - [x] 14.2 Implement citation ranking
    - Sort by domain authority (descending)
    - Secondary sort by recency (descending)
    - _Requirements: 5.3_

  - [x] 14.3 Write property test for citation ranking
    - **Property 14: Citation Ranking Order**
    - **Validates: Requirements 5.3**

  - [x] 14.4 Implement GEO Health Score calculation
    - Calculate component scores: Route Health, Content Scannability, Schema Coverage, Citation Authority
    - Weight earned media higher than brand-owned content
    - Combine into overall score (0-100)
    - _Requirements: 5.4, 6.2_

  - [x] 14.5 Write property test for GEO score weighting
    - **Property 15: GEO Score Earned Media Weighting**
    - **Validates: Requirements 5.4**

- [x] 15. Create MCP server for citation monitoring
  - [x] 15.1 Create MCP server configuration
    - Create `.kiro/settings/mcp.json` with citation monitor server
    - Define tools for citation scanning and GEO score retrieval
    - _Requirements: 5.1-5.5_

## Phase 8: Topic Cluster Mapping

- [x] 16. Implement topic clustering
  - [x] 16.1 Create topic mapper core
    - Create `src/lib/topic-mapper.ts`
    - Implement semantic relationship detection between pages
    - Calculate similarity scores between page content
    - _Requirements: 9.1_

  - [x] 16.2 Write property test for relationship symmetry
    - **Property 23: Topic Cluster Relationship Symmetry**
    - **Validates: Requirements 9.1**

  - [x] 16.3 Implement orphan page detection
    - Flag pages with zero semantic connections
    - Generate integration suggestions
    - _Requirements: 9.4_

  - [x] 16.4 Write property test for orphan detection
    - **Property 24: Orphan Page Detection**
    - **Validates: Requirements 9.4**

  - [x] 16.5 Implement linking suggestions
    - Generate internal linking recommendations
    - Prioritize links that strengthen topic clusters
    - _Requirements: 9.2_

## Phase 9: GEO Health Dashboard

- [x] 17. Implement dashboard API routes
  - [x] 17.1 Create dashboard data API
    - Create `src/app/api/dashboard/route.ts`
    - Return GEO Health Score with all component metrics
    - Include Route Health, Content Scannability, Schema Coverage, Citation Authority
    - _Requirements: 6.1, 6.2_

  - [x] 17.2 Write property test for metric completeness
    - **Property 16: Dashboard Metric Completeness**
    - **Validates: Requirements 6.2**

  - [x] 17.3 Create route health API
    - Return 404 counts, successful redirects, learned aliases
    - _Requirements: 6.3_

  - [x] 17.4 Create content scannability API
    - Calculate and return average fact-density score
    - _Requirements: 6.4_

  - [x] 17.5 Write property test for average calculation
    - **Property 17: Content Scannability Average**
    - **Validates: Requirements 6.4**

  - [x] 17.6 Create schema coverage API
    - Calculate percentage of pages with valid JSON-LD
    - _Requirements: 6.5_

  - [x] 17.7 Write property test for coverage percentage
    - **Property 18: Schema Coverage Percentage**
    - **Validates: Requirements 6.5**

- [x] 18. Implement dashboard UI
  - [x] 18.1 Create main dashboard page
    - Create `src/app/dashboard/page.tsx`
    - Display overall GEO Health Score prominently
    - Show component metric breakdown
    - Highlight metrics below threshold in warning state
    - _Requirements: 6.1, 6.6_

  - [x] 18.2 Create route health panel
    - Display 404 interception stats
    - Show learned aliases with management controls
    - Display hallucination log
    - _Requirements: 2.3, 6.3_

  - [x] 18.3 Create content analysis panel
    - Display average scannability score
    - List pages with low scores and suggestions
    - _Requirements: 6.4_

  - [x] 18.4 Create schema coverage panel
    - Display coverage percentage
    - List pages missing JSON-LD
    - _Requirements: 6.5_

  - [x] 18.5 Create citation network panel
    - Display citation list with sentiment
    - Show domain authority rankings
    - _Requirements: 5.2, 5.3_

  - [x] 18.6 Create topic cluster visualization
    - Render interactive graph of page relationships
    - Highlight orphan pages
    - _Requirements: 9.3_

  - [x] 18.7 Create AI traffic analytics panel
    - Display AI agent traffic separately from human traffic
    - Show agent type breakdown
    - _Requirements: 8.4_

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 10: Kiro Integration & Polish

- [x] 20. Create steering documentation
  - [x] 20.1 Create product steering file
    - Create `.kiro/steering/product.md`
    - Document Chimera's purpose, target users, key features
    - _Requirements: Kiro Integration_

  - [x] 20.2 Create tech stack steering file
    - Create `.kiro/steering/tech.md`
    - Document Next.js, TypeScript, Tailwind, Vitest, fast-check
    - _Requirements: Kiro Integration_

  - [x] 20.3 Create GEO conventions steering file
    - Create `.kiro/steering/geo-conventions.md`
    - Document JSON-LD patterns, content structure guidelines
    - _Requirements: Kiro Integration_

- [x] 21. Create demo content and routes
  - [x] 21.1 Create sample e-commerce pages
    - Create product pages with varying content quality
    - Include pages that trigger fact-density warnings
    - _Requirements: Demo_

  - [x] 21.2 Create intentionally "hallucination-prone" URL structure
    - Set up routes that AI agents commonly guess wrong
    - Document expected hallucination patterns
    - _Requirements: Demo_

- [x] 22. Final integration and documentation
  - [x] 22.1 Write README with setup instructions
    - Document installation, configuration, usage
    - Include demo walkthrough
    - _Requirements: Submission_

  - [x] 22.2 Create Kiro usage documentation
    - Document how each Kiro feature was used
    - Explain spec-driven development process
    - Detail hook and MCP configurations
    - _Requirements: Submission_

- [ ] 23. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
