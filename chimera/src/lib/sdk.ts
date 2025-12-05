/**
 * Chimera GEO SDK v2.0
 * 
 * Unified entry point for all GEO optimization modules.
 * Production-grade SDK for AI-first website optimization.
 * 
 * @module sdk
 */

import { createSymbioteRouter, type SymbioteRouter } from './symbiote-router';
import { analyze as analyzeFactDensity, calculateInformationGain, scoreInvertedPyramid, detectFluff } from './fact-density-analyzer';
import { generateFromContent, addEEATSignals, validateRoundTrip, type EEATSignals } from './schema-generator';
import { createFreshnessMonitor, analyzeFreshness, type FreshnessConfig, type FreshnessMetrics } from './freshness-monitor';
import { createContentTransformer, detectListicleSuitability, type TransformFormat } from './content-transformer';
import { createEngineOptimizer, type AIEngine } from './engine-optimizer';
import { detectAgentFromUserAgent } from './agent-detector';
import { calculateGEOScore, createCitationMonitor, type CitationMonitor } from './citation-monitor';
import { createRouteDiscoveryManager, type RouteDiscoveryConfig, type RouteDiscoveryManager } from './route-discovery';
import { type PersistenceConfig } from './persistence';
import { createDomainAuthorityService, type DomainAuthorityService } from './domain-authority';
import { createCitationDiscoveryService, type CitationDiscoveryService, type DiscoveryConfig } from './citation-discovery';
import { AnalysisCache, getGlobalCacheStats, clearAllCaches } from './cache';
import { createEventSystem, type EventSystem, type WebhookConfig } from './event-system';
import { createHealthCheckService, type HealthCheckService } from './health-check';
import type { FactDensityResult, GeneratedSchema } from '@/types';
import type { InformationGainResult, InvertedPyramidResult, FluffDetectionResult } from './fact-density-analyzer';
import type { ListicleSuitability, TransformationResult } from './content-transformer';

// =============================================================================
// Configuration Validation
// =============================================================================

export interface ConfigValidationError {
  path: string;
  message: string;
  value: unknown;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: string[];
}

/**
 * Validate SDK configuration.
 * Returns validation result with errors and warnings.
 */
