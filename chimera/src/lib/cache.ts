/**
 * Caching Layer
 * 
 * LRU cache for analysis results with content-based keys.
 * Dramatically improves performance for repeated analysis of same content.
 * 
 * @module cache
 */

// =============================================================================
// Types
// =============================================================================

export interface CacheConfig {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Default TTL in seconds (default: 3600 = 1 hour) */
  defaultTtlSeconds?: number;
  /** Whether to track statistics (default: true) */
  trackStats?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
  createdAt: number;
}

// =============================================================================
// Content Hash
// =============================================================================

/**
 * Generate a fast hash for content-based cache keys.
 * Uses first 1000 chars + length for uniqueness without full content hashing.
 */
export function generateContentHash(content: string): string {
  const sample = content.slice(0, 1000);
  const length = content.length;
  
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) + hash) + sample.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Include length in hash to differentiate similar prefixes
  hash = ((hash << 5) + hash) + length;
  hash = hash & hash;
  
  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0') + '_' + length;
}

// =============================================================================
// LRU Cache Implementation
// =============================================================================

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTtlSeconds: number;
  private trackStats: boolean;
  
  // Statistics
  private _hits: number = 0;
  private _misses: number = 0;
  private _evictions: number = 0;
  
  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize ?? 1000;
    this.defaultTtlSeconds = config.defaultTtlSeconds ?? 3600;
    this.trackStats = config.trackStats ?? true;
  }
  
  /**
   * Get a value from cache.
   * Returns null if not found or expired.
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.trackStats) this._misses++;
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.trackStats) this._misses++;
      return null;
    }
    
    // Update access time for LRU
    entry.accessedAt = Date.now();
    
    // Move to end of Map (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    if (this.trackStats) this._hits++;
    return entry.value;
  }
  
  /**
   * Set a value in cache with optional TTL.
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const now = Date.now();
    
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict if at capacity
    while (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      value,
      expiresAt: now + ttl * 1000,
      accessedAt: now,
      createdAt: now
    });
  }
  
  /**
   * Check if key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete a key from cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }
  
  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      size: this.cache.size,
      hitRate: total > 0 ? this._hits / total : 0
    };
  }
  
  /**
   * Evict the oldest (least recently used) entry.
   */
  private evictOldest(): void {
    // Map maintains insertion order, first entry is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      if (this.trackStats) this._evictions++;
    }
  }
  
  /**
   * Prune expired entries.
   * Call periodically to clean up memory.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    
    return pruned;
  }
  
  /**
   * Get all keys (for debugging).
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Get current size.
   */
  get size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// Analysis Cache
// =============================================================================

export interface AnalysisCacheConfig extends CacheConfig {
  /** Namespace for cache keys */
  namespace?: string;
}

/**
 * Specialized cache for content analysis results.
 * Uses content hashing for automatic key generation.
 */
export class AnalysisCache<T> {
  private cache: LRUCache<T>;
  private namespace: string;
  
  constructor(config: AnalysisCacheConfig = {}) {
    this.cache = new LRUCache<T>(config);
    this.namespace = config.namespace ?? 'analysis';
  }
  
  /**
   * Get cached analysis result for content.
   */
  getForContent(content: string): T | null {
    const key = this.generateKey(content);
    return this.cache.get(key);
  }
  
  /**
   * Cache analysis result for content.
   */
  setForContent(content: string, result: T, ttlSeconds?: number): void {
    const key = this.generateKey(content);
    this.cache.set(key, result, ttlSeconds);
  }
  
  /**
   * Get or compute analysis result.
   * If cached, returns cached value. Otherwise, computes and caches.
   */
  getOrCompute(content: string, compute: () => T, ttlSeconds?: number): T {
    const cached = this.getForContent(content);
    if (cached !== null) return cached;
    
    const result = compute();
    this.setForContent(content, result, ttlSeconds);
    return result;
  }
  
  /**
   * Async version of getOrCompute.
   */
  async getOrComputeAsync(
    content: string,
    compute: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.getForContent(content);
    if (cached !== null) return cached;
    
    const result = await compute();
    this.setForContent(content, result, ttlSeconds);
    return result;
  }
  
  /**
   * Generate cache key from content.
   */
  private generateKey(content: string): string {
    return `${this.namespace}:${generateContentHash(content)}`;
  }
  
  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }
  
  /**
   * Clear cache.
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Prune expired entries.
   */
  prune(): number {
    return this.cache.prune();
  }
}

// =============================================================================
// Global Cache Instances
// =============================================================================

let factDensityCache: AnalysisCache<unknown> | null = null;
let schemaCache: AnalysisCache<unknown> | null = null;
let informationGainCache: AnalysisCache<unknown> | null = null;

/**
 * Get the global fact density cache.
 */
export function getFactDensityCache(): AnalysisCache<unknown> {
  if (!factDensityCache) {
    factDensityCache = new AnalysisCache({ namespace: 'factDensity', maxSize: 500 });
  }
  return factDensityCache;
}

/**
 * Get the global schema cache.
 */
export function getSchemaCache(): AnalysisCache<unknown> {
  if (!schemaCache) {
    schemaCache = new AnalysisCache({ namespace: 'schema', maxSize: 500 });
  }
  return schemaCache;
}

/**
 * Get the global information gain cache.
 */
export function getInformationGainCache(): AnalysisCache<unknown> {
  if (!informationGainCache) {
    informationGainCache = new AnalysisCache({ namespace: 'infoGain', maxSize: 500 });
  }
  return informationGainCache;
}

/**
 * Get combined statistics for all global caches.
 */
export function getGlobalCacheStats(): Record<string, CacheStats> {
  return {
    factDensity: getFactDensityCache().getStats(),
    schema: getSchemaCache().getStats(),
    informationGain: getInformationGainCache().getStats()
  };
}

/**
 * Clear all global caches.
 */
export function clearAllCaches(): void {
  factDensityCache?.clear();
  schemaCache?.clear();
  informationGainCache?.clear();
}

// =============================================================================
// Decorator for Cached Functions
// =============================================================================

/**
 * Create a cached version of an analysis function.
 * 
 * @example
 * const cachedAnalyze = createCachedAnalyzer(analyze, 'factDensity');
 * const result = cachedAnalyze(content); // Uses cache
 */
export function createCachedAnalyzer<T>(
  analyzer: (content: string) => T,
  namespace: string,
  config?: CacheConfig
): (content: string) => T {
  const cache = new AnalysisCache<T>({ ...config, namespace });
  
  return (content: string): T => {
    return cache.getOrCompute(content, () => analyzer(content));
  };
}

/**
 * Create a cached version of an async analysis function.
 */
export function createCachedAsyncAnalyzer<T>(
  analyzer: (content: string) => Promise<T>,
  namespace: string,
  config?: CacheConfig
): (content: string) => Promise<T> {
  const cache = new AnalysisCache<T>({ ...config, namespace });
  
  return (content: string): Promise<T> => {
    return cache.getOrComputeAsync(content, () => analyzer(content));
  };
}
