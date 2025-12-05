# Chimera: AI-First Edge

**The Fuzzy Router for the Agent Economy**

Chimera is a Next.js middleware and development toolkit that optimizes web applications for AI agents. It solves the critical "AI Bounce" problem where AI agents (ChatGPT, Perplexity, Gemini) immediately abandon sites that return 404 errors or present unstructured content.

## 🎯 The Problem: AI Bounce

AI agents have zero tolerance for errors. When an AI hallucinates a URL (e.g., `/products/iphone-15` instead of `/shop/apple/iphone-15`), traditional sites return a 404 and lose the visitor. This costs businesses revenue and visibility in the emerging Agent Economy.

## 🚀 The Solution: Fuzzy Routing + GEO Optimization

Chimera provides three core capabilities:

1. **Symbiote Router**: Intercepts 404s and performs semantic fuzzy matching to redirect hallucinated URLs to valid routes
2. **Fact-Density Analyzer**: Kiro hooks that analyze content scannability and auto-generate JSON-LD schemas
3. **Citation Network Monitor**: MCP-powered tool tracking brand mentions and earned media authority

## ✨ Key Features

- **Fuzzy URL Matching**: Semantic similarity engine catches hallucinated URLs before 404
- **Automatic Alias Learning**: System learns common hallucinations and creates permanent redirects
- **AI Agent Detection**: Identifies and tracks ChatGPT, Perplexity, Claude, Gemini traffic
- **Content Scannability Analysis**: Analyzes pages for AI-friendly structure (tables, lists, statistics)
- **JSON-LD Auto-Generation**: Detects entities and generates Schema.org structured data
- **GEO Health Score**: Comprehensive metric combining route health, content quality, schema coverage, and citation authority
- **Property-Based Testing**: 175 tests across 24 correctness properties ensure reliability

## 📊 GEO Health Dashboard

Monitor your site's AI-readiness with real-time metrics:

- **Route Health**: 404 interception rate, learned aliases, redirect confidence
- **Content Scannability**: Average fact-density scores, low-scoring pages
- **Schema Coverage**: Percentage of pages with valid JSON-LD
- **Citation Authority**: Earned media tracking with domain authority weighting

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/chimera.git
cd chimera

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
```

## 🎮 Quick Start

### 1. Enable Fuzzy Routing

The Symbiote Router is automatically active via Next.js middleware. Configure in `src/middleware.ts`:

```typescript
const config: SymbioteRouterConfig = {
  confidenceThreshold: 0.7,  // Minimum similarity for redirect
  maxLatencyMs: 100,         // Maximum added latency
  enableLearning: true,      // Auto-create aliases
  aliasThreshold: 3          // Redirects before alias creation
};
```

### 2. Analyze Content Scannability

Use the Kiro hook to analyze content:

```bash
# The fact-density analyzer runs automatically on file save
# Check .kiro/hooks/fact-density-analyzer.md for configuration
```

### 3. Generate JSON-LD Schemas

```typescript
import { generateFromContent } from '@/lib/schema-generator';

const schema = generateFromContent(pageContent, pageUrl);
// Returns valid Schema.org JSON-LD
```

### 4. View Dashboard

Navigate to `/dashboard` to see your GEO Health Score and all metrics.

## 🧪 Testing

Chimera uses property-based testing with fast-check to ensure correctness:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/property/routing.property.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Coverage

- **175 tests** across **12 test suites**
- **24 correctness properties** validated
- **100+ iterations** per property test
- Properties cover: routing, content analysis, schema generation, citations, topology



## 🎯 Kiro Integration

Chimera was built using Kiro's spec-driven development workflow:

### Specs
- **Requirements**: 9 user stories with EARS-compliant acceptance criteria
- **Design**: 24 correctness properties with property-based testing strategy
- **Tasks**: 23 phases with 100+ sub-tasks

### Steering Files
- `product.md`: Chimera's purpose and target users
- `tech.md`: Next.js, TypeScript, Tailwind, Vitest, fast-check
- `geo-conventions.md`: JSON-LD patterns and content guidelines

### Agent Hooks
- **Fact-Density Analyzer**: Triggers on `.tsx` and `.md` file saves
- **Schema Generator**: Triggers on page component saves

### MCP Server
- **Citation Monitor**: Tracks brand mentions and calculates GEO Health Score

## 📈 Performance

- **Fuzzy Routing Latency**: <100ms added to request
- **Semantic Matching**: Jaccard similarity + Levenshtein distance
- **Alias Lookup**: O(1) hash map lookup
- **Test Suite**: ~1.5s for 175 tests

## 🔮 Future Enhancements

- **LLM-Powered Matching**: Use embeddings for semantic similarity
- **Real-Time Citation Scanning**: Integrate with search APIs
- **A/B Testing**: Compare fuzzy routing vs traditional 404s
- **Analytics Dashboard**: Track conversion rates for AI agent traffic
- **Multi-Language Support**: Extend tokenization for non-English content

## 🤝 Contributing

Chimera was built for the Kiroween Hackathon (Frankenstein category). Contributions welcome!

## 📄 License

MIT

## 🏆 Hackathon Submission

**Category**: Frankenstein (Stitching together Edge Computing + LLM Inference + SEO Knowledge Graphs)

**Key Innovation**: Fuzzy routing that catches hallucinated URLs before 404, combined with comprehensive GEO optimization toolkit.

**Kiro Features Used**:
- ✅ Spec-driven development (requirements → design → tasks)
- ✅ Property-based testing with 24 correctness properties
- ✅ Agent hooks for content analysis
- ✅ MCP server for citation monitoring
- ✅ Steering files for context

**Test Coverage**: 175 tests, 24 properties, 100% pass rate

---

Built with ❤️ using Kiro for the Agent Economy
