---
inclusion: always
---

# Property-Based Testing Patterns

## Purpose
Guide Kiro to generate high-quality property-based tests using fast-check.

## Core Philosophy

Property-based testing verifies **universal properties** rather than specific examples:

| Traditional Test | Property Test |
|-----------------|---------------|
| Tests one input | Tests thousands of inputs |
| May miss edge cases | Finds edge cases automatically |
| Brittle to changes | Robust to implementation changes |
| Documents examples | Documents invariants |

## Property Patterns

### 1. Round-Trip Properties
For any serialization/deserialization:
```typescript
it('round-trips correctly', () => {
  fc.assert(
    fc.property(dataGen, (data) => {
      expect(parse(serialize(data))).toEqual(data);
    }),
    { numRuns: 100 }
  );
});
```

### 2. Idempotence Properties
For operations that should have no effect when repeated:
```typescript
it('is idempotent', () => {
  fc.assert(
    fc.property(inputGen, (input) => {
      expect(normalize(normalize(input))).toEqual(normalize(input));
    }),
    { numRuns: 100 }
  );
});
```

### 3. Invariant Properties
For properties that must always hold:
```typescript
it('maintains invariant', () => {
  fc.assert(
    fc.property(stateGen, actionGen, (state, action) => {
      const newState = reducer(state, action);
      expect(newState.count).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: 100 }
  );
});
```

## Test Annotation Format

Every property test MUST be annotated:
```typescript
/**
 * **Feature: chimera-ai-first-edge, Property N: Property Name**
 * **Validates: Requirements X.Y**
 */
it('property name', () => {
  // test implementation
});
```

## Configuration

Always use at least 100 iterations:
```typescript
fc.assert(property, { numRuns: 100 });
```
