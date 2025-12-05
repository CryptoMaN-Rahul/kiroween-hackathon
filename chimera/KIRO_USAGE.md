# How I Used Kiro to Build Chimera GEO SDK

*A personal writeup for the Kiroween Hackathon - Frankenstein Category 🧟*

---

## The Story

I wanted to build something that solves a real problem I've been thinking about: AI agents are terrible at handling 404 errors. When ChatGPT or Perplexity hallucinates a URL that doesn't exist, they just... give up. The user gets nothing. I call this "AI Bounce" and it's costing websites real traffic.

So I decided to build Chimera - an SDK that makes websites AI-agent friendly. But here's the thing: this project required stitching together a bunch of different technologies that don't normally play together. Fuzzy string matching algorithms, JSON-LD schema generation, citation network analysis, content optimization... it's a lot.

That's where Kiro came in. Let me walk you through how I actually used each feature.

---

## 🎯 Spec-Driven Development

### Why I Chose Specs Over Pure Vibe Coding

I started with vibe coding - just chatting with Kiro about what I wanted to build. That worked great for the initial exploration. But once I had 8+ interconnected modules, I kept losing track of what was supposed to connect to what.

So I switched to spec-driven development. Best decision I made.

### The Requirements Phase

I created `.kiro/specs/chimera-geo-sdk-v2/requirements.md` and let Kiro help me structure my messy ideas into proper user stories. The EARS format (Easy Approach to Requirements Syntax) was new to me, but it forced me to be specific:

```markdown
### Requirement 1: Fuzzy URL Routing

**User Story:** As a website owner, I want AI agents to find the correct page 
even when they hallucinate URLs, so that I don't lose AI-driven traffic.

#### Acceptance Criteria
1. WHEN an AI agent requests a non-existent URL THEN the Symbiote Router 
   SHALL calculate semantic similarity against all valid routes
2. WHEN similarity score exceeds 0.7 threshold THEN the Symbiote Router 
   SHALL redirect to the best matching route
3. WHEN processing a redirect THEN the Symbiote Router SHALL complete 
   within 200ms latency budget
```

I ended up with 8 user stories and 40+ acceptance criteria. Sounds like a lot, but it meant I never had to wonder "wait, what was this supposed to do again?"

### The Design Phase

The design doc (`.kiro/specs/chimera-geo-sdk-v2/design.md`) is where things got interesting. Kiro helped me think through:

- Which fuzzy matching algorithms to use (ended up with 5: Levenshtein, Jaro-Winkler, N-Gram, Soundex, Cosine)
- How to structure the SDK so it's actually usable
- What "correctness" even means for this kind of system

The **correctness properties** were the game-changer. Instead of just writing "it should work," I had to define exactly what "working" means:

```markdown
### Property 28: Schema Round-Trip Consistency
*For any* valid GeneratedSchema object, serializing to JSON-LD string 
and parsing back SHALL produce an object deeply equal to the original.
**Validates: Requirements 10.4**
```

This property alone caught 3 bugs in my schema serializer that I never would have found with regular unit tests.

### The Tasks Phase

The tasks doc broke everything into 110 discrete steps. Each task referenced specific requirements, so I always knew why I was building something. The optional markers (`*`) for tests let me focus on core functionality first, then circle back for comprehensive testing.

### Spec vs Vibe: My Take

**Vibe coding** was perfect for:
- Initial exploration ("what if we combined fuzzy matching with schema generation?")
- Quick fixes and iterations
- Understanding unfamiliar APIs

**Spec-driven** was essential for:
- Complex multi-module systems
- Anything that needed to be "correct" (not just "working")
- Keeping track of 8+ interconnected features

I used both. Started with vibe to explore, switched to specs when complexity grew, then used vibe again for implementation details within each task.

---

## 🪝 Agent Hooks

### My Hook Philosophy

I only created hooks that actually saved me time. No "cool but useless" hooks.

### Hook 1: Security Scanner

**File:** `.kiro/hooks/security-scanner.kiro.hook`
**Trigger:** Every time I save a TypeScript file

