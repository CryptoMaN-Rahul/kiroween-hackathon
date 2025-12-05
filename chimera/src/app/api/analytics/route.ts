/**
 * Analytics API Route
 * 
 * Provides endpoints for sending GEO analytics events to GA4.
 * Supports both single event and batch event submission.
 * 
 * @module api/analytics
 * 
 * Usage:
 * POST /api/analytics - Send single or batch events
 * GET /api/analytics - Get analytics configuration status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createGA4Integration,
  createAnalyticsBuffer,
  type GEOAnalyticsEvent,
  type GA4Config
} from '@/lib/analytics-integration';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get GA4 configuration from environment variables
 */
function getGA4Config(): GA4Config | null {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  
  if (!measurementId || !apiSecret) {
    return null;
  }
  
  return {
    measurementId,
    apiSecret,
    debug: process.env.GA4_DEBUG === 'true',
    defaultClientId: process.env.GA4_DEFAULT_CLIENT_ID
  };
}

// Lazy-initialized GA4 integration
let ga4Integration: ReturnType<typeof createGA4Integration> | null = null;
let analyticsBuffer: ReturnType<typeof createAnalyticsBuffer> | null = null;

function getGA4Integration() {
  if (!ga4Integration) {
    const config = getGA4Config();
    if (config) {
      ga4Integration = createGA4Integration(config);
      analyticsBuffer = createAnalyticsBuffer(ga4Integration, {
        maxSize: 50,
        flushIntervalMs: 10000 // 10 seconds
      });
    }
  }
  return { ga4: ga4Integration, buffer: analyticsBuffer };
}

// =============================================================================
// Request/Response Types
// =============================================================================

interface AnalyticsRequest {
  /** Single event or array of events */
  events: GEOAnalyticsEvent | GEOAnalyticsEvent[];
  /** Whether to use buffered sending */
  buffered?: boolean;
}

interface AnalyticsResponse {
  success: boolean;
  data?: {
    eventCount: number;
    buffered: boolean;
    validationMessages?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// API Handlers
// =============================================================================

/**
 * POST /api/analytics
 * 
 * Send GEO analytics events to GA4
 * 
 * Request body:
 * {
 *   "events": GEOAnalyticsEvent | GEOAnalyticsEvent[],
 *   "buffered": boolean (optional, default: false)
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyticsResponse>> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  try {
    // Check if GA4 is configured
    const { ga4, buffer } = getGA4Integration();
    
    if (!ga4) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Google Analytics 4 is not configured',
          details: [
            'Set GA4_MEASUREMENT_ID environment variable',
            'Set GA4_API_SECRET environment variable'
          ]
        },
        meta: { timestamp, requestId }
      }, { status: 503 });
    }
    
    // Parse request body
    const body = await request.json() as AnalyticsRequest;
    
    if (!body.events) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: events',
          details: ['Request body must include "events" field']
        },
        meta: { timestamp, requestId }
      }, { status: 400 });
    }
    
    // Normalize to array
    const events = Array.isArray(body.events) ? body.events : [body.events];
    
    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          eventCount: 0,
          buffered: false
        },
        meta: { timestamp, requestId }
      });
    }
    
    // Validate events have required fields
    for (const event of events) {
      if (!event.event_name || !event.category || !event.action) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid event format',
            details: [
              'Each event must have: event_name, category, action',
              `Invalid event: ${JSON.stringify(event).substring(0, 100)}...`
            ]
          },
          meta: { timestamp, requestId }
        }, { status: 400 });
      }
    }
    
    // Send events
    if (body.buffered && buffer) {
      // Add to buffer for batched sending
      for (const event of events) {
        buffer.push(event);
      }
      
      return NextResponse.json({
        success: true,
        data: {
          eventCount: events.length,
          buffered: true
        },
        meta: { timestamp, requestId }
      });
    } else {
      // Send immediately
      const result = await ga4.sendEvents(events);
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'SEND_FAILED',
            message: 'Failed to send events to GA4',
            details: result.error ? [result.error] : undefined
          },
          meta: { timestamp, requestId }
        }, { status: 502 });
      }
      
      return NextResponse.json({
        success: true,
        data: {
          eventCount: result.eventCount,
          buffered: false,
          validationMessages: result.validationMessages
        },
        meta: { timestamp, requestId }
      });
    }
    
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process analytics request',
        details: [error instanceof Error ? error.message : 'Unknown error']
      },
      meta: { timestamp, requestId }
    }, { status: 500 });
  }
}

/**
 * GET /api/analytics
 * 
 * Returns analytics configuration status and buffer statistics
 */
export async function GET(): Promise<NextResponse> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  const config = getGA4Config();
  const { buffer } = getGA4Integration();
  
  return NextResponse.json({
    success: true,
    data: {
      configured: config !== null,
      measurementId: config?.measurementId ? `${config.measurementId.substring(0, 4)}...` : null,
      debugMode: config?.debug ?? false,
      buffer: buffer ? {
        size: buffer.size(),
        maxSize: 50,
        flushIntervalMs: 10000
      } : null,
      supportedEvents: [
        'geo_page_analyzed',
        'geo_route_redirected',
        'geo_route_not_found',
        'geo_citation_discovered',
        'geo_schema_generated',
        'geo_agent_detected',
        'geo_content_stale',
        'geo_content_fresh'
      ],
      eventCategories: [
        'page_analysis',
        'route_resolution',
        'citation_discovery',
        'schema_generation',
        'content_transformation',
        'freshness_check',
        'agent_detection'
      ]
    },
    meta: { timestamp, requestId }
  });
}

/**
 * DELETE /api/analytics
 * 
 * Flush the analytics buffer immediately
 */
export async function DELETE(): Promise<NextResponse> {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();
  
  const { buffer } = getGA4Integration();
  
  if (!buffer) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Analytics buffer not available'
      },
      meta: { timestamp, requestId }
    }, { status: 503 });
  }
  
  const result = await buffer.flush();
  
  return NextResponse.json({
    success: result.success,
    data: {
      flushedCount: result.eventCount,
      error: result.error
    },
    meta: { timestamp, requestId }
  });
}
