/**
 * CMS Webhook Receiver
 * 
 * Generic webhook receiver for Content Management System integrations.
 * Supports automatic freshness tracking and content re-analysis on updates.
 * 
 * @module cms-webhook
 */

import { createFreshnessMonitor, type FreshnessMonitor, type FreshnessConfig } from './freshness-monitor';
import { analyze as analyzeFactDensity } from './fact-density-analyzer';
import { generateFromContent } from './schema-generator';
import type { FactDensityResult, GeneratedSchema } from '@/types';
import { createHmac, timingSafeEqual } from 'crypto';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported CMS platforms
 */
export type CMSPlatform = 'contentful' | 'sanity' | 'strapi' | 'wordpress' | 'custom';

/**
 * Webhook event types
 */
export type WebhookEventType = 
  | 'content.created'
  | 'content.updated'
  | 'content.deleted'
  | 'content.published'
  | 'content.unpublished';

/**
 * Normalized webhook payload from any CMS
 */
export interface NormalizedWebhookPayload {
  /** Unique content identifier */
  contentId: string;
  /** Content type/model name */
  contentType: string;
  /** Event that triggered the webhook */
  event: WebhookEventType;
  /** URL path for the content (if applicable) */
  path?: string;
  /** Content title */
  title?: string;
  /** Raw content body (HTML or markdown) */
  content?: string;
  /** When the content was last modified */
  lastModified: Date;
  /** Original CMS platform */
  platform: CMSPlatform;
  /** Original raw payload from CMS */
  rawPayload: unknown;
}

/**
 * Result of processing a webhook
 */
export interface WebhookProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Content ID that was processed */
  contentId: string;
  /** Event type that was processed */
  event: WebhookEventType;
  /** Actions taken during processing */
  actions: WebhookAction[];
  /** Analysis results (if content was analyzed) */
  analysis?: {
    factDensity: FactDensityResult;
    schema: GeneratedSchema | null;
  };
  /** Error message if processing failed */
  error?: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Actions taken during webhook processing
 */
export type WebhookAction = 
  | 'freshness_updated'
  | 'content_analyzed'
  | 'schema_generated'
  | 'cache_invalidated'
  | 'event_emitted';

/**
 * Webhook handler function type
 */
export type WebhookHandler = (payload: NormalizedWebhookPayload) => Promise<void> | void;

/**
 * CMS webhook receiver configuration
 */
export interface CMSWebhookConfig {
  /** Freshness monitor configuration */
  freshness?: FreshnessConfig;
  /** Whether to auto-analyze content on updates */
  autoAnalyze?: boolean;
  /** Whether to auto-generate schema on updates */
  autoGenerateSchema?: boolean;
  /** Custom handlers for specific events */
  handlers?: Partial<Record<WebhookEventType, WebhookHandler>>;
  /** Secret for webhook signature verification */
  webhookSecret?: string;
  /** Allowed CMS platforms (empty = all allowed) */
  allowedPlatforms?: CMSPlatform[];
}

/**
 * Webhook event emitted by the receiver
 */
export interface WebhookEvent {
  type: 'webhook_received' | 'webhook_processed' | 'webhook_error';
  payload: NormalizedWebhookPayload;
  result?: WebhookProcessingResult;
  error?: string;
  timestamp: Date;
}

export type WebhookEventHandler = (event: WebhookEvent) => void;

// =============================================================================
// CMS-Specific Payload Types
// =============================================================================

export interface ContentfulWebhookPayload {
  sys: {
    id: string;
    type: string;
    contentType?: { sys: { id: string } };
    createdAt?: string;
    updatedAt?: string;
    space?: { sys: { id: string } };
    environment?: { sys: { id: string } };
  };
  fields?: Record<string, Record<string, unknown>>;
  topic?: string;
}

export interface SanityWebhookPayload {
  _id?: string;
  _type?: string;
  _updatedAt?: string;
  _createdAt?: string;
  documentId?: string;
  operation?: string;
  title?: string;
  slug?: { current: string };
  body?: string;
  content?: string;
}

export interface StrapiWebhookPayload {
  event?: string;
  model?: string;
  entry?: {
    id?: number;
    title?: string;
    name?: string;
    slug?: string;
    content?: string;
    body?: string;
    updatedAt?: string;
    updated_at?: string;
  };
}

