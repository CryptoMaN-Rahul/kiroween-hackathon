/**
 * Contentful Webhook API Route
 * 
 * Dedicated webhook handler for Contentful CMS.
 * Provides Contentful-specific payload handling and signature verification.
 * 
 * @module api/webhooks/contentful
 * 
 * Setup in Contentful:
 * 1. Go to Settings > Webhooks
 * 2. Create new webhook with URL: https://your-domain.com/api/webhooks/contentful
 * 3. Select events: Entry.create, Entry.save, Entry.publish, Entry.unpublish, Entry.delete
 * 4. Add secret header: X-Contentful-Signature
 * 
 * Headers sent by Contentful:
 * - X-Contentful-Topic: Entry.publish, Entry.save, etc.
 * - X-Contentful-Webhook-Name: Your webhook name
 * - Content-Type: application/vnd.contentful.management.v1+json
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createCMSWebhookReceiver,
  normalizeContentfulPayload,
  type ContentfulWebhookPayload,
  type WebhookProcessingResult
} from '@/lib/cms-webhook';
import { createChimeraSDK } from '@/lib/sdk';

// Create dedicated Contentful webhook receiver
const contentfulReceiver = createCMSWebhookReceiver({
  autoAnalyze: true,
  autoGenerateSchema: true,
  allowedPlatforms: ['contentful'],
  freshness: {
    staleThresholdDays: 90,
    velocityWindowMonths: 3
  },
  // Custom handlers for Contentful-specific logic
  handlers: {
    'content.published': async (payload) => {
      // Custom logic when content is published
      console.log(`[Contentful] Content published: ${payload.contentId} - ${payload.title}`);
    },
    'content.deleted': async (payload) => {
      // Custom logic when content is deleted
      console.log(`[Contentful] Content deleted: ${payload.contentId}`);
    }
  }
});

// SDK instance for advanced analysis
const sdk = createChimeraSDK({
  analysis: { enableCache: true }
});

/**
 * Extract rich content from Contentful Rich Text fields
 */
function extractRichTextContent(richText: ContentfulRichText | undefined): string {
  if (!richText || !richText.content) return '';
  
  const extractText = (nodes: ContentfulRichTextNode[]): string => {
    return nodes.map(node => {
      if (node.nodeType === 'text') {
        return node.value || '';
      }
      if (node.content) {
        return extractText(node.content);
      }
      return '';
    }).join(' ');
  };
  
  return extractText(richText.content);
}

interface ContentfulRichText {
  nodeType: string;
  content?: ContentfulRichTextNode[];
}

interface ContentfulRichTextNode {
  nodeType: string;
  value?: string;
  content?: ContentfulRichTextNode[];
}

/**
 * Enhanced Contentful payload normalization with rich text support
 */
function enhancedNormalize(rawPayload: ContentfulWebhookPayload): ReturnType<typeof normalizeContentfulPayload> {
  const base = normalizeContentfulPayload(rawPayload);
  
  // Try to extract rich text content if body is a rich text field
  const fields = rawPayload.fields || {};
  const locale = Object.keys(fields.body || fields.content || {})[0] || 'en-US';
  const bodyField = fields.body?.[locale] || fields.content?.[locale];
  
  if (bodyField && typeof bodyField === 'object' && 'nodeType' in bodyField) {
    base.content = extractRichTextContent(bodyField as ContentfulRichText);
  }
  
  return base;
}

