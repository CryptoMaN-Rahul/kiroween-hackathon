---
inclusion: fileMatch
fileMatchPattern: "chimera/src/app/api/**/*"
---

# API Standards for Chimera

## Purpose
Guide Kiro to generate API routes that are consistent, well-documented, and AI-friendly.

## Response Format

### Success Response
```typescript
// Standard success response
return NextResponse.json({
  success: true,
  data: result,
  meta: {
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  }
});
```

### Error Response
```typescript
// Standard error response - machine-readable
return NextResponse.json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input parameters',
    details: [
      { field: 'email', message: 'Invalid email format' }
    ],
    suggestions: [
      'Check the email format',
      'Ensure all required fields are provided'
    ]
  },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  }
}, { status: 400 });
```

### 404 Response (AI-Friendly)
```typescript
// For fuzzy routing - provide alternatives
return NextResponse.json({
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    requestedPath: request.url,
    suggestions: [
      '/api/products',
      '/api/categories',
      '/api/search'
    ],
    similarRoutes: await findSimilarRoutes(request.url)
  },
  meta: {
    timestamp: new Date().toISOString(),
  }
}, { status: 404 });
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Performance Requirements

- Response time < 200ms for cached data
- Response time < 500ms for database queries
- Include `Cache-Control` headers where appropriate