export function validateConfig(config: ChimeraSDKConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: string[] = [];

  // Validate fuzzy config
  if (config.fuzzy) {
    if (config.fuzzy.threshold !== undefined) {
      if (typeof config.fuzzy.threshold !== 'number') {
        errors.push({
          path: 'fuzzy.threshold',
          message: 'threshold must be a number',
          value: config.fuzzy.threshold
        });
      } else if (config.fuzzy.threshold < 0 || config.fuzzy.threshold > 1) {
        errors.push({
          path: 'fuzzy.threshold',
          message: 'threshold must be between 0 and 1',
          value: config.fuzzy.threshold
        });
      } else if (config.fuzzy.threshold < 0.3) {
        warnings.push('fuzzy.threshold below 0.3 may result in many false positive matches');
      } else if (config.fuzzy.threshold > 0.9) {
        warnings.push('fuzzy.threshold above 0.9 may miss valid fuzzy matches');
      }
    }

    if (config.fuzzy.weights) {
      const totalWeight = Object.values(config.fuzzy.weights).reduce((sum, w) => sum + w, 0);
      if (Math.abs(totalWeight - 1) > 0.01) {
        warnings.push(`fuzzy.weights should sum to 1.0 (current: ${totalWeight.toFixed(2)})`);
      }
      for (const [algo, weight] of Object.entries(config.fuzzy.weights)) {
        if (weight < 0 || weight > 1) {
          errors.push({
            path: `fuzzy.weights.${algo}`,
            message: 'weight must be between 0 and 1',
            value: weight
          });
        }
      }
    }

    if (config.fuzzy.algorithms) {
      const validAlgorithms = ['levenshtein', 'jaroWinkler', 'nGram', 'soundex', 'cosine'];
      for (const algo of config.fuzzy.algorithms) {
        if (!validAlgorithms.includes(algo)) {
          errors.push({
            path: 'fuzzy.algorithms',
            message: `unknown algorithm: ${algo}. Valid: ${validAlgorithms.join(', ')}`,
            value: algo
          });
        }
      }
    }
  }

  // Validate router config
  if (config.router) {
    if (config.router.confidenceThreshold !== undefined) {
      if (typeof config.router.confidenceThreshold !== 'number') {
        errors.push({
          path: 'router.confidenceThreshold',
          message: 'confidenceThreshold must be a number',
          value: config.router.confidenceThreshold
        });
      } else if (config.router.confidenceThreshold < 0 || config.router.confidenceThreshold > 1) {
        errors.push({
          path: 'router.confidenceThreshold',
          message: 'confidenceThreshold must be between 0 and 1',
          value: config.router.confidenceThreshold
        });
      }
    }

    if (config.router.aliasThreshold !== undefined) {
      if (typeof config.router.aliasThreshold !== 'number' || config.router.aliasThreshold < 1) {
        errors.push({
          path: 'router.aliasThreshold',
          message: 'aliasThreshold must be a positive integer',
          value: config.router.aliasThreshold
        });
      }
    }
  }

  // Validate freshness config
  if (config.freshness) {
    if (config.freshness.staleThresholdDays !== undefined) {
      if (typeof config.freshness.staleThresholdDays !== 'number' || config.freshness.staleThresholdDays < 1) {
        errors.push({
          path: 'freshness.staleThresholdDays',
          message: 'staleThresholdDays must be a positive number',
          value: config.freshness.staleThresholdDays
        });
      }
    }
  }

  // Validate events config
  if (config.events) {
    if (config.events.maxHistorySize !== undefined) {
      if (typeof config.events.maxHistorySize !== 'number' || config.events.maxHistorySize < 0) {
        errors.push({
          path: 'events.maxHistorySize',
          message: 'maxHistorySize must be a non-negative number',
          value: config.events.maxHistorySize
        });
      }
    }

    if (config.events.webhooks) {
      for (let i = 0; i < config.events.webhooks.length; i++) {
        const webhook = config.events.webhooks[i];
        if (!webhook.url) {
          errors.push({
            path: `events.webhooks[${i}].url`,
            message: 'webhook url is required',
            value: webhook.url
          });
        } else {
          try {
            new URL(webhook.url);
          } catch {
            errors.push({
              path: `events.webhooks[${i}].url`,
              message: 'webhook url must be a valid URL',
              value: webhook.url
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Configuration presets for common use cases.
 */
export const CONFIG_PRESETS: Record<string, ChimeraSDKConfig> = {
  /** Strict matching - fewer false positives, may miss some valid matches */
  strict: {
    fuzzy: {
      threshold: 0.8,
      algorithms: ['levenshtein', 'jaroWinkler', 'cosine']
    },
    router: {
      confidenceThreshold: 0.8
    }
  },
  /** Balanced - good default for most sites */
  balanced: {
    fuzzy: {
      threshold: 0.6,
      algorithms: ['levenshtein', 'jaroWinkler', 'nGram', 'cosine']
    },
    router: {
      confidenceThreshold: 0.6
    }
  },
  /** Lenient - more matches, may have some false positives */
  lenient: {
    fuzzy: {
      threshold: 0.4,
      algorithms: ['levenshtein', 'jaroWinkler', 'nGram', 'soundex', 'cosine']
    },
    router: {
      confidenceThreshold: 0.5
    }
  },
  /** E-commerce optimized */
  ecommerce: {
    fuzzy: {
      threshold: 0.6,
      algorithms: ['levenshtein', 'jaroWinkler', 'nGram']
    },
    router: {
      confidenceThreshold: 0.65,
      enableLearning: true,
      aliasThreshold: 2
    },
    schema: {
      includeEEAT: true,
      validateOnGenerate: true
    }
  },
  /** Blog/content site optimized */
  blog: {
    fuzzy: {
      threshold: 0.55,
      algorithms: ['levenshtein', 'jaroWinkler', 'cosine']
    },
    router: {
      confidenceThreshold: 0.6
    },
    schema: {
      includeEEAT: true
    },
    analysis: {
      informationGain: true,
      invertedPyramid: { targetWords: 75 }
    }
  },
  /** SaaS landing page optimized */
  saas: {
    fuzzy: {
      threshold: 0.7,
      algorithms: ['levenshtein', 'jaroWinkler']
    },
    router: {
      confidenceThreshold: 0.7
    },
    schema: {
      includeEEAT: true,
      validateOnGenerate: true
    }
  }
};

export type ConfigPreset = 'strict' | 'balanced' | 'lenient' | 'ecommerce' | 'blog' | 'saas';

// =============================================================================
// SDK Types
// =============================================================================

export interface ChimeraSDKConfig {
  fuzzy?: {
    algorithms?: ('levenshtein' | 'jaroWinkler' | 'nGram' | 'soundex' | 'cosine')[];
    weights?: Record<string, number>;
    threshold?: number;
  };
  analysis?: {
    informationGain?: boolean;
    invertedPyramid?: { targetWords?: number };
    /** Enable caching for analysis results (default: true) */
    enableCache?: boolean;
  };
  schema?: {
    includeEEAT?: boolean;
    validateOnGenerate?: boolean;
  };
  freshness?: FreshnessConfig;
  router?: {
    confidenceThreshold?: number;
    enableLearning?: boolean;
    aliasThreshold?: number;
  };
  brandDomains?: string[];
  /** Route discovery configuration */
  routeDiscovery?: RouteDiscoveryConfig;
  /** Persistence configuration */
  persistence?: PersistenceConfig;
  /** Citation discovery configuration */
  citationDiscovery?: DiscoveryConfig;
  /** Event system configuration */
  events?: {
    /** Enable debug logging for events */
    debug?: boolean;
    /** Maximum events to keep in history */
    maxHistorySize?: number;
    /** Webhook endpoints to dispatch events to */
    webhooks?: WebhookConfig[];
  };
  /** Health check configuration */
  healthCheck?: {
    /** Timeout for health checks in ms */
    timeoutMs?: number;
  };
  /** Debug mode configuration */
  debug?: {
    /** Enable verbose logging */
    enabled?: boolean;
    /** Log algorithm scores during matching */
    logAlgorithmScores?: boolean;
    /** Log entity detection reasoning */
    logEntityDetection?: boolean;
    /** Log performance timings */
    logPerformance?: boolean;
  };
}

export interface PageAnalysisResult {
  url: string;
  factDensity: FactDensityResult;
  informationGain: InformationGainResult;
  invertedPyramid: InvertedPyramidResult;
  schema: GeneratedSchema | null;
  freshness: FreshnessMetrics | null;
  listicleSuitability: ListicleSuitability;
  fluffScore: number;
  fluffPhrases: string[];
  processingTimeMs: number;
}

export interface GEOHealthComponents {
  routeHealth: number;
  contentScannability: number;
  schemaCoverage: number;
  citationAuthority: number;
}

export interface GEOHealthScore {
  overall: number;
  components: GEOHealthComponents;
  recommendations: string[];
  calculatedAt: Date;
}

export type SDKEvent = 
  | { type: 'route_resolved'; path: string; matched: string | null; confidence: number; latencyMs: number }
  | { type: 'analysis_complete'; url: string; score: number; processingTimeMs: number }
  | { type: 'schema_generated'; url: string; entityTypes: string[] }
  | { type: 'error'; operation: string; error: string };

export type EventHandler = (event: SDKEvent) => void;

// =============================================================================
// SDK Implementation
// =============================================================================

export class ChimeraSDK {
  private config: ChimeraSDKConfig;
  private _router: SymbioteRouter;
  private _freshnessMonitor: ReturnType<typeof createFreshnessMonitor>;
  private _contentTransformer: ReturnType<typeof createContentTransformer>;
  private _engineOptimizer: ReturnType<typeof createEngineOptimizer>;
  private _citationMonitor: CitationMonitor;
  private _routeDiscovery: RouteDiscoveryManager | null = null;
  private _domainAuthority: DomainAuthorityService | null = null;
  private _citationDiscovery: CitationDiscoveryService | null = null;
  private _analysisCache: AnalysisCache<PageAnalysisResult> | null = null;
  private _eventSystem: EventSystem;
  private _healthCheck: HealthCheckService;
  private eventHandlers: EventHandler[] = [];
  private _performanceMetrics: Map<string, number[]> = new Map();

  /**
   * Debug logger - only logs when debug mode is enabled.
   */
  private debugLog(category: string, message: string, data?: unknown): void {
    if (!this.config.debug?.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[ChimeraSDK:${category}] ${timestamp}`;
    
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  /**
   * Track performance timing for an operation.
   */
  private trackPerformance(operation: string, durationMs: number): void {
    if (!this.config.debug?.logPerformance) return;
    
    if (!this._performanceMetrics.has(operation)) {
      this._performanceMetrics.set(operation, []);
    }
    
    const metrics = this._performanceMetrics.get(operation)!;
    metrics.push(durationMs);
    
    // Keep last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    this.debugLog('perf', `${operation}: ${durationMs.toFixed(2)}ms`);
  }

  constructor(config: ChimeraSDKConfig = {}) {
    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
      throw new Error(`Invalid SDK configuration: ${errorMessages}`);
    }
    
    // Log warnings
    for (const warning of validation.warnings) {
      console.warn(`[ChimeraSDK] Config warning: ${warning}`);
    }
    
    this.config = config;
    this._router = createSymbioteRouter(config.router);
    this._freshnessMonitor = createFreshnessMonitor(config.freshness);
    this._contentTransformer = createContentTransformer();
    this._engineOptimizer = createEngineOptimizer();
    this._citationMonitor = createCitationMonitor({ 
      brandTerms: config.brandDomains || [], 
      scanIntervalHours: 24 
    });
    
    // Initialize optional services based on config
    if (config.routeDiscovery) {
      this._routeDiscovery = createRouteDiscoveryManager(config.routeDiscovery);
    }
    
    if (config.citationDiscovery) {
      this._citationDiscovery = createCitationDiscoveryService(config.citationDiscovery);
    }
    
    // Initialize analysis cache if enabled (default: true)
    if (config.analysis?.enableCache !== false) {
      this._analysisCache = new AnalysisCache<PageAnalysisResult>({ 
        namespace: 'pageAnalysis',
        maxSize: 500,
        defaultTtlSeconds: 3600 // 1 hour
      });
    }
    
    // Initialize event system
    this._eventSystem = createEventSystem({
      debug: config.events?.debug,
      maxHistorySize: config.events?.maxHistorySize
    });
    
    // Register webhooks if configured
    if (config.events?.webhooks) {
      for (const webhook of config.events.webhooks) {
        this._eventSystem.webhooks.addWebhook(webhook);
      }
    }
    
    // Initialize health check service
    this._healthCheck = createHealthCheckService({
      timeoutMs: config.healthCheck?.timeoutMs
    });
  }

  private emit(event: SDKEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('[ChimeraSDK] Event handler error:', e);
      }
    }
  }

  // Router module
  get router() {
    return {
      resolve: (path: string, validRoutes?: string[]) => {
        const startTime = performance.now();
        if (validRoutes) {
          this._router.loadRoutes(validRoutes);
        }
        const result = this._router.processRequest(path);
        const latencyMs = performance.now() - startTime;
        
        this.emit({
          type: 'route_resolved',
          path,
          matched: result.shouldRedirect ? result.redirectPath : null,
          confidence: result.match.confidence,
          latencyMs
        });
        
        return result;
      },
      setRoutes: (routes: string[]) => {
        this._router.loadRoutes(routes);
      },
      addAlias: (from: string, to: string) => {
        this._router.addAlias(from, to);
      },
      getMetrics: () => {
        return this._router.getRouterMetrics();
      },
      getSuggestions: (path: string, limit?: number) => {
        return this._router.getSuggestions(path, limit);
      }
    };
  }

  // Analysis module
  get analyzer() {
    return {
      factDensity: (content: string): FactDensityResult => analyzeFactDensity(content),
      informationGain: (content: string): InformationGainResult => calculateInformationGain(content),
      invertedPyramid: (content: string): InvertedPyramidResult => scoreInvertedPyramid(content),
      fluff: (content: string): FluffDetectionResult => detectFluff(content),
      listicle: (content: string): ListicleSuitability => detectListicleSuitability(content),
      
      /** Run all analyzers on content */
      full: (content: string) => ({
        factDensity: analyzeFactDensity(content),
        informationGain: calculateInformationGain(content),
        invertedPyramid: scoreInvertedPyramid(content),
        fluff: detectFluff(content),
        listicle: detectListicleSuitability(content)
      })
    };
  }

  // Schema module
  get schema() {
    return {
      generate: (content: string, options?: { url?: string }): GeneratedSchema => {
        const schema = generateFromContent(content, options?.url || '');
        
        if (this.config.schema?.validateOnGenerate) {
          const isValid = validateRoundTrip(schema);
          if (!isValid) {
            this.emit({ type: 'error', operation: 'schema_generate', error: 'Round-trip validation failed' });
          }
        }
        
        this.emit({
          type: 'schema_generated',
          url: options?.url || '',
          entityTypes: schema['@graph'].map(e => e['@type'] as string)
        });
        
        return schema;
      },
      addEEAT: (schema: GeneratedSchema, signals: EEATSignals) => addEEATSignals(schema, signals),
      validate: (schema: GeneratedSchema) => validateRoundTrip(schema)
    };
  }

  // Freshness module
  get freshness() {
    const monitor = this._freshnessMonitor;
    return {
      analyze: (path: string, lastModified: Date) => monitor.analyze(path, lastModified),
      recordUpdate: (path: string, date?: Date) => monitor.recordUpdate(path, date),
      getVelocity: (path: string) => monitor.getVelocity(path),
      getStalePages: (pages: Array<{ path: string; lastModified: Date }>) => monitor.getStalePages(pages),
      getConfig: () => monitor.getConfig()
    };
  }

  // Content transformer module
  get transformer() {
    const transformer = this._contentTransformer;
    return {
      detect: (content: string) => transformer.detectSuitability(content),
      toRoundup: (content: string) => transformer.toRoundup(content),
      toComparison: (content: string) => transformer.toComparisonTable(content),
      toTopN: (content: string, n: number) => transformer.toTopN(content, n),
      transform: (content: string, format?: TransformFormat): TransformationResult => 
        transformer.transform(content, format)
    };
  }

  // Engine optimizer module
  get optimizer() {
    const optimizer = this._engineOptimizer;
    return {
      getConfig: (engine: AIEngine) => optimizer.getConfig(engine),
      getSupportedEngines: () => optimizer.getSupportedEngines(),
      generateSubQueries: (query: string, engine: AIEngine) => optimizer.generateSubQueries(query, engine),
      calculateOverlap: (results1: string[], results2: string[]) => optimizer.calculateDomainOverlap(results1, results2),
      getRecommendations: (engine: AIEngine, metrics: { hasEarnedMedia: boolean; isListicle: boolean; ageInDays: number }) =>
        optimizer.getRecommendations(engine, metrics)
    };
  }

  // Agent detection
  get agent() {
    return {
      detect: (userAgent: string) => detectAgentFromUserAgent(userAgent)
    };
  }

  // Citations module
  get citations() {
    const monitor = this._citationMonitor;
    return {
      ...monitor,
      // Expose isEarnedMedia as a convenience method
      isEarnedMedia: (domain: string, brandDomains: string[]) => {
        const normalizedDomain = domain.toLowerCase();
        return !brandDomains.some(bd => 
          normalizedDomain.includes(bd.toLowerCase()) || 
          normalizedDomain === bd.toLowerCase()
        );
      }
    };
  }

  // Route discovery module (production-grade)
  get routeDiscovery() {
    if (!this._routeDiscovery) {
      // Create with default config if not configured
      this._routeDiscovery = createRouteDiscoveryManager(this.config.routeDiscovery || {});
    }
    return {
      discover: () => this._routeDiscovery!.discover(),
      getCached: () => this._routeDiscovery!.getCached(),
      refresh: () => this._routeDiscovery!.refresh(),
      hasRoute: (path: string) => this._routeDiscovery!.hasRoute(path),
      getManifest: () => this._routeDiscovery!.getManifest(),
      clearCache: () => this._routeDiscovery!.clearCache()
    };
  }

  // Domain authority service (real API integration)
  get domainAuthority() {
    if (!this._domainAuthority) {
      this._domainAuthority = createDomainAuthorityService();
    }
    return {
      getScore: (domain: string) => this._domainAuthority!.getScore(domain),
      getBatchScores: (domains: string[]) => this._domainAuthority!.getBatchScores(domains),
      getCacheStats: () => this._domainAuthority!.getCacheStats(),
      clearCache: () => this._domainAuthority!.clearCache()
    };
  }

  // Citation discovery service (real API integration)
  get citationDiscovery() {
    if (!this._citationDiscovery && this.config.citationDiscovery) {
      this._citationDiscovery = createCitationDiscoveryService(this.config.citationDiscovery);
    }
    if (!this._citationDiscovery) {
      throw new Error('Citation discovery not configured. Pass citationDiscovery config to SDK.');
    }
    return {
      discover: () => this._citationDiscovery!.discover(),
      searchReddit: (query: string) => this._citationDiscovery!.searchSource('reddit', query),
      searchHackerNews: (query: string) => this._citationDiscovery!.searchSource('hackernews', query),
      getStats: () => this._citationDiscovery!.getStats()
    };
  }

  // Cache management
  get cache() {
    return {
      getStats: () => getGlobalCacheStats(),
      clear: () => clearAllCaches(),
      getAnalysisCacheStats: () => this._analysisCache?.getStats() || null
    };
  }

  // Event system (production-grade)
  get events() {
    const eventSystem = this._eventSystem;
    return {
      /** Subscribe to a specific event type */
      on: eventSystem.emitter.on.bind(eventSystem.emitter),
      /** Subscribe to all events */
      onAny: eventSystem.emitter.onAny.bind(eventSystem.emitter),
      /** Get event history */
      getHistory: eventSystem.emitter.getHistory.bind(eventSystem.emitter),
      /** Get event statistics */
      getStats: eventSystem.emitter.getStats.bind(eventSystem.emitter),
      /** Add a webhook endpoint */
      addWebhook: eventSystem.webhooks.addWebhook.bind(eventSystem.webhooks),
      /** Remove a webhook */
      removeWebhook: eventSystem.webhooks.removeWebhook.bind(eventSystem.webhooks),
      /** Get webhook statistics */
      getWebhookStats: eventSystem.webhooks.getStats.bind(eventSystem.webhooks),
      /** Get all configured webhooks */
      getWebhooks: eventSystem.webhooks.getWebhooks.bind(eventSystem.webhooks)
    };
  }

  // Health check system (production-grade)
  get health() {
    const healthCheck = this._healthCheck;
    return {
      /** Run all health checks */
      check: () => healthCheck.check(),
      /** Check a specific dependency */
      checkDependency: (name: string) => healthCheck.checkDependency(name),
      /** Get cached health status */
      getCached: () => healthCheck.getCached(),
      /** Add a custom health check */
      addCheck: healthCheck.addCheck.bind(healthCheck)
    };
  }

  // Legacy event handling (for backwards compatibility)
  on(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) this.eventHandlers.splice(index, 1);
    };
  }

  // Debug module
  get debug() {
    return {
      /** Check if debug mode is enabled */
      isEnabled: () => this.config.debug?.enabled ?? false,
      
      /** Enable debug mode at runtime */
      enable: () => {
        this.config.debug = { ...this.config.debug, enabled: true };
      },
      
      /** Disable debug mode at runtime */
      disable: () => {
        if (this.config.debug) {
          this.config.debug.enabled = false;
        }
      },
      
      /** Get performance metrics for all operations */
      getPerformanceMetrics: () => {
        const result: Record<string, { count: number; avg: number; min: number; max: number; p95: number }> = {};
        
        this._performanceMetrics.forEach((values, operation) => {
          if (values.length === 0) return;
          
          const sorted = [...values].sort((a, b) => a - b);
          const sum = values.reduce((a, b) => a + b, 0);
          const p95Index = Math.floor(sorted.length * 0.95);
          
          result[operation] = {
            count: values.length,
            avg: sum / values.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.min(p95Index, sorted.length - 1)]
          };
        });
        
        return result;
      },
      
      /** Clear performance metrics */
      clearMetrics: () => {
        this._performanceMetrics.clear();
      },
      
      /** Log current configuration */
      logConfig: () => {
        console.log('[ChimeraSDK:debug] Current configuration:', JSON.stringify(this.config, null, 2));
      },
      
      /** Get validation result for current config */
      validateConfig: () => validateConfig(this.config)
    };
  }

  /**
   * Analyze a single page with all modules.
   * 
   * Production-grade implementation with:
   * - Graceful degradation: each analysis step is wrapped in try-catch
   * - Partial results: returns whatever succeeded even if some steps fail
   * - Error tracking: emits error events for monitoring
   * - Performance tracking: measures each operation
   */
  analyzePage(options: { url: string; content: string; lastModified?: Date }): PageAnalysisResult {
    const startTime = performance.now();
    
    this.debugLog('analyze', `Starting analysis for ${options.url}`);
    
    // Default values for graceful degradation
    let factDensity: FactDensityResult = { 
      score: 0, 
      breakdown: { tables: 0, bulletLists: 0, statistics: 0, headers: 0, headerHierarchyValid: true, headerLevels: [] },
      suggestions: [],
      justificationLevel: 'low'
    };
    let informationGain: InformationGainResult = { score: 0, uniqueEntities: [], commodityPhrasePercentage: 0, commodityPhrases: [] };
    let invertedPyramid: InvertedPyramidResult = { score: 0, answerPosition: 0, isOptimal: false };
    let fluffResult: FluffDetectionResult = { score: 0, phrases: [] };
    let listicleSuitability: ListicleSuitability = { suitable: false, format: null, confidence: 0, reasons: [] };
    let schema: GeneratedSchema | null = null;
    let freshness: FreshnessMetrics | null = null;
    
    // Track individual operation times with error handling
    let opStart = performance.now();
    
    // Fact Density Analysis
    try {
      factDensity = analyzeFactDensity(options.content);
      this.trackPerformance('factDensity', performance.now() - opStart);
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.factDensity', error: String(e) });
      this.debugLog('error', `Fact density analysis failed for ${options.url}:`, e);
    }
    
    // Information Gain Analysis
    opStart = performance.now();
    try {
      informationGain = calculateInformationGain(options.content);
      this.trackPerformance('informationGain', performance.now() - opStart);
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.informationGain', error: String(e) });
      this.debugLog('error', `Information gain analysis failed for ${options.url}:`, e);
    }
    
    // Inverted Pyramid Analysis
    opStart = performance.now();
    try {
      invertedPyramid = scoreInvertedPyramid(options.content);
      this.trackPerformance('invertedPyramid', performance.now() - opStart);
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.invertedPyramid', error: String(e) });
      this.debugLog('error', `Inverted pyramid analysis failed for ${options.url}:`, e);
    }
    
    // Fluff Detection
    opStart = performance.now();
    try {
      fluffResult = detectFluff(options.content);
      this.trackPerformance('fluffDetection', performance.now() - opStart);
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.fluffDetection', error: String(e) });
      this.debugLog('error', `Fluff detection failed for ${options.url}:`, e);
    }
    
    // Listicle Suitability Detection
    opStart = performance.now();
    try {
      listicleSuitability = detectListicleSuitability(options.content);
      this.trackPerformance('listicleDetection', performance.now() - opStart);
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.listicleDetection', error: String(e) });
      this.debugLog('error', `Listicle detection failed for ${options.url}:`, e);
    }
    
    // Schema Generation
    opStart = performance.now();
    try {
      schema = generateFromContent(options.content, options.url);
      this.trackPerformance('schemaGeneration', performance.now() - opStart);
      
      if (this.config.debug?.logEntityDetection && schema) {
        this.debugLog('entity', `Detected entities for ${options.url}:`, 
          schema['@graph'].map(e => ({ type: e['@type'], name: e.name }))
        );
      }
    } catch (e) {
      this.emit({ type: 'error', operation: 'analyzePage.schema', error: String(e) });
      this.debugLog('error', `Schema generation failed for ${options.url}:`, e);
    }
    
    // Freshness Analysis
    if (options.lastModified) {
      opStart = performance.now();
      try {
        freshness = analyzeFreshness(options.url, options.lastModified);
        this.trackPerformance('freshnessAnalysis', performance.now() - opStart);
      } catch (e) {
        this.emit({ type: 'error', operation: 'analyzePage.freshness', error: String(e) });
        this.debugLog('error', `Freshness analysis failed for ${options.url}:`, e);
      }
    }
    
    const processingTimeMs = performance.now() - startTime;
    this.trackPerformance('analyzePage.total', processingTimeMs);
    
    this.debugLog('analyze', `Completed analysis for ${options.url} in ${processingTimeMs.toFixed(2)}ms`, {
      factDensityScore: factDensity.score,
      informationGainScore: informationGain.score,
      invertedPyramidScore: invertedPyramid.score,
      fluffScore: fluffResult.score,
      entityCount: schema?.['@graph']?.length ?? 0
    });
    
    this.emit({
      type: 'analysis_complete',
      url: options.url,
      score: factDensity.score,
      processingTimeMs
    });
    
    return {
      url: options.url,
      factDensity,
      informationGain,
      invertedPyramid,
      schema,
      freshness,
      listicleSuitability,
      fluffScore: fluffResult.score,
      fluffPhrases: fluffResult.phrases,
      processingTimeMs
    };
  }

  /**
   * Analyze a page with timeout protection.
   * Returns partial results if timeout is exceeded.
   * 
   * @param options - Page analysis options
   * @param options.url - Page URL
   * @param options.content - Page content (HTML or text)
   * @param options.lastModified - Optional last modified date
   * @param options.timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Promise resolving to analysis result with timedOut flag
   * 
   * @example
   * const result = await sdk.analyzePageWithTimeout({
   *   url: 'https://example.com',
   *   content: htmlContent,
   *   timeoutMs: 3000
   * });
   * if (result.timedOut) {
   *   console.log('Analysis timed out, partial results returned');
   * }
   */
  async analyzePageWithTimeout(
    options: { url: string; content: string; lastModified?: Date; timeoutMs?: number }
  ): Promise<PageAnalysisResult & { timedOut: boolean }> {
    const timeoutMs = options.timeoutMs ?? 5000;
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        // Return partial/default results on timeout
        this.emit({ type: 'error', operation: 'analyzePage.timeout', error: `Analysis timed out after ${timeoutMs}ms` });
        this.debugLog('timeout', `Analysis timed out for ${options.url} after ${timeoutMs}ms`);
        
        resolve({
          url: options.url,
          factDensity: { 
            score: 0, 
            breakdown: { tables: 0, bulletLists: 0, statistics: 0, headers: 0, headerHierarchyValid: true, headerLevels: [] },
            suggestions: [],
            justificationLevel: 'low'
          },
          informationGain: { score: 0, uniqueEntities: [], commodityPhrasePercentage: 0, commodityPhrases: [] },
          invertedPyramid: { score: 0, answerPosition: 0, isOptimal: false },
          schema: null,
          freshness: null,
          listicleSuitability: { suitable: false, format: null, confidence: 0, reasons: ['Analysis timed out'] },
          fluffScore: 0,
          fluffPhrases: [],
          processingTimeMs: timeoutMs,
          timedOut: true
        });
      }, timeoutMs);
      
      // Run analysis synchronously but wrapped in Promise
      try {
        const result = this.analyzePage(options);
        clearTimeout(timeoutId);
        resolve({ ...result, timedOut: false });
      } catch (e) {
        clearTimeout(timeoutId);
        this.emit({ type: 'error', operation: 'analyzePage', error: String(e) });
        
        // Return default results on error
        resolve({
          url: options.url,
          factDensity: { 
            score: 0, 
            breakdown: { tables: 0, bulletLists: 0, statistics: 0, headers: 0, headerHierarchyValid: true, headerLevels: [] },
            suggestions: [],
            justificationLevel: 'low'
          },
          informationGain: { score: 0, uniqueEntities: [], commodityPhrasePercentage: 0, commodityPhrases: [] },
          invertedPyramid: { score: 0, answerPosition: 0, isOptimal: false },
          schema: null,
          freshness: null,
          listicleSuitability: { suitable: false, format: null, confidence: 0, reasons: ['Analysis failed: ' + String(e)] },
          fluffScore: 0,
          fluffPhrases: [],
          processingTimeMs: performance.now(),
          timedOut: false
        });
      }
    });
  }

  /**
   * Batch analyze multiple pages synchronously.
   * Results are returned in the same order as inputs.
   * 
   * For better performance with many pages, use analyzePagesAsync().
   */
  analyzePages(pages: Array<{ url: string; content: string; lastModified?: Date }>): PageAnalysisResult[] {
    return pages.map(page => this.analyzePage(page));
  }

  /**
   * Async batch analyze with concurrency control.
   * Uses a semaphore pattern to limit concurrent operations.
   * 
   * @param pages - Array of pages to analyze
   * @param options.concurrency - Max concurrent analyses (default: 5)
   * @returns Promise resolving to results in same order as input
   * 
   * @example
   * const results = await sdk.analyzePagesAsync(pages, { concurrency: 10 });
   */
  async analyzePagesAsync(
    pages: Array<{ url: string; content: string; lastModified?: Date }>,
    options: { concurrency?: number; onProgress?: (completed: number, total: number) => void } = {}
  ): Promise<PageAnalysisResult[]> {
    const concurrency = options.concurrency ?? 5;
    const results: PageAnalysisResult[] = new Array(pages.length);
    let completed = 0;
    
    // Semaphore for concurrency control
    let running = 0;
    let nextIndex = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = () => {
        while (running < concurrency && nextIndex < pages.length) {
          const currentIndex = nextIndex++;
          running++;
          
          // Use setImmediate/setTimeout to yield to event loop
          Promise.resolve().then(() => {
            try {
              results[currentIndex] = this.analyzePage(pages[currentIndex]);
              completed++;
              running--;
              
              // Report progress if callback provided
              if (options.onProgress) {
                options.onProgress(completed, pages.length);
              }
              
              if (completed === pages.length) {
                resolve(results);
              } else {
                processNext();
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      };
      
      // Start initial batch
      processNext();
      
      // Handle empty input
      if (pages.length === 0) {
        resolve([]);
      }
    });
  }

  /**
   * Stream analyze pages with callback for each result.
   * Useful for processing large numbers of pages without holding all results in memory.
   */
  async *analyzePagesStream(
    pages: Array<{ url: string; content: string; lastModified?: Date }>
  ): AsyncGenerator<{ index: number; result: PageAnalysisResult }> {
    for (let i = 0; i < pages.length; i++) {
      const result = this.analyzePage(pages[i]);
      yield { index: i, result };
    }
  }

  /**
   * Calculate GEO Health Score.
   */
  getGEOScore(components: GEOHealthComponents): GEOHealthScore {
    return calculateGEOScore(components);
  }

  /**
   * Get SDK configuration.
   */
  getConfig(): ChimeraSDKConfig {
    return { ...this.config };
  }
}

/**
 * Create a Chimera GEO SDK instance.
 * 
 * @param config - SDK configuration or preset name
 * @returns Configured SDK instance
 * 
 * @example
 * // Using a preset
 * const sdk = createChimeraSDK('ecommerce');
 * 
 * // Using custom config
 * const sdk = createChimeraSDK({ fuzzy: { threshold: 0.7 } });
 * 
 * // Extending a preset
 * const sdk = createChimeraSDK({
 *   ...CONFIG_PRESETS.ecommerce,
 *   brandDomains: ['mysite.com']
 * });
 */
export function createChimeraSDK(config: ChimeraSDKConfig | ConfigPreset = {}): ChimeraSDK {
  // Handle preset names
  if (typeof config === 'string') {
    const preset = CONFIG_PRESETS[config];
    if (!preset) {
      throw new Error(`Unknown preset: ${config}. Valid presets: ${Object.keys(CONFIG_PRESETS).join(', ')}`);
    }
    return new ChimeraSDK(preset);
  }
  
  return new ChimeraSDK(config);
}

/**
 * Create SDK with a preset and optional overrides.
 * 
 * @example
 * const sdk = createChimeraSDKWithPreset('ecommerce', {
 *   brandDomains: ['mysite.com'],
 *   router: { aliasThreshold: 3 }
 * });
 */
export function createChimeraSDKWithPreset(
  preset: ConfigPreset,
  overrides: Partial<ChimeraSDKConfig> = {}
): ChimeraSDK {
  const presetConfig = CONFIG_PRESETS[preset];
  if (!presetConfig) {
    throw new Error(`Unknown preset: ${preset}. Valid presets: ${Object.keys(CONFIG_PRESETS).join(', ')}`);
  }
  const mergedConfig = deepMerge(presetConfig, overrides);
  return new ChimeraSDK(mergedConfig);
}

/**
 * Deep merge two config objects.
 */
function deepMerge(target: ChimeraSDKConfig, source: Partial<ChimeraSDKConfig>): ChimeraSDKConfig {
  // Simple shallow merge for top-level, deep merge for nested objects
  return {
    ...target,
    ...source,
    fuzzy: source.fuzzy ? { ...target.fuzzy, ...source.fuzzy } : target.fuzzy,
    analysis: source.analysis ? { ...target.analysis, ...source.analysis } : target.analysis,
    schema: source.schema ? { ...target.schema, ...source.schema } : target.schema,
    router: source.router ? { ...target.router, ...source.router } : target.router,
    freshness: source.freshness ? { ...target.freshness, ...source.freshness } : target.freshness,
    events: source.events ? { ...target.events, ...source.events } : target.events,
    healthCheck: source.healthCheck ? { ...target.healthCheck, ...source.healthCheck } : target.healthCheck,
    debug: source.debug ? { ...target.debug, ...source.debug } : target.debug,
  };
}
