/**
 * Event System for Chimera GEO SDK
 * 
 * Production-grade event emitter with:
 * - Type-safe event definitions
 * - Async event handlers
 * - Webhook dispatch with retry logic
 * - Event history for debugging
 * 
 * @module event-system
 */

// =============================================================================
// Event Types
// =============================================================================

/**
 * All possible SDK event types
 */
export type SDKEventType = 
  | 'citation_found'
  | 'content_stale'
  | 'route_learned'
  | 'route_resolved'
  | 'analysis_complete'
  | 'schema_generated'
  | 'freshness_updated'
  | 'error';

/**
 * Base event interface
 */
export interface BaseEvent {
  type: SDKEventType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Citation found event
 */
export interface CitationFoundEvent extends BaseEvent {
  type: 'citation_found';
  data: {
    citationId: string;
    sourceUrl: string;
    sourceDomain: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    domainAuthority: number;
    isEarnedMedia: boolean;
  };
}

/**
 * Content stale event
 */
export interface ContentStaleEvent extends BaseEvent {
  type: 'content_stale';
  data: {
    path: string;
    lastModified: Date;
    ageInDays: number;
    refreshPriority: 'critical' | 'high' | 'medium' | 'low';
  };
}

/**
 * Route learned event (alias created)
 */
export interface RouteLearnedEvent extends BaseEvent {
  type: 'route_learned';
  data: {
    from: string;
    to: string;
    confidence: number;
    source: 'fuzzy_match' | 'manual' | 'feedback';
  };
}

/**
 * Route resolved event
 */
export interface RouteResolvedEvent extends BaseEvent {
  type: 'route_resolved';
  data: {
    requestedPath: string;
    resolvedPath: string | null;
    confidence: number;
    latencyMs: number;
    wasRedirect: boolean;
  };
}

/**
 * Analysis complete event
 */
export interface AnalysisCompleteEvent extends BaseEvent {
  type: 'analysis_complete';
  data: {
    url: string;
    factDensityScore: number;
    informationGainScore: number;
    invertedPyramidScore: number;
    fluffScore: number;
    processingTimeMs: number;
  };
}

/**
 * Schema generated event
 */
export interface SchemaGeneratedEvent extends BaseEvent {
  type: 'schema_generated';
  data: {
    url: string;
    entityTypes: string[];
    hasEEAT: boolean;
    isValid: boolean;
  };
}

/**
 * Freshness updated event
 */
export interface FreshnessUpdatedEvent extends BaseEvent {
  type: 'freshness_updated';
  data: {
    path: string;
    previousLastModified: Date | null;
    newLastModified: Date;
    velocity: number;
  };
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: {
    operation: string;
    error: string;
    stack?: string;
    recoverable: boolean;
  };
}

/**
 * Union of all event types
 */
export type SDKEvent = 
  | CitationFoundEvent
  | ContentStaleEvent
  | RouteLearnedEvent
  | RouteResolvedEvent
  | AnalysisCompleteEvent
  | SchemaGeneratedEvent
  | FreshnessUpdatedEvent
  | ErrorEvent;

/**
 * Event handler function type
 */
export type EventHandler<T extends SDKEvent = SDKEvent> = (event: T) => void | Promise<void>;

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook URL to POST events to */
  url: string;
  /** Events to send to this webhook (empty = all events) */
  events?: SDKEventType[];
  /** Secret for HMAC signature (optional) */
  secret?: string;
  /** Request timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  retryDelayMs?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
  deliveredAt?: Date;
}

// =============================================================================
// Event Emitter Implementation
// =============================================================================

export interface EventEmitterConfig {
  /** Maximum events to keep in history (default: 100) */
  maxHistorySize?: number;
  /** Whether to log events to console (default: false) */
  debug?: boolean;
}

export interface EventEmitter {
  /** Subscribe to events */
  on<T extends SDKEventType>(
    eventType: T,
    handler: EventHandler<Extract<SDKEvent, { type: T }>>
  ): () => void;
  
  /** Subscribe to all events */
  onAny(handler: EventHandler): () => void;
  
  /** Emit an event */
  emit(event: Omit<SDKEvent, 'timestamp'>): void;
  
