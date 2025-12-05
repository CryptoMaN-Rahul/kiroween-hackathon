/**
 * AI Manifest Generator
 *
 * Generates a machine-readable JSON manifest of site capabilities
 * for AI agents to programmatically understand what the site offers.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import {
  AIManifest,
  ManifestConfig,
  ManifestRoute,
  Intent,
  Entity,
  PageContent,
} from './types';

// =============================================================================
// Intent Detection Patterns
// =============================================================================

/** Patterns for detecting user intents from page content */
const INTENT_PATTERNS: { pattern: RegExp; intent: string; description: string }[] = [
  { pattern: /buy|purchase|shop|order|cart|checkout/i, intent: 'purchase', description: 'Buy products or services' },
  { pattern: /contact|support|help|email|call|reach/i, intent: 'contact', description: 'Get in touch or request support' },
  { pattern: /learn|guide|tutorial|how.?to|documentation/i, intent: 'learn', description: 'Learn about features or concepts' },
  { pattern: /sign.?up|register|create.?account|join/i, intent: 'signup', description: 'Create a new account' },
  { pattern: /login|sign.?in|authenticate/i, intent: 'login', description: 'Access existing account' },
  { pattern: /search|find|browse|explore/i, intent: 'search', description: 'Find specific content or products' },
  { pattern: /compare|versus|vs|difference/i, intent: 'compare', description: 'Compare options or features' },
  { pattern: /pricing|cost|price|plan|subscription/i, intent: 'pricing', description: 'View pricing information' },
  { pattern: /download|install|get.?started/i, intent: 'download', description: 'Download or install software' },
  { pattern: /demo|trial|free/i, intent: 'trial', description: 'Try before buying' },
];

/** Patterns for detecting entities from page content */
const ENTITY_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /product|item|goods/i, type: 'Product' },
  { pattern: /service|solution|platform/i, type: 'Service' },
  { pattern: /user|customer|client|member/i, type: 'Person' },
  { pattern: /company|organization|business|team/i, type: 'Organization' },
  { pattern: /article|post|blog|content/i, type: 'Article' },
  { pattern: /event|webinar|conference|meeting/i, type: 'Event' },
  { pattern: /location|address|office|store/i, type: 'Place' },
  { pattern: /api|endpoint|integration/i, type: 'SoftwareApplication' },
];

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Extracts intents from page content
 * Requirements: 5.3
 *
 * @param pages - Array of page content to analyze
 * @returns Array of detected intents
 */
export function extractIntents(pages: PageContent[]): Intent[] {
  const detectedIntents = new Map<string, Intent>();

  for (const page of pages) {
    const combinedContent = `${page.title} ${page.description} ${page.content}`;

    for (const { pattern, intent, description } of INTENT_PATTERNS) {
      if (pattern.test(combinedContent) && !detectedIntents.has(intent)) {
        detectedIntents.set(intent, {
          name: intent,
          description,
          examples: generateIntentExamples(intent),
        });
      }
    }
  }

  return Array.from(detectedIntents.values());
}

/**
 * Generates example phrases for an intent
 */
function generateIntentExamples(intent: string): string[] {
  const examples: Record<string, string[]> = {
    purchase: ['I want to buy', 'Add to cart', 'Purchase now'],
    contact: ['How do I contact support?', 'Get help', 'Reach out'],
    learn: ['How does this work?', 'Show me a tutorial', 'Documentation'],
    signup: ['Create an account', 'Sign up for free', 'Register now'],
    login: ['Sign in to my account', 'Login', 'Access my dashboard'],
    search: ['Find products', 'Search for', 'Browse catalog'],
    compare: ['Compare plans', 'What is the difference?', 'Which is better?'],
    pricing: ['How much does it cost?', 'View pricing', 'Subscription plans'],
    download: ['Download the app', 'Install now', 'Get started'],
    trial: ['Start free trial', 'Try for free', 'Demo request'],
  };

  return examples[intent] || [`Use ${intent}`, `${intent} action`];
}

/**
 * Extracts entities from page content
 * Requirements: 5.4
 *
 * @param pages - Array of page content to analyze
 * @returns Array of detected entities
 */
export function extractEntities(pages: PageContent[]): Entity[] {
  const detectedEntities = new Map<string, Entity>();

  for (const page of pages) {
    const combinedContent = `${page.title} ${page.description} ${page.content}`;

    for (const { pattern, type } of ENTITY_PATTERNS) {
      if (pattern.test(combinedContent)) {
        // Find specific entity names from headings or title
        const entityName = page.headings[0] || page.title.split(' ').slice(0, 3).join(' ');
        const key = `${type}-${entityName}`;

        if (!detectedEntities.has(key)) {
          detectedEntities.set(key, {
            name: entityName,
            type,
            description: `${type} found on ${page.url}`,
          });
        }
      }
    }
  }

  return Array.from(detectedEntities.values());
}

/**
 * Generates AI manifest from configuration and pages
 * Requirements: 5.1, 5.2, 5.3, 5.4
 *
 * @param config - Manifest configuration
 * @param pages - Array of page content
 * @param routes - Array of manifest routes (optional)
 * @returns AIManifest object
 */
export function generate(
  config: ManifestConfig,
  pages: PageContent[],
  routes: ManifestRoute[] = []
): AIManifest {
  const intents = extractIntents(pages);
  const entities = extractEntities(pages);

  // Generate routes from pages if not provided
  const manifestRoutes: ManifestRoute[] = routes.length > 0
    ? routes
    : pages.map(page => ({
        path: new URL(page.url).pathname,
        description: page.description,
      }));

  return {
    name: config.siteName,
    description: config.siteDescription,
    version: config.version,
    capabilities: config.capabilities,
    routes: manifestRoutes,
    intents,
    entities,
    lastUpdated: new Date().toISOString(),
  };
}

// =============================================================================
// Factory Function
// =============================================================================

export interface ManifestGenerator {
  generate(config: ManifestConfig, pages: PageContent[], routes?: ManifestRoute[]): AIManifest;
  extractIntents(pages: PageContent[]): Intent[];
  extractEntities(pages: PageContent[]): Entity[];
}

/**
 * Creates a manifest generator instance
 */
export function createManifestGenerator(): ManifestGenerator {
  return {
    generate,
    extractIntents,
    extractEntities,
  };
}
