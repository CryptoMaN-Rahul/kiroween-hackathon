/**
 * Generic CMS Webhook API Route
 * 
 * Accepts POST webhooks from any supported CMS platform.
 * Automatically updates freshness tracking and triggers content re-analysis.
 * 
 * @module api/webhooks/cms
 * 
 * Usage:
 * POST /api/webhooks/cms?platform=contentful
 * POST /api/webhooks/cms?platform=sanity
 * POST /api/webhooks/cms?platform=strapi
 * POST /api/webhooks/cms?platform=wordpress
 * POST /api/webhooks/cms?platform=custom
 * 
 * Headers:
 * - X-Webhook-Signature: Optional signature for verification
 * - Content-Type: application/json
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createCMSWebhookReceiver, 
  type CMSPlatform,
  type WebhookProcessingResult 
} from '@/lib/cms-webhook';

// Create a singleton webhook receiver instance
// In production, this would be configured via environment variables
const webhookReceiver = createCMSWebhookReceiver({
  autoAnalyze: true,
  autoGenerateSchema: true,
  freshness: {
    staleThresholdDays: 90,
    velocityWindowMonths: 3
  }
});

// Valid platforms
const VALID_PLATFORMS: CMSPlatform[] = ['contentful', 'sanity', 'strapi', 'wordpress', 'custom'];

/**
 * POST /api/webhooks/cms
 * 
 * Process incoming CMS webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Get platform from query parameter
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as CMSPlatform | null;
    
    if (!platform) {
      return NextResponse.json(
        { 
          error: 'Missing platform parameter',
          message: 'Please specify the CMS platform via ?platform=contentful|sanity|strapi|wordpress|custom'
        },
        { status: 400 }
      );
    }
    
    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { 
          error: 'Invalid platform',
          message: `Platform must be one of: ${VALID_PLATFORMS.join(', ')}`,
          received: platform
        },
        { status: 400 }
      );
    }
    
    // Get raw payload
    const rawPayload = await request.json();
    
    // Verify signature if provided
    const signature = request.headers.get('x-webhook-signature') || 
                      request.headers.get('x-contentful-signature') ||
                      request.headers.get('x-sanity-signature') ||
                      request.headers.get('x-strapi-signature') ||
                      '';
    
    if (signature) {
      const payloadString = JSON.stringify(rawPayload);
      const isValid = webhookReceiver.verifySignature(platform, payloadString, signature);
      
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }
    
    // Process the webhook
    const result: WebhookProcessingResult = await webhookReceiver.processWebhook(platform, rawPayload);
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          contentId: result.contentId,
          event: result.event,
          processingTimeMs: result.processingTimeMs
        },
        { status: 422 }
      );
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      contentId: result.contentId,
      event: result.event,
      actions: result.actions,
      analysis: result.analysis ? {
        factDensityScore: result.analysis.factDensity.score,
        justificationLevel: result.analysis.factDensity.justificationLevel,
        schemaGenerated: result.analysis.schema !== null,
        entityTypes: result.analysis.schema?.['@graph'].map(e => e['@type']) || []
      } : null,
      processingTimeMs: result.processingTimeMs,
      totalProcessingTimeMs: performance.now() - startTime
    });
    
  } catch (error) {
    console.error('[CMS Webhook] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/cms
 * 
 * Returns webhook receiver statistics and health status
 */
export async function GET(): Promise<NextResponse> {
  const stats = webhookReceiver.getStats();
  
  return NextResponse.json({
    status: 'healthy',
    supportedPlatforms: VALID_PLATFORMS,
    stats: {
      totalReceived: stats.totalReceived,
      totalProcessed: stats.totalProcessed,
      totalErrors: stats.totalErrors,
      successRate: stats.totalReceived > 0 
        ? Math.round((stats.totalProcessed / stats.totalReceived) * 100) 
        : 100,
      byPlatform: stats.byPlatform,
      byEvent: stats.byEvent,
      lastProcessedAt: stats.lastProcessedAt?.toISOString() || null
    },
    endpoints: {
      webhook: '/api/webhooks/cms?platform={platform}',
      contentful: '/api/webhooks/contentful',
      health: '/api/webhooks/cms'
    }
  });
}
