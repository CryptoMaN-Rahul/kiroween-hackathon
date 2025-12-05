/**
 * Rate Limiter Module
 * 
 * Token bucket rate limiter for external API calls.
 * Prevents API bans by respecting rate limits.
 * 
 * @module rate-limiter
 */

// =============================================================================
// Types
// =============================================================================

export interface RateLimiterConfig {
  /** Maximum tokens in bucket */
  maxTokens: number;
  /** Tokens added per interval */
  refillRate: number;
  /** Refill interval in milliseconds */
  refillIntervalMs: number;
  /** Optional name for logging */
  name?: string;
}

export interface RateLimiterStats {
  /** Current available tokens */
  availableTokens: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Total requests made */
  totalRequests: number;
  /** Requests that were rate limited */
  limitedRequests: number;
  /** Requests that succeeded */
  successfulRequests: number;
  /** Last refill timestamp */
  lastRefillTime: number;
}

export interface RateLimiter {
  /** Try to acquire a token. Returns true if successful, false if rate limited */
  tryAcquire(): boolean;
  /** Acquire a token, waiting if necessary. Returns wait time in ms */
  acquire(): Promise<number>;
  /** Get current stats */
  getStats(): RateLimiterStats;
  /** Reset the rate limiter */
  reset(): void;
  /** Get time until next token is available (0 if available now) */
  getWaitTime(): number;
}

// =============================================================================
// Default Configurations for Known APIs
// =============================================================================

/**
 * Pre-configured rate limits for known APIs.
 * These are conservative estimates to avoid bans.
 */
export const API_RATE_LIMITS: Record<string, RateLimiterConfig> = {
  // Reddit: 60 requests per minute for unauthenticated
  'reddit': {
    maxTokens: 60,
    refillRate: 60,
    refillIntervalMs: 60000, // 1 minute
    name: 'reddit-api'
  },
  // Hacker News Algolia: ~100 requests per minute
  'hackernews': {
    maxTokens: 100,
    refillRate: 100,
    refillIntervalMs: 60000,
    name: 'hackernews-api'
  },
  // GitHub: 10 requests per minute for unauthenticated
  'github': {
    maxTokens: 10,
    refillRate: 10,
    refillIntervalMs: 60000,
    name: 'github-api'
  },
  // Open PageRank: 10 requests per second (free tier)
  'openpagerank': {
    maxTokens: 10,
    refillRate: 10,
    refillIntervalMs: 1000,
    name: 'openpagerank-api'
  },
  // Generic default: 30 requests per minute
  'default': {
    maxTokens: 30,
    refillRate: 30,
    refillIntervalMs: 60000,
    name: 'default'
  }
};

// =============================================================================
// Token Bucket Implementation
// =============================================================================