  /** Get event history */
  getHistory(eventType?: SDKEventType): SDKEvent[];
  
  /** Clear event history */
  clearHistory(): void;
  
  /** Get statistics */
  getStats(): EventStats;
}

export interface EventStats {
  totalEmitted: number;
  byType: Record<SDKEventType, number>;
  handlerCount: number;
  lastEventAt: Date | null;
}

/**
 * Create an event emitter instance
 */
export function createEventEmitter(config: EventEmitterConfig = {}): EventEmitter {
  const { maxHistorySize = 100, debug = false } = config;
  
  const handlers: Map<SDKEventType | '*', Set<EventHandler>> = new Map();
  const history: SDKEvent[] = [];
  const stats: EventStats = {
    totalEmitted: 0,
    byType: {} as Record<SDKEventType, number>,
    handlerCount: 0,
    lastEventAt: null
  };
  
  function addHandler(eventType: SDKEventType | '*', handler: EventHandler): () => void {
    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }
    handlers.get(eventType)!.add(handler);
    stats.handlerCount++;
    
    // Return unsubscribe function
    return () => {
      const set = handlers.get(eventType);
      if (set) {
        set.delete(handler);
        stats.handlerCount--;
      }
    };
  }
  
  return {
    on<T extends SDKEventType>(
      eventType: T,
      handler: EventHandler<Extract<SDKEvent, { type: T }>>
    ): () => void {
      return addHandler(eventType, handler as EventHandler);
    },
    
    onAny(handler: EventHandler): () => void {
      return addHandler('*', handler);
    },
    
    emit(eventData: Omit<SDKEvent, 'timestamp'>): void {
      const event = {
        ...eventData,
        timestamp: new Date()
      } as SDKEvent;
      
      // Update stats
      stats.totalEmitted++;
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.lastEventAt = event.timestamp;
      
      // Add to history
      history.push(event);
      if (history.length > maxHistorySize) {
        history.shift();
      }
      
      // Debug logging
      if (debug) {
        console.log(`[EventEmitter] ${event.type}:`, event);
      }
      
      // Call type-specific handlers
      const typeHandlers = handlers.get(event.type);
      if (typeHandlers) {
        Array.from(typeHandlers).forEach(handler => {
          try {
            const result = handler(event);
            if (result instanceof Promise) {
              result.catch(err => {
                console.error(`[EventEmitter] Handler error for ${event.type}:`, err);
              });
            }
          } catch (err) {
            console.error(`[EventEmitter] Handler error for ${event.type}:`, err);
          }
        });
      }
      
      // Call wildcard handlers
      const wildcardHandlers = handlers.get('*');
      if (wildcardHandlers) {
        Array.from(wildcardHandlers).forEach(handler => {
          try {
            const result = handler(event);
            if (result instanceof Promise) {
              result.catch(err => {
                console.error(`[EventEmitter] Wildcard handler error:`, err);
              });
            }
          } catch (err) {
            console.error(`[EventEmitter] Wildcard handler error:`, err);
          }
        });
      }
    },
    
    getHistory(eventType?: SDKEventType): SDKEvent[] {
      if (eventType) {
        return history.filter(e => e.type === eventType);
      }
      return [...history];
    },
    
    clearHistory(): void {
      history.length = 0;
    },
    
    getStats(): EventStats {
      return { ...stats, byType: { ...stats.byType } };
    }
  };
}

// =============================================================================
// Webhook Dispatcher
// =============================================================================

export interface WebhookDispatcher {
  /** Add a webhook endpoint */
  addWebhook(config: WebhookConfig): string;
  
  /** Remove a webhook by ID */
  removeWebhook(id: string): boolean;
  
  /** Dispatch an event to all matching webhooks */
  dispatch(event: SDKEvent): Promise<Map<string, WebhookDeliveryResult>>;
  
  /** Get delivery statistics */
  getStats(): WebhookStats;
  
  /** Get all configured webhooks */
  getWebhooks(): Array<{ id: string; config: WebhookConfig }>;
}

export interface WebhookStats {
  totalDispatched: number;
  totalSuccessful: number;
  totalFailed: number;
  byWebhook: Record<string, { dispatched: number; successful: number; failed: number }>;
}

/**
 * Create HMAC signature for webhook payload
 */