export interface WordPressWebhookPayload {
  action?: string;
  post?: {
    ID?: number;
    id?: number;
    post_title?: string;
    post_content?: string;
    post_name?: string;
    post_type?: string;
    post_date?: string;
    post_modified?: string;
  };
  ID?: number;
  id?: number;
  post_title?: string;
  post_content?: string;
  post_name?: string;
  post_type?: string;
  post_date?: string;
  post_modified?: string;
}

// =============================================================================
// Payload Normalizers
// =============================================================================

/**
 * Normalize a Contentful webhook payload
 */
export function normalizeContentfulPayload(rawPayload: ContentfulWebhookPayload): NormalizedWebhookPayload {
  const sys = rawPayload.sys;
  const fields = rawPayload.fields || {};
  
  // Map Contentful event types to our normalized types
  const eventMap: Record<string, WebhookEventType> = {
    'Entry.create': 'content.created',
    'Entry.save': 'content.updated',
    'Entry.publish': 'content.published',
    'Entry.unpublish': 'content.unpublished',
    'Entry.delete': 'content.deleted',
    'ContentType.create': 'content.created',
    'ContentType.save': 'content.updated',
    'ContentType.delete': 'content.deleted',
  };
  
  const event = eventMap[rawPayload.topic || ''] || 'content.updated';
  
  // Extract content from fields (handle localized content)
  const locale = Object.keys(fields.title || {})[0] || 'en-US';
  const title = String(fields.title?.[locale] || fields.name?.[locale] || '');
  const content = String(fields.body?.[locale] || fields.content?.[locale] || '');
  const slug = String(fields.slug?.[locale] || '');
  
  return {
    contentId: sys.id,
    contentType: sys.contentType?.sys?.id || sys.type || 'unknown',
    event,
    path: slug ? `/${slug}` : undefined,
    title,
    content,
    lastModified: new Date(sys.updatedAt || sys.createdAt || Date.now()),
    platform: 'contentful',
    rawPayload
  };
}

/**
 * Normalize a Sanity webhook payload
 */
export function normalizeSanityPayload(rawPayload: SanityWebhookPayload): NormalizedWebhookPayload {
  const eventMap: Record<string, WebhookEventType> = {
    'create': 'content.created',
    'update': 'content.updated',
    'delete': 'content.deleted',
  };
  
  const event = eventMap[rawPayload.operation || 'update'] || 'content.updated';
  
  return {
    contentId: rawPayload._id || rawPayload.documentId || '',
    contentType: rawPayload._type || 'document',
    event,
    path: rawPayload.slug?.current ? `/${rawPayload.slug.current}` : undefined,
    title: rawPayload.title || '',
    content: rawPayload.body || rawPayload.content || '',
    lastModified: new Date(rawPayload._updatedAt || Date.now()),
    platform: 'sanity',
    rawPayload
  };
}

/**
 * Normalize a Strapi webhook payload
 */
export function normalizeStrapiPayload(rawPayload: StrapiWebhookPayload): NormalizedWebhookPayload {
  const eventMap: Record<string, WebhookEventType> = {
    'entry.create': 'content.created',
    'entry.update': 'content.updated',
    'entry.delete': 'content.deleted',
    'entry.publish': 'content.published',
    'entry.unpublish': 'content.unpublished',
  };
  
  const event = eventMap[rawPayload.event || 'entry.update'] || 'content.updated';
  const entry = rawPayload.entry || {};
  
  return {
    contentId: String(entry.id || rawPayload.model || ''),
    contentType: rawPayload.model || 'entry',
    event,
    path: entry.slug ? `/${entry.slug}` : undefined,
    title: entry.title || entry.name || '',
    content: entry.content || entry.body || '',
    lastModified: new Date(entry.updatedAt || entry.updated_at || Date.now()),
    platform: 'strapi',
    rawPayload
  };
}

/**
 * Normalize a WordPress webhook payload
 */