/**
 * Create a token bucket rate limiter.
 * 
 * The token bucket algorithm:
 * - Bucket starts full with maxTokens
 * - Each request consumes 1 token
 * - Tokens are refilled at refillRate per refillIntervalMs
 * - If bucket is empty, requests are rate limited
 * 
 * @example
 * const limiter = createRateLimiter({ maxTokens: 60, refillRate: 60, refillIntervalMs: 60000 });
 * 
 * if (limiter.tryAcquire()) {
 *   // Make API call
 * } else {
 *   // Rate limited, wait or skip
 * }
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { maxTokens, refillRate, refillIntervalMs, name } = config;
  
  let tokens = maxTokens;
  let lastRefillTime = Date.now();
  let totalRequests = 0;
  let limitedRequests = 0;
  let successfulRequests = 0;
  
  /**
   * Refill tokens based on elapsed time
   */
  function refill(): void {
    const now = Date.now();
    const elapsed = now - lastRefillTime;
    
    if (elapsed >= refillIntervalMs) {
      // Calculate how many refill intervals have passed
      const intervals = Math.floor(elapsed / refillIntervalMs);
      const tokensToAdd = intervals * refillRate;
      
      tokens = Math.min(maxTokens, tokens + tokensToAdd);
      lastRefillTime = now - (elapsed % refillIntervalMs);
    }
  }
  
  /**
   * Calculate time until next token is available
   */
  function calculateWaitTime(): number {
    if (tokens > 0) return 0;
    
    const now = Date.now();
    const elapsed = now - lastRefillTime;
    const timeUntilRefill = refillIntervalMs - elapsed;
    
    return Math.max(0, timeUntilRefill);
  }
  
  return {
    tryAcquire(): boolean {
      refill();
      totalRequests++;
      
      if (tokens > 0) {
        tokens--;
        successfulRequests++;
        return true;
      }
      
      limitedRequests++;
      if (name) {
        console.warn(`[RateLimiter:${name}] Rate limited. Wait ${calculateWaitTime()}ms`);
      }
      return false;
    },
    
    async acquire(): Promise<number> {
      refill();
      totalRequests++;
      
      if (tokens > 0) {
        tokens--;
        successfulRequests++;
        return 0;
      }
      
      // Wait for next refill
      const waitTime = calculateWaitTime();
      if (waitTime > 0) {
        if (name) {
          console.log(`[RateLimiter:${name}] Waiting ${waitTime}ms for rate limit`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
        refill();
      }
      
      if (tokens > 0) {
        tokens--;
        successfulRequests++;
        return waitTime;
      }
      
      // Still no tokens after waiting (shouldn't happen normally)
      limitedRequests++;
      return waitTime;
    },
    
    getStats(): RateLimiterStats {
      refill();
      return {
        availableTokens: tokens,
        maxTokens,
        totalRequests,
        limitedRequests,
        successfulRequests,
        lastRefillTime
      };
    },
    
    reset(): void {
      tokens = maxTokens;
      lastRefillTime = Date.now();
      totalRequests = 0;
      limitedRequests = 0;
      successfulRequests = 0;
    },
    
    getWaitTime(): number {
      refill();
      return calculateWaitTime();
    }
  };
}

// =============================================================================
// Rate Limiter Registry
// =============================================================================

/**
 * Global registry for rate limiters.
 * Ensures consistent rate limiting across the application.
 */
class RateLimiterRegistry {
  private limiters: Map<string, RateLimiter> = new Map();
  
  /**
   * Get or create a rate limiter by name.
   * Uses pre-configured limits for known APIs.
   */
  getOrCreate(name: string, config?: Partial<RateLimiterConfig>): RateLimiter {
    if (!this.limiters.has(name)) {
      // Use pre-configured limits if available
      const baseConfig = API_RATE_LIMITS[name] || API_RATE_LIMITS['default'];
      const finalConfig = { ...baseConfig, ...config, name };
      this.limiters.set(name, createRateLimiter(finalConfig));
    }
    return this.limiters.get(name)!;
  }
  
  /**
   * Get a rate limiter by name.
   */
  get(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }
  
  /**
   * Get all rate limiter stats.
   */
  getAllStats(): Record<string, RateLimiterStats> {
    const stats: Record<string, RateLimiterStats> = {};
    this.limiters.forEach((limiter, name) => {
      stats[name] = limiter.getStats();
    });
    return stats;
  }
  
  /**
   * Reset all rate limiters.
   */
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset());
  }
}

export const rateLimiterRegistry = new RateLimiterRegistry();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Execute a function with rate limiting using the global registry.
 * 
 * @example
 * const data = await withRateLimit('reddit', async () => {
 *   return fetch('https://reddit.com/search.json');
 * });
 */
export async function withRateLimit<R>(
  name: string,
  fn: () => Promise<R>,
  config?: Partial<RateLimiterConfig>
): Promise<R> {
  const limiter = rateLimiterRegistry.getOrCreate(name, config);
  await limiter.acquire();
  return fn();
}

/**
 * Try to execute a function with rate limiting.
 * Returns null if rate limited instead of waiting.
 */
export function tryWithRateLimit<R>(
  name: string,
  fn: () => R,
  config?: Partial<RateLimiterConfig>
): R | null {
  const limiter = rateLimiterRegistry.getOrCreate(name, config);
  if (limiter.tryAcquire()) {
    return fn();
  }
  return null;
}

/**
 * Get rate limiter stats for a named limiter.
 */
export function getRateLimiterStats(name: string): RateLimiterStats | undefined {
  return rateLimiterRegistry.get(name)?.getStats();
}

/**
 * Get all rate limiter stats.
 */
export function getAllRateLimiterStats(): Record<string, RateLimiterStats> {
  return rateLimiterRegistry.getAllStats();
}