This one saved my ass. I was testing with a real API key and almost committed it. The hook caught it:

```
⚠️ Potential security issue detected in src/lib/citation-monitor.ts:
Line 45: Possible API key pattern found
```

It scans for:
- API keys and tokens
- Hardcoded passwords
- Database connection strings
- Internal URLs that shouldn't be public

**Real impact:** Caught 3 potential credential leaks before they hit git.

### Hook 2: Test Scaffold Generator

**File:** `.kiro/hooks/test-scaffold-generator.kiro.hook`
**Trigger:** When I create a new file in `src/lib/`

Every time I created a new module, Kiro automatically generated a property test file with:
- Smart generators for the input types
- Template properties (round-trip, invariant, range)
- Proper imports following my project conventions

**Real impact:** Saved ~10 minutes per new file. With 15+ lib files, that's 2.5+ hours saved.

### Hooks I Didn't Create

I thought about creating hooks for:
- Auto-generating JSON-LD when pages are created
- Running GEO analysis on content changes
- Freshness checking

But these felt more like product features than developer productivity tools. So I put them in the MCP server instead, where they make more sense.

---

## 📚 Steering Files

### What Actually Helped

I have 6 steering files, but honestly, 4 of them do most of the work.

#### The Essential Ones

**`product.md`** - Tells Kiro what Chimera is and why it exists. Without this, Kiro would suggest generic solutions. With it, Kiro understands that we're optimizing for AI agents, not humans.

**`tech.md`** - Our tech stack and conventions. The most useful part:
```markdown
## Testing
- **Vitest** as test runner
- **fast-check** for property-based testing
- Property tests: 100 iterations per property by default
```

This meant every time Kiro generated tests, they followed our conventions automatically.

**`structure.md`** - Where files go. Sounds simple, but it prevented Kiro from putting tests in random places or creating files in the wrong directories.

**`property-testing-patterns.md`** - This one was crucial. It taught Kiro our annotation format:
```typescript
/**
 * **Feature: chimera-geo-sdk-v2, Property N: Property Name**
 * **Validates: Requirements X.Y**
 */
```

Every property test Kiro generated followed this format, which made traceability automatic.

#### The Conditional Ones

**`geo-conventions.md`** (loaded for `.tsx` files) - Domain-specific GEO patterns. Things like "scannability score thresholds" and "header hierarchy rules" that only matter when working on content analysis.

**`api-standards.md`** (loaded for `api/**` files) - API response formats and error codes. Only loaded when I'm working on API routes.

### What I Learned About Steering

- **Be specific.** Vague steering like "write good code" is useless.
- **Include examples.** Kiro learns better from examples than descriptions.
- **Use conditional inclusion.** Not everything needs to be loaded all the time.
- **Update as you go.** My steering files evolved as I learned what worked.

---

## 🔌 MCP Server

### Why I Built an MCP Server

Kiro is great at general coding, but it doesn't know anything about GEO optimization. I needed domain-specific tools.

### The 12 Tools I Built

**Citation & Analysis Tools:**
1. `scan_citations` - Find brand mentions across the web
2. `get_citation_stats` - Earned vs owned media breakdown
3. `build_topic_clusters` - Find orphan pages and linking opportunities

**Content Analysis Tools:**
4. `analyze_content_scannability` - Score content for AI readability
5. `analyze_information_gain` - Unique facts vs commodity phrases
6. `check_inverted_pyramid` - Is key info front-loaded?
7. `analyze_freshness` - Content staleness detection

**Generation Tools:**
8. `generate_schema` - Auto-generate JSON-LD
9. `detect_listicle_opportunity` - Should this be a listicle?

**Scoring Tools:**
10. `calculate_geo_score` - Overall GEO Health Score
11. `get_engine_recommendations` - Claude/GPT/Perplexity-specific tips

**Composite Tools:**
12. `full_page_analysis` - Run everything and get a comprehensive report

### How I Actually Used Them

During development, I could ask Kiro things like:

> "Analyze this content for GEO optimization"