/**
 * POST /api/webhooks/contentful
 * 
 * Process incoming Contentful webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Get Contentful-specific headers
    const topic = request.headers.get('x-contentful-topic') || '';
    const webhookName = request.headers.get('x-contentful-webhook-name') || '';
    const signature = request.headers.get('x-contentful-signature') || '';
    
    // Parse payload
    const rawPayload = await request.json() as ContentfulWebhookPayload;
    
    // Add topic to payload for proper event mapping
    rawPayload.topic = topic;
    
    // Verify signature if configured
    if (signature && process.env.CONTENTFUL_WEBHOOK_SECRET) {
      const payloadString = JSON.stringify(rawPayload);
      const isValid = contentfulReceiver.verifySignature('contentful', payloadString, signature);
      
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid Contentful webhook signature' },
          { status: 401 }
        );
      }
    }
    
    // Normalize with enhanced rich text support
    const normalized = enhancedNormalize(rawPayload);
    
    // Process the webhook
    const result: WebhookProcessingResult = await contentfulReceiver.processNormalizedPayload(normalized);
    
    // Run additional SDK analysis if content is available
    let advancedAnalysis = null;
    if (result.success && normalized.content && normalized.path) {
      try {
        const pageAnalysis = sdk.analyzePage({
          url: normalized.path,
          content: normalized.content,
          lastModified: normalized.lastModified
        });
        
        advancedAnalysis = {
          informationGain: pageAnalysis.informationGain.score,
          invertedPyramid: pageAnalysis.invertedPyramid.score,
          fluffScore: pageAnalysis.fluffScore,
          listicleSuitable: pageAnalysis.listicleSuitability.suitable,
          suggestedFormat: pageAnalysis.listicleSuitability.format
        };
      } catch (e) {
        console.error('[Contentful] Advanced analysis failed:', e);
      }
    }
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          contentId: result.contentId,
          event: result.event,
          topic,
          webhookName
        },
        { status: 422 }
      );
    }
    
    // Return success response with Contentful-specific details
    return NextResponse.json({
      success: true,
      platform: 'contentful',
      contentId: result.contentId,
      contentType: normalized.contentType,
      event: result.event,
      topic,
      webhookName,
      path: normalized.path,
      title: normalized.title,
      actions: result.actions,
      analysis: result.analysis ? {
        factDensityScore: result.analysis.factDensity.score,
        justificationLevel: result.analysis.factDensity.justificationLevel,
        suggestions: result.analysis.factDensity.suggestions.length,
        schemaGenerated: result.analysis.schema !== null,
        entityTypes: result.analysis.schema?.['@graph'].map(e => e['@type']) || []
      } : null,
      advancedAnalysis,
      processingTimeMs: result.processingTimeMs,
      totalProcessingTimeMs: performance.now() - startTime
    });
    
  } catch (error) {
    console.error('[Contentful Webhook] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process Contentful webhook',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/contentful
 * 
 * Returns Contentful webhook configuration and statistics
 */
export async function GET(): Promise<NextResponse> {
  const stats = contentfulReceiver.getStats();
  
  return NextResponse.json({
    status: 'healthy',
    platform: 'contentful',
    stats: {
      totalReceived: stats.totalReceived,
      totalProcessed: stats.totalProcessed,
      totalErrors: stats.totalErrors,
      successRate: stats.totalReceived > 0 
        ? Math.round((stats.totalProcessed / stats.totalReceived) * 100) 
        : 100,
      byEvent: stats.byEvent,
      lastProcessedAt: stats.lastProcessedAt?.toISOString() || null
    },
    configuration: {
      autoAnalyze: true,
      autoGenerateSchema: true,
      staleThresholdDays: 90
    },
    setup: {
      webhookUrl: '/api/webhooks/contentful',
      requiredHeaders: [
        'X-Contentful-Topic',
        'X-Contentful-Webhook-Name'
      ],
      optionalHeaders: [
        'X-Contentful-Signature'
      ],
      supportedEvents: [
        'Entry.create',
        'Entry.save',
        'Entry.publish',
        'Entry.unpublish',
        'Entry.delete'
      ],
      contentfulSetup: {
        step1: 'Go to Settings > Webhooks in Contentful',
        step2: 'Create new webhook',
        step3: 'Set URL to: https://your-domain.com/api/webhooks/contentful',
        step4: 'Select events: Entry.create, Entry.save, Entry.publish, Entry.unpublish, Entry.delete',
        step5: 'Optional: Add X-Contentful-Signature header with secret'
      }
    }
  });
}
