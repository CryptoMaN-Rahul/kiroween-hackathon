# Project Structure

```
chimera/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   │   └── dashboard/      # Dashboard data endpoint
│   │   ├── dashboard/          # Dashboard UI page
│   │   ├── shop/               # Demo e-commerce pages
│   │   ├── llms.txt/           # AI-readable site manifest
│   │   └── layout.tsx          # Root layout
│   │
│   ├── lib/                    # Core business logic
│   │   ├── ai-search/          # GEO optimization modules
│   │   │   ├── citation-calculator.ts
│   │   │   ├── llms-generator.ts
│   │   │   ├── revenue-calculator.ts
│   │   │   ├── snippet-extractor.ts
│   │   │   ├── types.ts
│   │   │   └── visibility-tracker.ts
│   │   ├── symbiote-router.ts  # Fuzzy URL routing
│   │   ├── semantic-engine.ts  # Semantic matching
│   │   ├── agent-detector.ts   # AI agent identification
│   │   ├── alias-manager.ts    # Learned alias storage
│   │   ├── fact-density-analyzer.ts
│   │   ├── schema-generator.ts # JSON-LD generation
│   │   ├── citation-monitor.ts
│   │   ├── topic-mapper.ts
│   │   ├── tokenizer.ts
│   │   └── sitemap-*.ts        # Sitemap utilities
│   │
│   ├── mcp/                    # MCP server implementations
│   │   └── citation-server.ts
│   │
│   ├── middleware.ts           # Next.js middleware (router entry)
│   │
│   └── types/                  # TypeScript type definitions
│       └── index.ts            # All shared types
│
├── tests/
│   ├── property/               # Property-based tests (fast-check)
│   ├── integration/            # Integration tests
│   ├── unit/                   # Unit tests
│   └── setup.ts                # Test configuration
│
└── .kiro/
    ├── specs/                  # Feature specifications
    ├── hooks/                  # Agent hooks
    └── steering/               # Context files
```

## Key Conventions

- **Types**: All shared types in `src/types/index.ts`
- **Middleware**: Request interception happens in `src/middleware.ts`
- **Library modules**: Pure functions with JSDoc comments, factory functions prefixed with `create*`
- **Tests**: Property tests use `*.property.test.ts` naming, co-located in `tests/property/`
- **API routes**: Use Next.js App Router convention (`route.ts` files)
