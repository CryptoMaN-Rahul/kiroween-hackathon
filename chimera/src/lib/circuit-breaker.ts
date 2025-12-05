/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides resilience for external API calls by:
 * 1. Tracking failure rates per endpoint
 * 2. Opening circuit after consecutive failures
 * 3. Half-opening after timeout to test recovery
 * 4. Providing fallback strategies
 * 
 * @module circuit-breaker
 */

// =============================================================================
// Types
// =============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open state to close circuit (default: 2) */
  successThreshold: number;
  /** Optional name for logging */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export interface CircuitBreaker {
  /** Execute a function with circuit breaker protection */
  execute<R>(fn: () => Promise<R>, fallback?: () => R | Promise<R>): Promise<R>;
  /** Get current circuit state */
  getState(): CircuitState;
  /** Get circuit statistics */
  getStats(): CircuitBreakerStats;
  /** Manually reset the circuit */
  reset(): void;
  /** Force open the circuit (for testing/maintenance) */
  forceOpen(): void;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  successThreshold: 2,
};

// =============================================================================
// Circuit Breaker Implementation
// =============================================================================

/**
 * Create a circuit breaker instance.
 * 
 * @example
 * const breaker = createCircuitBreaker({ name: 'reddit-api' });
 * 
 * const result = await breaker.execute(
 *   () => fetch('https://reddit.com/search.json'),
 *   () => [] // fallback to empty array
 * );
 */
export function createCircuitBreaker(
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  const cfg: CircuitBreakerConfig = { ...DEFAULT_CONFIG, ...config };
  
  let state: CircuitState = 'closed';
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;
  let lastFailureTime: number | null = null;
  let lastSuccessTime: number | null = null;
  let totalCalls = 0;
  let totalFailures = 0;
  let totalSuccesses = 0;
  
  const log = (message: string) => {
    if (cfg.name) {
      console.log(`[CircuitBreaker:${cfg.name}] ${message}`);
    }
  };
  
  function shouldAttemptReset(): boolean {
    if (state !== 'open') return false;
    if (!lastFailureTime) return true;
    
    const timeSinceFailure = Date.now() - lastFailureTime;
    return timeSinceFailure >= cfg.resetTimeoutMs;
  }
  
  function recordSuccess(): void {
    consecutiveFailures = 0;
    consecutiveSuccesses++;
    lastSuccessTime = Date.now();
    totalSuccesses++;
    
    if (state === 'half-open' && consecutiveSuccesses >= cfg.successThreshold) {
      state = 'closed';
      log('Circuit closed after successful recovery');
    }
  }
  
  function recordFailure(error: unknown): void {
    consecutiveSuccesses = 0;
    consecutiveFailures++;
    lastFailureTime = Date.now();
    totalFailures++;
    
    if (state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      state = 'open';
      log(`Circuit reopened after failure in half-open state: ${error}`);
    } else if (consecutiveFailures >= cfg.failureThreshold) {
      state = 'open';
      log(`Circuit opened after ${consecutiveFailures} consecutive failures`);
    }
  }
  
  return {
    async execute<R>(fn: () => Promise<R>, fallback?: () => R | Promise<R>): Promise<R> {
      totalCalls++;
      
      // Check if circuit is open
      if (state === 'open') {
        if (shouldAttemptReset()) {
          state = 'half-open';
          consecutiveSuccesses = 0;
          log('Circuit entering half-open state');
        } else {
          // Circuit is open, use fallback or throw
          if (fallback) {
            log('Circuit open, using fallback');
            return fallback();
          }
          throw new CircuitOpenError(cfg.name || 'unknown');
        }
      }
      
      try {
        const result = await fn();
        recordSuccess();
        return result;
      } catch (error) {
        recordFailure(error);
        
        // If we have a fallback, use it
        if (fallback) {
          log(`Call failed, using fallback: ${error}`);
          return fallback();
        }
        
        throw error;
      }
    },
    
    getState(): CircuitState {
      // Check if we should transition from open to half-open
      if (state === 'open' && shouldAttemptReset()) {
        return 'half-open';
      }
      return state;
    },
    
    getStats(): CircuitBreakerStats {
      return {
        state: this.getState(),
        failures: consecutiveFailures,
        successes: consecutiveSuccesses,
        lastFailureTime,
        lastSuccessTime,
        totalCalls,
        totalFailures,
        totalSuccesses,
      };
    },
    
    reset(): void {
      state = 'closed';
      consecutiveFailures = 0;
      consecutiveSuccesses = 0;
      log('Circuit manually reset');
    },
    
    forceOpen(): void {
      state = 'open';
      lastFailureTime = Date.now();
      log('Circuit manually opened');
    },
  };
}

// =============================================================================
// Circuit Open Error
// =============================================================================

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

/**
 * Global registry for circuit breakers.
 * Allows sharing circuit breakers across modules.
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  /**
   * Get or create a circuit breaker by name.
   */
  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, createCircuitBreaker({ ...config, name }));
    }
    return this.breakers.get(name)!;
  }
  
  /**
   * Get a circuit breaker by name.
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
  
  /**
   * Get all circuit breaker stats.
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }
  
  /**
   * Reset all circuit breakers.
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Execute a function with circuit breaker protection using the global registry.
 * 
 * @example
 * const data = await withCircuitBreaker(
 *   'reddit-api',
 *   () => fetch('https://reddit.com/search.json'),
 *   () => ({ data: { children: [] } })
 * );
 */
export async function withCircuitBreaker<R>(
  name: string,
  fn: () => Promise<R>,
  fallback?: () => R | Promise<R>,
  config?: Partial<CircuitBreakerConfig>
): Promise<R> {
  const breaker = circuitBreakerRegistry.getOrCreate(name, config);
  return breaker.execute(fn, fallback);
}

/**
 * Get circuit breaker stats for a named breaker.
 */
export function getCircuitBreakerStats(name: string): CircuitBreakerStats | undefined {
  return circuitBreakerRegistry.get(name)?.getStats();
}

/**
 * Get all circuit breaker stats.
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  return circuitBreakerRegistry.getAllStats();
}