export function normalizeWordPressPayload(rawPayload: WordPressWebhookPayload): NormalizedWebhookPayload {
  const eventMap: Record<string, WebhookEventType> = {
    'post_created': 'content.created',
    'post_updated': 'content.updated',
    'post_deleted': 'content.deleted',
    'post_published': 'content.published',
    'post_trashed': 'content.unpublished',
  };
  
  const event = eventMap[rawPayload.action || 'post_updated'] || 'content.updated';
  const post = rawPayload.post || rawPayload;
  
  return {
    contentId: String(post.ID || post.id || ''),
    contentType: post.post_type || 'post',
    event,
    path: post.post_name ? `/${post.post_name}` : undefined,
    title: post.post_title || '',
    content: post.post_content || '',
    lastModified: new Date(post.post_modified || post.post_date || Date.now()),
    platform: 'wordpress',
    rawPayload
  };
}

// =============================================================================
// CMS Webhook Receiver
// =============================================================================

export interface CMSWebhookReceiver {
  /**
   * Process a raw webhook payload from any supported CMS
   */
  processWebhook(platform: CMSPlatform, rawPayload: unknown): Promise<WebhookProcessingResult>;
  
  /**
   * Process a pre-normalized webhook payload
   */
  processNormalizedPayload(payload: NormalizedWebhookPayload): Promise<WebhookProcessingResult>;
  
  /**
   * Register an event handler
   */
  on(handler: WebhookEventHandler): () => void;
  
  /**
   * Get the freshness monitor instance
   */
  getFreshnessMonitor(): FreshnessMonitor;
  
  /**
   * Get processing statistics
   */
  getStats(): WebhookStats;
  
  /**
   * Verify webhook signature (platform-specific)
   */
  verifySignature(platform: CMSPlatform, payload: string, signature: string): boolean;
}

export interface WebhookStats {
  totalReceived: number;
  totalProcessed: number;
  totalErrors: number;
  byPlatform: Record<CMSPlatform, number>;
  byEvent: Record<WebhookEventType, number>;
  lastProcessedAt: Date | null;
}

// =============================================================================
// Webhook Signature Verification
// =============================================================================

/**
 * Verify webhook signature using HMAC.
 * Supports platform-specific signature formats.
 * 
 * @param platform - CMS platform
 * @param payload - Raw payload string
 * @param signature - Signature from webhook header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  platform: CMSPlatform,
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    switch (platform) {
      case 'contentful': {
        // Contentful uses HMAC-SHA256 with base64 encoding
        // Header: X-Contentful-Signature
        const expectedSignature = createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        return timingSafeCompare(signature, expectedSignature);
      }
      
      case 'sanity': {
        // Sanity uses HMAC-SHA256 with hex encoding
        // Header: sanity-webhook-signature
        const expectedSignature = createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return timingSafeCompare(signature, expectedSignature);
      }
      
      case 'strapi': {
        // Strapi uses HMAC-SHA256 with hex encoding
        // Header: X-Strapi-Signature
        const expectedSignature = createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return timingSafeCompare(signature, expectedSignature);
      }
      
      case 'wordpress': {
        // WordPress (WP REST API) typically uses HMAC-SHA256
        // Header: X-WP-Webhook-Signature
        const expectedSignature = createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return timingSafeCompare(signature, expectedSignature);
      }
      
      case 'custom':
      default: {
        // For custom webhooks, try common formats
        // First try hex encoding
        const hexSignature = createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        if (timingSafeCompare(signature, hexSignature)) return true;
        
        // Then try base64 encoding
        const base64Signature = createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        if (timingSafeCompare(signature, base64Signature)) return true;
        
        // Finally, try direct comparison (for simple secrets)
        return timingSafeCompare(signature, secret);
      }
    }
  } catch (error) {
    console.error('[CMSWebhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    // If lengths differ, still do comparison to maintain constant time
    if (bufA.length !== bufB.length) {
      // Compare with self to maintain timing
      timingSafeEqual(bufA, bufA);
      return false;
    }
    
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Create a CMS webhook receiver instance
 */
