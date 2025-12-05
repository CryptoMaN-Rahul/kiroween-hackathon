/**
 * Analytics Integration Module
 * 
 * Provides standardized GEO analytics event format and integrations
 * with popular analytics platforms like Google Analytics 4.
 * 
 * @module analytics-integration
 */

import type { AgentType } from '@/types';

// =============================================================================
// Standard GEO Analytics Event Schema
// =============================================================================

/**
 * GEO Analytics event categories
 */
export type GEOEventCategory = 
  | 'page_analysis'
  | 'route_resolution'
  | 'citation_discovery'
  | 'schema_generation'
  | 'content_transformation'
  | 'freshness_check'
  | 'agent_detection';

/**
 * GEO Analytics event actions
 */
export type GEOEventAction =
  | 'analyzed'
  | 'redirected'
  | 'not_found'
  | 'discovered'
  | 'generated'
  | 'transformed'
  | 'stale_detected'
  | 'detected'
  | 'error';

/**
 * Standard GEO Analytics Event
 * 
 * This schema is designed to be compatible with:
 * - Google Analytics 4 (GA4)
 * - Segment
 * - Mixpanel
 * - Custom analytics backends
 */
export interface GEOAnalyticsEvent {
  /** Event name following GA4 naming conventions */
  event_name: string;
  /** Event category for grouping */
  category: GEOEventCategory;
  /** Specific action taken */
  action: GEOEventAction;
  /** Event timestamp in ISO format */
  timestamp: string;
  /** Unique event ID */
  event_id: string;
  /** Session ID for grouping related events */
  session_id?: string;
  /** User/client ID */
  client_id?: string;
  
  /** Page/content being analyzed or processed */
  page_location?: string;
  /** Page title if available */
  page_title?: string;
  
  /** AI agent type if detected */
  agent_type?: AgentType;
  /** Whether request was from AI agent */
  is_ai_agent?: boolean;
  
  /** GEO-specific metrics */
  geo_metrics?: {
    /** Fact density score (0-1) */
    fact_density_score?: number;
    /** Information gain score (0-100) */
    information_gain_score?: number;
    /** Inverted pyramid score (0-100) */
    inverted_pyramid_score?: number;
    /** Fluff score (0-100) */
    fluff_score?: number;
    /** Schema coverage percentage */
    schema_coverage?: number;
    /** Route confidence score */
    route_confidence?: number;
    /** Processing time in ms */
    processing_time_ms?: number;
    /** GEO health score (0-100) */
    geo_health_score?: number;
  };
  
  /** Route resolution details */
  route_details?: {
    /** Original requested path */
    requested_path?: string;
    /** Matched/redirected path */
    matched_path?: string;
    /** Match confidence */
    confidence?: number;
    /** Match method used */
    match_method?: 'alias' | 'semantic' | 'exact' | 'none';
  };
  
  /** Citation details */
  citation_details?: {
    /** Source domain */
    source_domain?: string;
    /** Domain authority score */
    domain_authority?: number;
    /** Sentiment */
    sentiment?: 'positive' | 'neutral' | 'negative';
    /** Is earned media */
    is_earned_media?: boolean;
  };
  
  /** Schema generation details */
  schema_details?: {
    /** Entity types detected */
    entity_types?: string[];
    /** Whether E-E-A-T signals included */
    has_eeat?: boolean;
    /** Round-trip validation passed */
    validation_passed?: boolean;
  };
  
  /** Custom dimensions for extensibility */
  custom_dimensions?: Record<string, string | number | boolean>;
}

// =============================================================================
// Event Builders
// =============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `geo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a page analysis event
 */
