# Requirements Document: AI Search Optimization

## Introduction

This spec enhances Chimera's AI search optimization capabilities to maximize visibility in AI search engines (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) and answer engines (Google Assistant, Siri, Alexa). The goal is to make content not just findable, but **citable** - ensuring AI agents reference YOUR content over competitors.

**Market Context**: Competitors like Dora AI report users losing up to 64% of traffic to AI Overviews. Traditional SEO alone is insufficient - AI systems use distinct data sources and ranking algorithms that require specialized optimization (GEO).

**Core Insight**: AI agents don't just need to find content; they need to:
1. **Reach it** (fuzzy routing) ✅ Already implemented
2. **Scan it** (structured content) ⚠️ Partially implemented
3. **Cite it** (quotable, authoritative) ❌ Missing

## Glossary

- **llms.txt**: A standardized file (like robots.txt) that provides AI agents with a structured summary of site content, key facts, and navigation hints.
- **Quotable Snippet**: A self-contained, factual statement with statistics that AI agents are likely to cite verbatim.
- **Semantic Synonym**: Words with equivalent meaning in context (phone ↔ smartphone ↔ mobile).
- **AEO (Answer Engine Optimization)**: Optimization for voice assistants and featured snippets - focuses on concise, direct answers.
- **GEO (Generative Engine Optimization)**: Optimization for LLM-based search - focuses on being cited as a source in synthesized responses.
- **Justification Attribute**: Factual elements (specs, comparisons, statistics) that AI engines use to validate and cite content.
- **Citation Anchor**: A unique, quotable fact that increases likelihood of being cited.
- **Commodity Phrase**: Generic marketing language that provides no differentiation (e.g., "industry-leading", "best-in-class").

## Requirements

### Requirement 1: llms.txt Generator

**User Story:** As a website owner, I want to provide AI agents with a structured manifest of my site's content, so that they can efficiently discover and understand my pages without crawling.

#### Acceptance Criteria

1. WHEN the application builds THEN the LLMs_Generator SHALL create a `/llms.txt` file at the public root
2. WHEN generating llms.txt THEN the Generator SHALL include site name, description, and key facts in a structured format
3. WHEN generating llms.txt THEN the Generator SHALL list all important routes with one-line descriptions
4. WHEN generating llms.txt THEN the Generator SHALL include API endpoints with method and purpose
5. WHEN generating llms.txt THEN the Generator SHALL extract and list "quick facts" - statistics and unique claims
6. WHEN the content changes THEN the Generator SHALL regenerate llms.txt on the next build
7. WHEN an AI agent requests /llms.txt THEN the Server SHALL return plain text with proper Content-Type header

### Requirement 2: Semantic Synonym Matching

**User Story:** As a website owner, I want the fuzzy router to understand that "phone" and "smartphone" mean the same thing, so that AI agents using different terminology still find the right pages.

#### Acceptance Criteria

1. WHEN matching URLs THEN the Semantic_Engine SHALL expand tokens using a synonym dictionary
2. WHEN "phone" is in the hallucinated path THEN the Engine SHALL also match routes containing "smartphone", "mobile", or "cell"
3. WHEN "buy" is in the hallucinated path THEN the Engine SHALL also match routes containing "shop", "purchase", or "order"
4. WHEN "docs" is in the hallucinated path THEN the Engine SHALL also match routes containing "documentation", "guide", or "manual"
5. WHEN calculating similarity THEN the Engine SHALL weight synonym matches at 0.8x exact match weight
6. WHEN a custom synonym is added THEN the Engine SHALL include it in future matching without restart

### Requirement 3: Quotable Snippets Extractor

**User Story:** As a content creator, I want to identify which parts of my content are most likely to be cited by AI agents, so that I can optimize those sections for maximum visibility.

#### Acceptance Criteria

