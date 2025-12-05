---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx"
---

# GEO (Generative Engine Optimization) Conventions

## Content Structure for AI Scannability

### Required Elements
1. **Structured Headers**: Use H1 → H2 → H3 hierarchy without skipping levels
2. **Comparison Tables**: Convert product descriptions to tables when possible
3. **Bullet Lists**: Use for specifications, features, and key points
4. **Statistics**: Include quantitative data (numbers, percentages, measurements)

### JSON-LD Schema Requirements
Every page component should include JSON-LD structured data:

```tsx
// Example: Product page schema
const schema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "sku": "SKU123",
  "offers": {
    "@type": "Offer",
    "price": "99.99",
    "priceCurrency": "USD"
  }
};
```

### Entity Types to Detect
- **Product**: Items for sale with price, SKU, availability
- **Article**: Blog posts, news, content pieces
- **Organization**: Company information
- **Person**: Team members, authors
- **FAQ**: Question and answer pairs
- **BreadcrumbList**: Navigation hierarchy

### Scannability Score Thresholds
- **High (0.7-1.0)**: Content is AI-ready
- **Medium (0.5-0.7)**: Needs improvement
- **Low (0.0-0.5)**: Requires restructuring

### Anti-Patterns to Avoid
- Marketing fluff without facts
- Walls of text without structure
- Missing alt text on images
- Skipped header levels
- No quantitative data
