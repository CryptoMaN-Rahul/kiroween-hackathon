# Tech Stack

## Framework & Runtime
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Node.js** runtime

## Styling
- **Tailwind CSS** for utility-first styling
- **Geist** font family (local fonts)

## Testing
- **Vitest** as test runner
- **fast-check** for property-based testing
- **@testing-library/react** for component testing
- **jsdom** for DOM environment

## Code Quality
- **TypeScript** with strict mode
- **ESLint** with next/core-web-vitals and next/typescript configs

## MCP Integration
- **@modelcontextprotocol/sdk** for citation monitoring server

## Path Aliases
- `@/*` maps to `./src/*`

## Common Commands

```bash
# Development
npm run dev          # Start dev server

# Build & Production
npm run build        # Production build
npm run start        # Start production server

# Testing
npm test             # Run all tests (single run)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run with coverage report
npm run test:property # Run property-based tests only

# Linting
npm run lint         # Run ESLint

# MCP Server
npm run mcp:start    # Start citation MCP server
npm run mcp:test     # Test MCP server
```

## Test Configuration
- Test timeout: 30s (for property tests)
- Coverage thresholds: 80% (statements, branches, functions, lines)
- Property tests: 100 iterations per property by default