async function createSignature(payload: string, secret: string): Promise<string> {
  // Use Web Crypto API for browser compatibility
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Fallback for Node.js
  const { createHmac } = await import('crypto');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Dispatch webhook with retry logic
 */
async function dispatchWithRetry(
  url: string,
  payload: string,
  config: WebhookConfig
): Promise<WebhookDeliveryResult> {
  const {
    timeoutMs = 5000,
    maxRetries = 3,
    retryDelayMs = 1000,
    secret,
    headers = {}
  } = config;
  
  let lastError: string | undefined;
  let attempts = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Chimera-GEO-SDK/2.0 (Webhook)',
        ...headers
      };
      
      // Add signature if secret configured
      if (secret) {
        const signature = await createSignature(payload, secret);
        requestHeaders['X-Chimera-Signature'] = `sha256=${signature}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: payload,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempts,
          deliveredAt: new Date()
        };
      }
      
      lastError = `HTTP ${response.status}: ${response.statusText}`;
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    
    // Wait before retry with exponential backoff
    if (attempt < maxRetries) {
      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    success: false,
    attempts,
    error: lastError
  };
}

/**
 * Create a webhook dispatcher instance
 */
export function createWebhookDispatcher(): WebhookDispatcher {
  const webhooks: Map<string, WebhookConfig> = new Map();
  let webhookIdCounter = 0;
  
  const stats: WebhookStats = {
    totalDispatched: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    byWebhook: {}
  };
  
  return {
    addWebhook(config: WebhookConfig): string {
      const id = `webhook_${++webhookIdCounter}`;
      webhooks.set(id, config);
      stats.byWebhook[id] = { dispatched: 0, successful: 0, failed: 0 };
      return id;
    },
    
    removeWebhook(id: string): boolean {
      return webhooks.delete(id);
    },
    
    async dispatch(event: SDKEvent): Promise<Map<string, WebhookDeliveryResult>> {
      const results = new Map<string, WebhookDeliveryResult>();
      const payload = JSON.stringify(event);
      
      const dispatchPromises: Promise<void>[] = [];
      
      Array.from(webhooks.entries()).forEach(([id, config]) => {
        // Check if this webhook should receive this event type
        if (config.events && config.events.length > 0) {
          if (!config.events.includes(event.type)) {
            return;
          }
        }
        
        const promise = dispatchWithRetry(config.url, payload, config)
          .then(result => {
            results.set(id, result);
            
            // Update stats
            stats.totalDispatched++;
            stats.byWebhook[id].dispatched++;
            
            if (result.success) {
              stats.totalSuccessful++;
              stats.byWebhook[id].successful++;
            } else {
              stats.totalFailed++;
              stats.byWebhook[id].failed++;
            }
          });
        
        dispatchPromises.push(promise);
      });
      
      await Promise.all(dispatchPromises);
      return results;
    },
    
    getStats(): WebhookStats {
      return {
        ...stats,
        byWebhook: { ...stats.byWebhook }
      };
    },
    
    getWebhooks(): Array<{ id: string; config: WebhookConfig }> {
      return Array.from(webhooks.entries()).map(([id, config]) => ({ id, config }));
    }
  };
}

// =============================================================================
// Integrated Event System
// =============================================================================

export interface EventSystem {
  /** Event emitter for local handlers */
  emitter: EventEmitter;
  /** Webhook dispatcher for remote delivery */
  webhooks: WebhookDispatcher;
  /** Emit event to both local handlers and webhooks */
  emit(event: Omit<SDKEvent, 'timestamp'>): Promise<void>;
}

/**
 * Create an integrated event system with both local and webhook support
 */
export function createEventSystem(config: EventEmitterConfig = {}): EventSystem {
  const emitter = createEventEmitter(config);
  const webhooks = createWebhookDispatcher();
  
  return {
    emitter,
    webhooks,
    async emit(eventData: Omit<SDKEvent, 'timestamp'>): Promise<void> {
      const event = {
        ...eventData,
        timestamp: new Date()
      } as SDKEvent;
      
      // Emit to local handlers (sync)
      emitter.emit(eventData);
      
      // Dispatch to webhooks (async)
      await webhooks.dispatch(event);
    }
  };
}
