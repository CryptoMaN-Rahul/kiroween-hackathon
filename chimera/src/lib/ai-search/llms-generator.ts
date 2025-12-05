/**
 * llms.txt Generator
 *
 * Generates a structured manifest file for AI agents to efficiently
 * discover and understand site content without crawling.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import {
  LLMsConfig,
  LLMsContent,
  RouteEntry,
  ApiEntry,
  PageContent,
} from './types';
import { hasStatistic } from './snippet-extractor';

// =============================================================================
// Constants
// =============================================================================

/** Default maximum number of quick facts to include */
export const DEFAULT_MAX_QUICK_FACTS = 10;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Splits content into sentences
 */
function splitIntoSentences(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }
  return content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Formats a date as ISO string
 */
function formatDate(date: Date): string {
  return date.toISOString();
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Extracts quick facts (sentences with statistics) from page content
 * Requirements: 1.5
 *
 * @param pages - Array of page content to analyze
 * @param maxFacts - Maximum number of facts to return
 * @returns Array of quick fact strings
 */
export function extractQuickFacts(pages: PageContent[], maxFacts: number = DEFAULT_MAX_QUICK_FACTS): string[] {
  const facts: string[] = [];

  for (const page of pages) {
    const sentences = splitIntoSentences(page.content);
    
    for (const sentence of sentences) {
      if (hasStatistic(sentence) && sentence.length > 20 && sentence.length < 200) {
        facts.push(sentence);
        
        if (facts.length >= maxFacts) {
          return facts;
        }
      }
    }
  }

  return facts;
}

/**
 * Formats routes for llms.txt output
 * Requirements: 1.3
 *
 * @param routes - Array of route entries
 * @returns Formatted string of routes
 */
export function formatRoutes(routes: RouteEntry[]): string {
  if (routes.length === 0) {
    return '';
  }

  return routes
    .map(route => `${route.path} - ${route.description}`)
    .join('\n');
}

/**
 * Formats API endpoints for llms.txt output
 * Requirements: 1.4
 *
 * @param endpoints - Array of API entries
 * @returns Formatted string of API endpoints
 */
export function formatApiEndpoints(endpoints: ApiEntry[]): string {
  if (endpoints.length === 0) {
    return '';
  }

  return endpoints
    .map(endpoint => `${endpoint.method} ${endpoint.path} - ${endpoint.description}`)
    .join('\n');
}

/**
 * Generates llms.txt content from configuration and pages
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * @param config - LLMs configuration
 * @param pages - Array of page content
 * @param routes - Array of route entries
 * @param apiEndpoints - Array of API entries (optional)
 * @returns Generated llms.txt content as string
 */
export function generate(
  config: LLMsConfig,
  pages: PageContent[],
  routes: RouteEntry[],
  apiEndpoints: ApiEntry[] = []
): string {
  const quickFacts = extractQuickFacts(pages, config.maxQuickFacts);
  const now = new Date();

  const sections: string[] = [];

  // Header section (Requirements: 1.2)
  sections.push(`# llms.txt - AI Agent Manifest for ${config.siteName}`);
  sections.push(`> ${config.siteDescription}`);
  sections.push('');

  // Quick Facts section (Requirements: 1.5)
  if (quickFacts.length > 0) {
    sections.push('## Quick Facts');
    for (const fact of quickFacts) {
      sections.push(`- ${fact}`);
    }
    sections.push('');
  }

  // Key Pages section (Requirements: 1.3)
  if (routes.length > 0) {
    sections.push('## Key Pages');
    sections.push(formatRoutes(routes));
    sections.push('');
  }

  // API Endpoints section (Requirements: 1.4)
  if (config.includeApiEndpoints && apiEndpoints.length > 0) {
    sections.push('## API Endpoints');
    sections.push(formatApiEndpoints(apiEndpoints));
    sections.push('');
  }

  // Last Updated section
  sections.push(`## Last Updated: ${formatDate(now)}`);

  return sections.join('\n');
}

/**
 * Creates LLMsContent object from configuration and pages
 *
 * @param config - LLMs configuration
 * @param pages - Array of page content
 * @param routes - Array of route entries
 * @param apiEndpoints - Array of API entries (optional)
 * @returns LLMsContent object
 */
export function createContent(
  config: LLMsConfig,
  pages: PageContent[],
  routes: RouteEntry[],
  apiEndpoints: ApiEntry[] = []
): LLMsContent {
  const quickFacts = extractQuickFacts(pages, config.maxQuickFacts);

  return {
    header: `# llms.txt - AI Agent Manifest for ${config.siteName}\n> ${config.siteDescription}`,
    quickFacts,
    routes,
    apiEndpoints: config.includeApiEndpoints ? apiEndpoints : [],
    lastGenerated: new Date(),
  };
}

// =============================================================================
// Factory Function
// =============================================================================

export interface LLMsGenerator {
  generate(config: LLMsConfig, pages: PageContent[], routes: RouteEntry[], apiEndpoints?: ApiEntry[]): string;
  extractQuickFacts(pages: PageContent[], maxFacts?: number): string[];
  formatRoutes(routes: RouteEntry[]): string;
}

/**
 * Creates an llms.txt generator instance
 */
export function createLLMsGenerator(): LLMsGenerator {
  return {
    generate,
    extractQuickFacts,
    formatRoutes,
  };
}