1. WHEN analyzing content THEN the Snippet_Extractor SHALL identify sentences containing statistics (percentages, numbers, comparisons)
2. WHEN a sentence contains a unique claim with data THEN the Extractor SHALL flag it as a "citation anchor"
3. WHEN extracting snippets THEN the Extractor SHALL prefer sentences under 280 characters (tweetable length)
4. WHEN ranking snippets THEN the Extractor SHALL score based on: specificity, uniqueness, and data presence
5. WHEN displaying results THEN the Extractor SHALL show the top 5 most quotable snippets with citation scores
6. WHEN a snippet lacks attribution THEN the Extractor SHALL suggest adding a source or methodology

### Requirement 4: AEO-Specific Optimization

**User Story:** As a website owner, I want my content optimized for voice assistants and featured snippets, so that when users ask questions, my content provides the direct answer.

#### Acceptance Criteria

1. WHEN content contains Q&A patterns THEN the AEO_Optimizer SHALL extract and format as FAQ schema
2. WHEN content contains step-by-step instructions THEN the AEO_Optimizer SHALL format as HowTo schema
3. WHEN analyzing content THEN the AEO_Optimizer SHALL identify the "featured snippet candidate" - the most concise answer to the implied question
4. WHEN the featured snippet candidate exceeds 50 words THEN the AEO_Optimizer SHALL suggest condensing
5. WHEN generating FAQ schema THEN the AEO_Optimizer SHALL ensure questions are natural language queries users would speak

### Requirement 5: AI Manifest Generator

**User Story:** As a developer, I want to provide AI agents with a machine-readable manifest of my site's capabilities, so that they can programmatically understand what my site offers.

#### Acceptance Criteria

1. WHEN the application builds THEN the Manifest_Generator SHALL create `/ai-manifest.json` at the public root
2. WHEN generating the manifest THEN the Generator SHALL include structured metadata: name, description, capabilities, routes
3. WHEN generating the manifest THEN the Generator SHALL include "intents" - what actions users can perform
4. WHEN generating the manifest THEN the Generator SHALL include "entities" - what objects/concepts the site covers
5. WHEN an AI agent requests /ai-manifest.json THEN the Server SHALL return valid JSON with proper Content-Type

### Requirement 6: Citation Score Calculator

**User Story:** As a content strategist, I want to know how likely my content is to be cited by AI agents, so that I can prioritize optimization efforts.

#### Acceptance Criteria

1. WHEN analyzing a page THEN the Citation_Calculator SHALL compute a citation score (0-100)
2. WHEN calculating the score THEN the Calculator SHALL weight: unique data (40%), source attribution (20%), quotable snippets (20%), schema coverage (20%)
3. WHEN the citation score is below 50 THEN the Calculator SHALL provide specific recommendations
4. WHEN displaying the score THEN the Dashboard SHALL show citation score alongside GEO Health Score
5. WHEN comparing pages THEN the Calculator SHALL rank pages by citation potential

### Requirement 7: Content Deduplication Detector

**User Story:** As a content creator, I want to know if my content is too similar to generic marketing language, so that AI agents have a reason to cite me specifically.

#### Acceptance Criteria

1. WHEN analyzing content THEN the Dedup_Detector SHALL identify "commodity" phrases that provide no differentiation
2. WHEN commodity phrases exceed 30% of content THEN the Detector SHALL flag as "low differentiation"
3. WHEN flagging content THEN the Detector SHALL suggest unique angles or data to add
4. WHEN content contains unique statistics or claims THEN the Detector SHALL highlight as "citation anchors"

### Requirement 8: Enhanced Dashboard with AI Search Metrics

**User Story:** As a website owner, I want to see AI-specific search metrics on my dashboard, so that I can track optimization progress.

#### Acceptance Criteria

1. WHEN displaying the dashboard THEN the UI SHALL show a dedicated "AI Search Readiness" section
2. WHEN displaying AI metrics THEN the Dashboard SHALL show: Citation Score, AEO Score, GEO Score separately
3. WHEN displaying AI metrics THEN the Dashboard SHALL show llms.txt status and last generation time
4. WHEN displaying AI metrics THEN the Dashboard SHALL show top quotable snippets across the site
5. WHEN a metric is below threshold THEN the Dashboard SHALL highlight with specific action items
