import '@testing-library/jest-dom'
import { expect } from 'vitest'

// Extend Vitest's expect with custom matchers if needed
// This file runs before each test file

// Configure fast-check for property-based testing
// Minimum 100 iterations as per design doc
export const FC_CONFIG = {
  numRuns: 100,
  verbose: true,
  endOnFailure: true
}
