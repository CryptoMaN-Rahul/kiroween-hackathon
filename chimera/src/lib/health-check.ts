/**
 * Health Check System
 * 
 * Production-grade health checking for external dependencies.
 * Provides status of all external APIs and services.
 * 
 * @module health-check
 */

import { circuitBreakerRegistry, type CircuitBreakerStats } from './circuit-breaker';

// =============================================================================
// Types
// =============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  lastChecked: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  dependencies: DependencyHealth[];
  circuitBreakers: Record<string, CircuitBreakerStats>;
  uptime: number;
  version: string;
}

export interface HealthCheckConfig {
  /** Timeout for health checks in ms (default: 5000) */
  timeoutMs?: number;
  /** Whether to include detailed circuit breaker stats (default: true) */
  includeCircuitBreakers?: boolean;
  /** Custom health check functions */
  customChecks?: Array<{
    name: string;
    check: () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;
  }>;
}

// =============================================================================
// Built-in Health Checks
// =============================================================================

/**
 * Check Reddit API health
 */
async function checkRedditHealth(timeoutMs: number): Promise<DependencyHealth> {
  const startTime = performance.now();
  const name = 'reddit-api';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Use a lightweight endpoint to check connectivity
    const response = await fetch('https://www.reddit.com/api/v1/me.json', {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Chimera-GEO-SDK/2.0 (Health Check)'
      }
    });
    
    clearTimeout(timeoutId);
    const latencyMs = performance.now() - startTime;
    
    // Reddit returns 401 for unauthenticated requests, but that means API is up
    if (response.status === 401 || response.ok) {
      return {
        name,
        status: 'healthy',
        latencyMs,
        lastChecked: new Date()
      };
    }
    
    return {
      name,
      status: response.status >= 500 ? 'unhealthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: performance.now() - startTime,
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check Hacker News API health
 */
async function checkHackerNewsHealth(timeoutMs: number): Promise<DependencyHealth> {
  const startTime = performance.now();
  const name = 'hackernews-api';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Use a lightweight endpoint
    const response = await fetch('https://hn.algolia.com/api/v1/search?query=test&hitsPerPage=1', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Chimera-GEO-SDK/2.0 (Health Check)'
      }
    });
    
    clearTimeout(timeoutId);
    const latencyMs = performance.now() - startTime;
    
    if (response.ok) {
      return {
        name,
        status: 'healthy',
        latencyMs,
        lastChecked: new Date()
      };
    }
    
    return {
      name,
      status: response.status >= 500 ? 'unhealthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: performance.now() - startTime,
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check Open PageRank API health
 */
async function checkOpenPageRankHealth(timeoutMs: number): Promise<DependencyHealth> {
  const startTime = performance.now();
  const name = 'openpagerank-api';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Use a test domain
    const response = await fetch('https://openpagerank.com/api/v1.0/getPageRank?domains[0]=google.com', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    const latencyMs = performance.now() - startTime;
    
    if (response.ok) {
      return {
        name,
        status: 'healthy',
        latencyMs,
        lastChecked: new Date()
      };
    }
    
    // Rate limited is degraded, not unhealthy
    if (response.status === 429) {
      return {
        name,
        status: 'degraded',
        latencyMs,
        lastChecked: new Date(),
        error: 'Rate limited'
      };
    }
    
    return {
      name,
      status: response.status >= 500 ? 'unhealthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: performance.now() - startTime,
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// =============================================================================
// Health Check Service
// =============================================================================

export interface HealthCheckService {
  /** Run all health checks */
  check(): Promise<SystemHealth>;
  /** Run a specific health check */
  checkDependency(name: string): Promise<DependencyHealth | null>;
  /** Get cached health status (from last check) */
  getCached(): SystemHealth | null;
  /** Add a custom health check */
  addCheck(name: string, check: () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>): void;
}

const SDK_VERSION = '2.0.0';
const startTime = Date.now();

/**
 * Create a health check service
 */
export function createHealthCheckService(config: HealthCheckConfig = {}): HealthCheckService {
  const { timeoutMs = 5000, includeCircuitBreakers = true } = config;
  
  let cachedHealth: SystemHealth | null = null;
  
  const customChecks = new Map<string, () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>>();
  
  // Add any custom checks from config
  if (config.customChecks) {
    for (const { name, check } of config.customChecks) {
      customChecks.set(name, check);
    }
  }
  
  async function runCustomCheck(name: string, check: () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>): Promise<DependencyHealth> {
    const startTime = performance.now();
    try {
      const result = await check();
      return {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        latencyMs: result.latencyMs ?? (performance.now() - startTime),
        lastChecked: new Date(),
        error: result.error
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        latencyMs: performance.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  function determineOverallStatus(dependencies: DependencyHealth[]): HealthStatus {
    const unhealthyCount = dependencies.filter(d => d.status === 'unhealthy').length;
    const degradedCount = dependencies.filter(d => d.status === 'degraded').length;
    
    if (unhealthyCount === dependencies.length) return 'unhealthy';
    if (unhealthyCount > 0) return 'degraded';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }
  
  return {
    async check(): Promise<SystemHealth> {
      // Run all built-in checks in parallel
      const builtInChecks = await Promise.all([
        checkRedditHealth(timeoutMs),
        checkHackerNewsHealth(timeoutMs),
        checkOpenPageRankHealth(timeoutMs)
      ]);
      
      // Run custom checks
      const customCheckResults: DependencyHealth[] = [];
      for (const entry of Array.from(customChecks.entries())) {
        customCheckResults.push(await runCustomCheck(entry[0], entry[1]));
      }
      
      const dependencies = [...builtInChecks, ...customCheckResults];
      
      const health: SystemHealth = {
        status: determineOverallStatus(dependencies),
        timestamp: new Date(),
        dependencies,
        circuitBreakers: includeCircuitBreakers ? circuitBreakerRegistry.getAllStats() : {},
        uptime: Date.now() - startTime,
        version: SDK_VERSION
      };
      
      cachedHealth = health;
      return health;
    },
    
    async checkDependency(name: string): Promise<DependencyHealth | null> {
      switch (name) {
        case 'reddit-api':
          return checkRedditHealth(timeoutMs);
        case 'hackernews-api':
          return checkHackerNewsHealth(timeoutMs);
        case 'openpagerank-api':
          return checkOpenPageRankHealth(timeoutMs);
        default:
          const customCheck = customChecks.get(name);
          if (customCheck) {
            return runCustomCheck(name, customCheck);
          }
          return null;
      }
    },
    
    getCached(): SystemHealth | null {
      return cachedHealth;
    },
    
    addCheck(name: string, check: () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>): void {
      customChecks.set(name, check);
    }
  };
}

// =============================================================================
// Convenience Export
// =============================================================================

let defaultService: HealthCheckService | null = null;

/**
 * Get system health using the default service
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  if (!defaultService) {
    defaultService = createHealthCheckService();
  }
  return defaultService.check();
}

/**
 * Get cached system health (from last check)
 */
export function getCachedHealth(): SystemHealth | null {
  return defaultService?.getCached() ?? null;
}