export function createCMSWebhookReceiver(config: CMSWebhookConfig = {}): CMSWebhookReceiver {
  const freshnessMonitor = createFreshnessMonitor(config.freshness);
  const eventHandlers: WebhookEventHandler[] = [];
  
  const stats: WebhookStats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalErrors: 0,
    byPlatform: {
      contentful: 0,
      sanity: 0,
      strapi: 0,
      wordpress: 0,
      custom: 0
    },
    byEvent: {
      'content.created': 0,
      'content.updated': 0,
      'content.deleted': 0,
      'content.published': 0,
      'content.unpublished': 0
    },
    lastProcessedAt: null
  };
  
  function emit(event: WebhookEvent): void {
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('[CMSWebhook] Event handler error:', e);
      }
    }
  }
  
  function normalizePayload(platform: CMSPlatform, rawPayload: unknown): NormalizedWebhookPayload {
    switch (platform) {
      case 'contentful':
        return normalizeContentfulPayload(rawPayload as ContentfulWebhookPayload);
      case 'sanity':
        return normalizeSanityPayload(rawPayload as SanityWebhookPayload);
      case 'strapi':
        return normalizeStrapiPayload(rawPayload as StrapiWebhookPayload);
      case 'wordpress':
        return normalizeWordPressPayload(rawPayload as WordPressWebhookPayload);
      case 'custom':
      default:
        // For custom payloads, expect them to already be normalized
        return rawPayload as NormalizedWebhookPayload;
    }
  }
  
  async function processNormalizedPayload(payload: NormalizedWebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = performance.now();
    const actions: WebhookAction[] = [];
    
    stats.totalReceived++;
    stats.byPlatform[payload.platform]++;
    stats.byEvent[payload.event]++;
    
    emit({
      type: 'webhook_received',
      payload,
      timestamp: new Date()
    });
    
    try {
      // Check if platform is allowed
      if (config.allowedPlatforms && config.allowedPlatforms.length > 0) {
        if (!config.allowedPlatforms.includes(payload.platform)) {
          throw new Error(`Platform '${payload.platform}' is not allowed`);
        }
      }
      
      // Update freshness tracking
      if (payload.path && payload.event !== 'content.deleted') {
        freshnessMonitor.recordUpdate(payload.path, payload.lastModified);
        actions.push('freshness_updated');
      }
      
      // Run custom handler if registered
      const customHandler = config.handlers?.[payload.event];
      if (customHandler) {
        await customHandler(payload);
      }
      
      // Auto-analyze content if enabled and content is available
      let analysis: WebhookProcessingResult['analysis'];
      if (config.autoAnalyze !== false && payload.content && payload.event !== 'content.deleted') {
        const factDensity = analyzeFactDensity(payload.content);
        actions.push('content_analyzed');
        
        let schema: GeneratedSchema | null = null;
        if (config.autoGenerateSchema !== false) {
          try {
            schema = generateFromContent(payload.content, payload.path || '');
            actions.push('schema_generated');
          } catch {
            // Schema generation is optional, don't fail the whole process
          }
        }
        
        analysis = { factDensity, schema };
      }
      
      // Emit event
      actions.push('event_emitted');
      
      const result: WebhookProcessingResult = {
        success: true,
        contentId: payload.contentId,
        event: payload.event,
        actions,
        analysis,
        processingTimeMs: performance.now() - startTime
      };
      
      stats.totalProcessed++;
      stats.lastProcessedAt = new Date();
      
      emit({
        type: 'webhook_processed',
        payload,
        result,
        timestamp: new Date()
      });
      
      return result;
    } catch (error) {
      stats.totalErrors++;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      emit({
        type: 'webhook_error',
        payload,
        error: errorMessage,
        timestamp: new Date()
      });
      
      return {
        success: false,
        contentId: payload.contentId,
        event: payload.event,
        actions,
        error: errorMessage,
        processingTimeMs: performance.now() - startTime
      };
    }
  }
  
  return {
    async processWebhook(platform: CMSPlatform, rawPayload: unknown): Promise<WebhookProcessingResult> {
      const normalized = normalizePayload(platform, rawPayload);
      return processNormalizedPayload(normalized);
    },
    
    processNormalizedPayload,
    
    on(handler: WebhookEventHandler): () => void {
      eventHandlers.push(handler);
      return () => {
        const index = eventHandlers.indexOf(handler);
        if (index > -1) eventHandlers.splice(index, 1);
      };
    },
    
    getFreshnessMonitor(): FreshnessMonitor {
      return freshnessMonitor;
    },
    
    getStats(): WebhookStats {
      return { ...stats };
    },
    
    verifySignature(platform: CMSPlatform, payload: string, signature: string): boolean {
      if (!config.webhookSecret) {
        // No secret configured, skip verification
        return true;
      }
      
      // Platform-specific signature verification using HMAC
      return verifyWebhookSignature(platform, payload, signature, config.webhookSecret);
    }
  };
}