export function createPageAnalysisEvent(params: {
  pageLocation: string;
  pageTitle?: string;
  factDensityScore: number;
  informationGainScore?: number;
  invertedPyramidScore?: number;
  fluffScore?: number;
  processingTimeMs: number;
  agentType?: AgentType;
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  return {
    event_name: 'geo_page_analyzed',
    category: 'page_analysis',
    action: 'analyzed',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    page_location: params.pageLocation,
    page_title: params.pageTitle,
    agent_type: params.agentType,
    is_ai_agent: params.agentType ? params.agentType !== 'Human' : undefined,
    geo_metrics: {
      fact_density_score: params.factDensityScore,
      information_gain_score: params.informationGainScore,
      inverted_pyramid_score: params.invertedPyramidScore,
      fluff_score: params.fluffScore,
      processing_time_ms: params.processingTimeMs
    }
  };
}

/**
 * Create a route resolution event
 */
export function createRouteResolutionEvent(params: {
  requestedPath: string;
  matchedPath: string | null;
  confidence: number;
  matchMethod: 'alias' | 'semantic' | 'exact' | 'none';
  processingTimeMs: number;
  agentType?: AgentType;
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  const wasRedirected = params.matchedPath !== null && params.matchMethod !== 'none';
  
  return {
    event_name: wasRedirected ? 'geo_route_redirected' : 'geo_route_not_found',
    category: 'route_resolution',
    action: wasRedirected ? 'redirected' : 'not_found',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    page_location: params.requestedPath,
    agent_type: params.agentType,
    is_ai_agent: params.agentType ? params.agentType !== 'Human' : undefined,
    geo_metrics: {
      route_confidence: params.confidence,
      processing_time_ms: params.processingTimeMs
    },
    route_details: {
      requested_path: params.requestedPath,
      matched_path: params.matchedPath || undefined,
      confidence: params.confidence,
      match_method: params.matchMethod
    }
  };
}

/**
 * Create a citation discovery event
 */
export function createCitationDiscoveryEvent(params: {
  sourceDomain: string;
  domainAuthority: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  isEarnedMedia: boolean;
  brandTerm?: string;
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  return {
    event_name: 'geo_citation_discovered',
    category: 'citation_discovery',
    action: 'discovered',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    citation_details: {
      source_domain: params.sourceDomain,
      domain_authority: params.domainAuthority,
      sentiment: params.sentiment,
      is_earned_media: params.isEarnedMedia
    },
    custom_dimensions: params.brandTerm ? { brand_term: params.brandTerm } : undefined
  };
}

/**
 * Create a schema generation event
 */
export function createSchemaGenerationEvent(params: {
  pageLocation: string;
  entityTypes: string[];
  hasEEAT: boolean;
  validationPassed: boolean;
  processingTimeMs: number;
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  return {
    event_name: 'geo_schema_generated',
    category: 'schema_generation',
    action: 'generated',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    page_location: params.pageLocation,
    geo_metrics: {
      processing_time_ms: params.processingTimeMs
    },
    schema_details: {
      entity_types: params.entityTypes,
      has_eeat: params.hasEEAT,
      validation_passed: params.validationPassed
    }
  };
}

/**
 * Create an agent detection event
 */
export function createAgentDetectionEvent(params: {
  pageLocation: string;
  agentType: AgentType;
  confidence: number;
  signals: string[];
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  return {
    event_name: 'geo_agent_detected',
    category: 'agent_detection',
    action: 'detected',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    page_location: params.pageLocation,
    agent_type: params.agentType,
    is_ai_agent: params.agentType !== 'Human',
    geo_metrics: {
      route_confidence: params.confidence
    },
    custom_dimensions: {
      detection_signals: params.signals.join(',')
    }
  };
}

/**
 * Create a freshness check event
 */
export function createFreshnessCheckEvent(params: {
  pageLocation: string;
  ageInDays: number;
  isStale: boolean;
  refreshPriority: 'critical' | 'high' | 'medium' | 'low';
  velocity: number;
  sessionId?: string;
  clientId?: string;
}): GEOAnalyticsEvent {
  return {
    event_name: params.isStale ? 'geo_content_stale' : 'geo_content_fresh',
    category: 'freshness_check',
    action: params.isStale ? 'stale_detected' : 'analyzed',
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    session_id: params.sessionId,
    client_id: params.clientId,
    page_location: params.pageLocation,
    custom_dimensions: {
      age_in_days: params.ageInDays,
      is_stale: params.isStale,
      refresh_priority: params.refreshPriority,
      update_velocity: params.velocity
    }
  };
}

// =============================================================================
// Google Analytics 4 Integration
// =============================================================================

/**
 * GA4 Measurement Protocol configuration
 */
export interface GA4Config {
  /** GA4 Measurement ID (G-XXXXXXXXXX) */
  measurementId: string;
  /** GA4 API Secret */
  apiSecret: string;
  /** Debug mode (sends to debug endpoint) */
  debug?: boolean;
  /** Client ID for user tracking */
  defaultClientId?: string;
}

/**
 * GA4 Measurement Protocol event format
 */
interface GA4Event {
  name: string;
  params: Record<string, string | number | boolean | undefined>;
}

/**
 * GA4 Measurement Protocol payload
 */
interface GA4Payload {
  client_id: string;
  events: GA4Event[];
  user_properties?: Record<string, { value: string | number }>;
}

/**
 * Convert GEO event to GA4 format
 */
export function convertToGA4Event(event: GEOAnalyticsEvent): GA4Event {
  const params: Record<string, string | number | boolean | undefined> = {
    event_category: event.category,
    event_action: event.action,
    page_location: event.page_location,
    page_title: event.page_title,
    agent_type: event.agent_type,
    is_ai_agent: event.is_ai_agent,
  };
  
  // Add GEO metrics
  if (event.geo_metrics) {
    if (event.geo_metrics.fact_density_score !== undefined) {
      params.fact_density_score = Math.round(event.geo_metrics.fact_density_score * 100);
    }
    if (event.geo_metrics.information_gain_score !== undefined) {
      params.information_gain_score = event.geo_metrics.information_gain_score;
    }
    if (event.geo_metrics.route_confidence !== undefined) {
      params.route_confidence = Math.round(event.geo_metrics.route_confidence * 100);
    }
    if (event.geo_metrics.processing_time_ms !== undefined) {
      params.processing_time_ms = Math.round(event.geo_metrics.processing_time_ms);
    }
    if (event.geo_metrics.geo_health_score !== undefined) {
      params.geo_health_score = event.geo_metrics.geo_health_score;
    }
  }
  
  // Add route details
  if (event.route_details) {
    params.requested_path = event.route_details.requested_path;
    params.matched_path = event.route_details.matched_path;
    params.match_method = event.route_details.match_method;
  }
  
  // Add citation details
  if (event.citation_details) {
    params.source_domain = event.citation_details.source_domain;
    params.domain_authority = event.citation_details.domain_authority;
    params.sentiment = event.citation_details.sentiment;
    params.is_earned_media = event.citation_details.is_earned_media;
  }
  
  // Add schema details
  if (event.schema_details) {
    params.entity_types = event.schema_details.entity_types?.join(',');
    params.has_eeat = event.schema_details.has_eeat;
    params.validation_passed = event.schema_details.validation_passed;
  }
  
  // Add custom dimensions
  if (event.custom_dimensions) {
    for (const [key, value] of Object.entries(event.custom_dimensions)) {
      params[`custom_${key}`] = value;
    }
  }
  
  // Remove undefined values
  const cleanParams: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      cleanParams[key] = value;
    }
  }
  
  return {
    name: event.event_name,
    params: cleanParams
  };
}

/**
 * Google Analytics 4 integration service
 */
export interface GA4Integration {
  /** Send a single GEO event to GA4 */
  sendEvent(event: GEOAnalyticsEvent): Promise<GA4SendResult>;
  /** Send multiple GEO events to GA4 */
  sendEvents(events: GEOAnalyticsEvent[]): Promise<GA4SendResult>;
  /** Get configuration */
  getConfig(): GA4Config;
  /** Validate configuration */
  validateConfig(): boolean;
}

export interface GA4SendResult {
  success: boolean;
  eventCount: number;
  error?: string;
  validationMessages?: string[];
}

/**
 * Create a GA4 integration service
 */
export function createGA4Integration(config: GA4Config): GA4Integration {
  const baseUrl = config.debug
    ? 'https://www.google-analytics.com/debug/mp/collect'
    : 'https://www.google-analytics.com/mp/collect';
  
  async function sendPayload(payload: GA4Payload): Promise<GA4SendResult> {
    try {
      const url = `${baseUrl}?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (config.debug) {
        // Debug endpoint returns validation messages
        const debugResponse = await response.json();
        return {
          success: response.ok,
          eventCount: payload.events.length,
          validationMessages: debugResponse.validationMessages
        };
      }
      
      // Production endpoint returns empty response on success
      return {
        success: response.ok,
        eventCount: payload.events.length
      };
    } catch (error) {
      return {
        success: false,
        eventCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return {
    async sendEvent(event: GEOAnalyticsEvent): Promise<GA4SendResult> {
      const ga4Event = convertToGA4Event(event);
      const payload: GA4Payload = {
        client_id: event.client_id || config.defaultClientId || generateEventId(),
        events: [ga4Event]
      };
      
      return sendPayload(payload);
    },
    
    async sendEvents(events: GEOAnalyticsEvent[]): Promise<GA4SendResult> {
      if (events.length === 0) {
        return { success: true, eventCount: 0 };
      }
      
      // GA4 allows max 25 events per request
      const batches: GEOAnalyticsEvent[][] = [];
      for (let i = 0; i < events.length; i += 25) {
        batches.push(events.slice(i, i + 25));
      }
      
      let totalSent = 0;
      const errors: string[] = [];
      
      for (const batch of batches) {
        const ga4Events = batch.map(convertToGA4Event);
        const clientId = batch[0].client_id || config.defaultClientId || generateEventId();
        
        const payload: GA4Payload = {
          client_id: clientId,
          events: ga4Events
        };
        
        const result = await sendPayload(payload);
        if (result.success) {
          totalSent += result.eventCount;
        } else if (result.error) {
          errors.push(result.error);
        }
      }
      
      return {
        success: errors.length === 0,
        eventCount: totalSent,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    },
    
    getConfig(): GA4Config {
      return { ...config };
    },
    
    validateConfig(): boolean {
      return (
        typeof config.measurementId === 'string' &&
        config.measurementId.startsWith('G-') &&
        typeof config.apiSecret === 'string' &&
        config.apiSecret.length > 0
      );
    }
  };
}

// =============================================================================
// Analytics Event Buffer
// =============================================================================

/**
 * Buffered analytics sender for batching events
 */
export interface AnalyticsBuffer {
  /** Add event to buffer */
  push(event: GEOAnalyticsEvent): void;
  /** Flush all buffered events */
  flush(): Promise<GA4SendResult>;
  /** Get current buffer size */
  size(): number;
  /** Clear buffer without sending */
  clear(): void;
}

/**
 * Create a buffered analytics sender
 */
export function createAnalyticsBuffer(
  ga4: GA4Integration,
  options: { maxSize?: number; flushIntervalMs?: number } = {}
): AnalyticsBuffer {
  const maxSize = options.maxSize ?? 100;
  const flushIntervalMs = options.flushIntervalMs ?? 30000; // 30 seconds
  
  let buffer: GEOAnalyticsEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  
  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flush();
    }, flushIntervalMs);
  }
  
  async function flush(): Promise<GA4SendResult> {
    if (buffer.length === 0) {
      return { success: true, eventCount: 0 };
    }
    
    const events = [...buffer];
    buffer = [];
    
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    
    return ga4.sendEvents(events);
  }
  
  return {
    push(event: GEOAnalyticsEvent): void {
      buffer.push(event);
      
      if (buffer.length >= maxSize) {
        flush();
      } else {
        scheduleFlush();
      }
    },
    
    flush,
    
    size(): number {
      return buffer.length;
    },
    
    clear(): void {
      buffer = [];
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    }
  };
}

// =============================================================================
// Exports
// =============================================================================

// All functions are already exported inline with 'export function'
// No need for additional export block