And Kiro would automatically use my MCP tools to give me:
- Fact density score: 73%
- Information gain: 68/100
- Listicle suitability: 85% (roundup format recommended)
- Freshness: 12 days old (fresh)
- Specific recommendations

This was way more useful than generic advice.

### MCP Configuration

```json
{
  "mcpServers": {
    "chimera-citation": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "src/mcp/citation-server.ts"],
      "env": { "NODE_ENV": "development" },
      "autoApprove": [
        "scan_citations",
        "get_citation_stats",
        "analyze_freshness",
        "detect_listicle_opportunity"
      ]
    }
  }
}
```

The `autoApprove` list is important - these are read-only tools that I trust to run without confirmation.

---

## 💬 Vibe Coding Highlights

### The Most Impressive Generation

When I asked Kiro to implement the weighted fuzzy matching ensemble, it generated:

1. Five different similarity algorithms with proper implementations
2. A configurable weight system
3. Normalization to handle edge cases
4. **36 mathematical properties** for testing, including:
   - Reflexivity: `distance(a, a) === 0`
   - Symmetry: `distance(a, b) === distance(b, a)`
   - Triangle inequality: `distance(a, c) <= distance(a, b) + distance(b, c)`

I didn't ask for the triangle inequality property. Kiro just knew it was important for a distance metric. That's when I realized the steering files were really working.

### Conversation Strategy

I learned to structure my conversations in phases:

**Phase 1: Exploration**
> "I need fuzzy string matching for URL routing. AI agents hallucinate URLs, so we need to catch typos. What algorithms should we consider?"

**Phase 2: Implementation**
> "Implement Levenshtein distance with these requirements: handle Unicode, optimize for short strings, return normalized confidence score, include property tests."

**Phase 3: Integration**
> "Now combine all fuzzy algorithms into a weighted ensemble using these weights based on our research..."

Breaking it into phases kept the context focused and the outputs higher quality.

---

## 📊 Results

### By the Numbers

| Metric | Value |
|--------|-------|
| Test Files | 23 |
| Total Tests | 512 |
| Pass Rate | 100% |
| Correctness Properties | 36 |
| MCP Tools | 12 |
| Steering Files | 6 |
| Agent Hooks | 6 |
| Tasks Completed | 110/110 |

### Build Status

```bash
$ npm run build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (11/11)

$ npm test
Test Files  23 passed (23)
Tests       512 passed (512)
Duration    4.64s
```

---

## 🧟 Why This is a Frankenstein Project

Chimera stitches together technologies that don't normally play together:

1. **Fuzzy String Matching** (5 algorithms) - For catching hallucinated URLs
2. **Information Theory** (TF-IDF, entropy) - For content analysis
3. **Graph Theory** (citation networks) - For authority scoring
4. **NLP** (content analysis) - For scannability scoring
5. **Schema.org** (JSON-LD) - For structured data
6. **Property-Based Testing** (fast-check) - For mathematical verification
7. **MCP Protocol** - For extending Kiro
8. **Event-Driven Architecture** - For real-time updates

Each piece is useful on its own. Together, they create something that solves a problem none of them could solve alone.

---

## 🎯 What I'd Do Differently

1. **Start with specs earlier.** I wasted time in vibe coding that I had to redo when I switched to specs.

2. **More conditional steering.** Some of my "always included" files could be conditional.

3. **Fewer MCP tools, better organized.** 12 tools is a lot. I'd group them better next time.

4. **More checkpoints in tasks.** I had a few long stretches without verification points.

---

## Final Thoughts

Kiro changed how I approach complex projects. The combination of:
- **Specs** for structure and traceability
- **Steering** for domain context
- **Hooks** for automation
- **MCP** for extensibility
- **Vibe coding** for exploration and iteration

...created a development experience that let me build something I couldn't have built alone. Not just faster - I mean I literally couldn't have kept track of all the interconnected pieces without Kiro's help.

The 512 passing tests aren't just a number. They're evidence that the system actually works the way it's supposed to. And that's what matters.

---

**Built for the Agent Economy** 🚀

*Happy Kiroween! 🎃*
