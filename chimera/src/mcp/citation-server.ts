#!/usr/bin/env node
/**
 * Chimera Citation Monitor MCP Server
 * 
 * Provides tools for brand mention tracking, GEO score calculation,
 * and content optimization recommendations.
 * 
 * Tools:
 * - scan_citations: Scan for brand mentions across the web
 * - calculate_geo_score: Calculate GEO Health Score from components
 * - analyze_content_scannability: Analyze content for AI scannability
 * - generate_schema: Generate JSON-LD structured data
 * - build_topic_clusters: Analyze content relationships
 * - get_citation_stats: Get current citation statistics
 * 
 * @module mcp/citation-server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import existing lib functions
import { 
  scanForCitations, 
  calculateGEOScore, 
  getCitations,
  getCitationStats,
  sortCitations
} from '../lib/citation-monitor.js';
import { analyze, calculateInformationGain, scoreInvertedPyramid } from '../lib/fact-density-analyzer.js';
import { generateFromContent, serialize, validateSchema } from '../lib/schema-generator.js';
import { buildTopicMap } from '../lib/topic-mapper.js';
import { analyzeFreshness } from '../lib/freshness-monitor.js';
import { detectListicleSuitability, transformToRoundup } from '../lib/content-transformer.js';
import { getEngineConfig, getOptimizationRecommendations } from '../lib/engine-optimizer.js';
import { createChimeraSDK } from '../lib/sdk.js';

/**
 * Citation Monitor MCP Server
 * 
 * Provides comprehensive GEO optimization tools for Kiro agents.
 */
class CitationMonitorServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'chimera-citation-monitor',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scan_citations',
            description: 'Scan for brand mentions and citations across the web. Returns found citations with source URLs, domains, sentiment analysis, and domain authority scores.',
            inputSchema: {
              type: 'object',
              properties: {
                brandTerms: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Brand terms to search for (e.g., ["Chimera", "AI-First Edge"])'
                },
                scanIntervalHours: {
                  type: 'number',
                  description: 'Hours between scans (default: 24)',
                  default: 24
                }
              },
              required: ['brandTerms']
            }
          },
          {
            name: 'calculate_geo_score',
            description: 'Calculate comprehensive GEO Health Score from component metrics. Returns overall score (0-100) with breakdown and recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                routeHealth: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Route health score (0-100) - measures 404 interception success'
                },
                contentScannability: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Content scannability score (0-100) - measures AI-readable content'
                },
                schemaCoverage: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Schema coverage percentage (0-100) - measures JSON-LD presence'
                },
                citationAuthority: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Citation authority score (0-100) - measures earned media strength'
                }
              },
              required: ['routeHealth', 'contentScannability', 'schemaCoverage', 'citationAuthority']
            }
          },
          {
            name: 'analyze_content_scannability',
            description: 'Analyze content for AI scannability and provide optimization suggestions. Returns scannability score, breakdown of structured elements, and actionable suggestions.',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Content to analyze (markdown or HTML)'
                },
                url: {
                  type: 'string',
                  description: 'Optional URL for context'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'generate_schema',
            description: 'Auto-generate JSON-LD structured data from content. Detects entities (Product, Article, Organization, Person, FAQ) and generates valid Schema.org markup.',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Page content to analyze'
                },
                pageUrl: {
                  type: 'string',
                  description: 'URL of the page (used for @id references)'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'build_topic_clusters',
            description: 'Analyze content relationships and build topic clusters. Identifies semantic connections between pages, finds orphan pages, and suggests internal linking opportunities.',
            inputSchema: {
              type: 'object',
              properties: {
                pages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      path: { type: 'string', description: 'Page path (e.g., "/products/iphone")' },
                      title: { type: 'string', description: 'Page title' },
                      content: { type: 'string', description: 'Page content' }
                    },
                    required: ['path', 'title', 'content']
                  },
                  description: 'Array of pages to analyze'
                }
              },
              required: ['pages']
            }
          },
          {
            name: 'get_citation_stats',
            description: 'Get current citation statistics and metrics. Returns total citations, earned vs owned media breakdown, sentiment analysis, and average domain authority.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          // NEW TOOLS (Phase 8)
          {
            name: 'analyze_freshness',
            description: 'Analyze content freshness and staleness. Returns age in days, staleness flag, refresh priority, and recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Page path to analyze' },
                lastModified: { type: 'string', description: 'ISO date of last modification' }
              },
              required: ['path', 'lastModified']
            }
          },
          {
            name: 'detect_listicle_opportunity',
            description: 'Detect if content is suitable for AI-preferred listicle formats (roundups, comparisons, Top N lists).',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Content to analyze' }
              },
              required: ['content']
            }
          },
          {
            name: 'analyze_information_gain',
            description: 'Score content for information density and unique facts vs commodity phrases.',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Content to analyze' }
              },
              required: ['content']
            }
          },
          {
            name: 'check_inverted_pyramid',
            description: 'Check if content follows inverted pyramid structure with key information front-loaded.',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Content to analyze' }
              },
              required: ['content']
            }
          },
          {
            name: 'get_engine_recommendations',
            description: 'Get AI engine-specific optimization recommendations for Claude, GPT, Perplexity, or Gemini.',
            inputSchema: {
              type: 'object',
              properties: {
                engine: { type: 'string', enum: ['claude', 'gpt', 'perplexity', 'gemini'], description: 'Target AI engine' },
                hasEarnedMedia: { type: 'boolean', description: 'Whether content has earned media citations' },
                isListicle: { type: 'boolean', description: 'Whether content is in listicle format' },
                ageInDays: { type: 'number', description: 'Content age in days' }
              },
              required: ['engine', 'hasEarnedMedia', 'isListicle', 'ageInDays']
            }
          },
          {
            name: 'full_page_analysis',
            description: 'Run comprehensive GEO analysis on a page. Returns fact density, information gain, inverted pyramid, schema, freshness, and overall recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'Page URL' },
                content: { type: 'string', description: 'Page content (HTML or markdown)' },
                lastModified: { type: 'string', description: 'ISO date of last modification (optional)' }
              },
              required: ['url', 'content']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scan_citations': {
            const { brandTerms, scanIntervalHours = 24 } = args as {
              brandTerms: string[];
              scanIntervalHours?: number;
            };
            
            const citations = await scanForCitations({ 
              brandTerms, 
              scanIntervalHours 
            });
            
            const sortedCitations = sortCitations(citations);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Found ${citations.length} citations for brand terms: ${brandTerms.join(', ')}`,
                    citationsFound: citations.length,
                    citations: sortedCitations.map(c => ({
                      sourceUrl: c.sourceUrl,
                      sourceDomain: c.sourceDomain,
                      sentiment: c.sentiment,
                      domainAuthority: c.domainAuthority,
                      isEarnedMedia: c.isEarnedMedia,
                      mentionContext: c.mentionContext.substring(0, 200) + '...',
                      discoveredAt: c.discoveredAt.toISOString()
                    }))
                  }, null, 2)
                }
              ]
            };
          }

          case 'calculate_geo_score': {
            const components = args as {
              routeHealth: number;
              contentScannability: number;
              schemaCoverage: number;
              citationAuthority: number;
            };
            
            // Validate and clamp input values to 0-100 range
            const clamp = (v: number) => Math.max(0, Math.min(100, v));
            const validatedComponents = {
              routeHealth: clamp(components.routeHealth),
              contentScannability: clamp(components.contentScannability),
              schemaCoverage: clamp(components.schemaCoverage),
              citationAuthority: clamp(components.citationAuthority)
            };
            
            const geoScore = calculateGEOScore(validatedComponents);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `GEO Health Score: ${geoScore.overall}/100`,
                    geoHealthScore: {
                      overall: geoScore.overall,
                      components: geoScore.components,
                      recommendations: geoScore.recommendations,
                      calculatedAt: geoScore.calculatedAt.toISOString()
                    },
                    interpretation: geoScore.overall >= 80 ? 'Excellent - Your site is well-optimized for AI agents' :
                                   geoScore.overall >= 60 ? 'Good - Some improvements recommended' :
                                   geoScore.overall >= 40 ? 'Fair - Significant improvements needed' :
                                   'Poor - Critical optimization required'
                  }, null, 2)
                }
              ]
            };
          }

          case 'analyze_content_scannability': {
            const { content, url } = args as {
              content: string;
              url?: string;
            };
            
            const analysis = analyze(content);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Scannability Score: ${(analysis.score * 100).toFixed(0)}%`,
                    url: url,
                    scannabilityScore: analysis.score,
                    scorePercentage: `${(analysis.score * 100).toFixed(0)}%`,
                    breakdown: {
                      tables: analysis.breakdown.tables,
                      bulletLists: analysis.breakdown.bulletLists,
                      statistics: analysis.breakdown.statistics,
                      headers: analysis.breakdown.headers,
                      headerHierarchyValid: analysis.breakdown.headerHierarchyValid
                    },
                    justificationLevel: analysis.justificationLevel,
                    suggestions: analysis.suggestions.map(s => ({
                      type: s.type,
                      message: s.message,
                      autoFixAvailable: s.autoFixAvailable
                    })),
                    needsImprovement: analysis.score < 0.5
                  }, null, 2)
                }
              ]
            };
          }

          case 'generate_schema': {
            const { content, pageUrl } = args as {
              content: string;
              pageUrl?: string;
            };
            
            const schema = generateFromContent(content, pageUrl);
            const validation = validateSchema(schema);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Generated JSON-LD schema with ${schema['@graph'].length} entities`,
                    entitiesDetected: schema['@graph'].map(e => e['@type']),
                    schema: schema,
                    validation: {
                      valid: validation.valid,
                      errors: validation.errors
                    },
                    scriptTag: `<script type="application/ld+json">\n${serialize(schema)}\n</script>`,
                    usage: 'Add the scriptTag to your page <head> or before </body>'
                  }, null, 2)
                }
              ]
            };
          }

          case 'build_topic_clusters': {
            const { pages } = args as {
              pages: Array<{ path: string; title: string; content: string }>;
            };
            
            const topicMap = buildTopicMap(pages);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Analyzed ${pages.length} pages, found ${topicMap.clusters.length} clusters and ${topicMap.orphanPages.length} orphan pages`,
                    summary: {
                      totalPages: pages.length,
                      totalClusters: topicMap.clusters.length,
                      totalRelationships: topicMap.relationships.length,
                      orphanPages: topicMap.orphanPages.length
                    },
                    clusters: topicMap.clusters.map(c => ({
                      id: c.id,
                      name: c.name,
                      pageCount: c.pages.length,
                      pages: c.pages,
                      centralPage: c.centralPage
                    })),
                    orphanPages: topicMap.orphanPages,
                    relationships: topicMap.relationships.slice(0, 20).map(r => ({
                      source: r.sourcePath,
                      target: r.targetPath,
                      similarity: r.similarity.toFixed(2),
                      sharedTopics: r.sharedTopics.slice(0, 5)
                    })),
                    recommendations: topicMap.orphanPages.length > 0 
                      ? [`${topicMap.orphanPages.length} orphan pages need to be integrated into topic clusters`]
                      : ['All pages are well-connected in topic clusters']
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_citation_stats': {
            const stats = getCitationStats();
            const allCitations = getCitations();
            const sortedCitations = sortCitations(allCitations);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Citation Statistics: ${stats.total} total citations`,
                    stats: {
                      total: stats.total,
                      earnedMedia: stats.earnedMedia,
                      ownedMedia: stats.ownedMedia,
                      sentimentBreakdown: stats.bySentiment,
                      averageAuthority: stats.averageAuthority
                    },
                    recentCitations: sortedCitations.slice(0, 5).map(c => ({
                      sourceDomain: c.sourceDomain,
                      sentiment: c.sentiment,
                      domainAuthority: c.domainAuthority,
                      isEarnedMedia: c.isEarnedMedia
                    })),
                    insights: [
                      stats.earnedMedia > stats.ownedMedia 
                        ? 'Good earned media ratio - AI search engines will favor your content'
                        : 'Consider building more earned media through PR and content marketing',
                      stats.averageAuthority >= 70 
                        ? 'High average domain authority - strong citation network'
                        : 'Focus on getting mentions from higher authority domains'
                    ]
                  }, null, 2)
                }
              ]
            };
          }

          // NEW TOOL HANDLERS (Phase 8)
          case 'analyze_freshness': {
            const { path, lastModified } = args as { path: string; lastModified: string };
            const parsedDate = new Date(lastModified);
            
            // Validate date
            if (isNaN(parsedDate.getTime())) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Invalid date format: "${lastModified}". Please use ISO 8601 format (e.g., "2024-01-15T10:00:00Z")`,
                    tool: 'analyze_freshness'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
            const result = analyzeFreshness(path, parsedDate);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: result.isStale 
                    ? `⚠️ Content is STALE (${result.ageInDays} days old)`
                    : `✅ Content is FRESH (${result.ageInDays} days old)`,
                  freshness: {
                    path: result.path,
                    ageInDays: result.ageInDays,
                    isStale: result.isStale,
                    refreshPriority: result.refreshPriority,
                    velocity: result.velocity
                  },
                  recommendations: result.isStale ? [
                    'Update content with recent information',
                    'Add dateModified schema property',
                    'Consider adding "Last updated" visible timestamp'
                  ] : [
                    'Content freshness is good',
                    'Continue regular update schedule'
                  ]
                }, null, 2)
              }]
            };
          }

          case 'detect_listicle_opportunity': {
            const { content } = args as { content: string };
            const suitability = detectListicleSuitability(content);
            const transformation = transformToRoundup(content);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: suitability.suitable 
                    ? `✅ Content suitable for ${suitability.format} format (${Math.round(suitability.confidence * 100)}% confidence)`
                    : '❌ Content not ideal for listicle transformation',
                  analysis: {
                    suitable: suitability.suitable,
                    suggestedFormat: suitability.format,
                    confidence: suitability.confidence,
                    itemsExtracted: transformation.itemsExtracted
                  },
                  preview: transformation.itemsExtracted > 0 
                    ? transformation.transformed.substring(0, 300) + '...'
                    : null,
                  recommendations: suitability.suitable ? [
                    `Transform to ${suitability.format} format for better AI scannability`,
                    'Add numbered lists or bullet points',
                    'Include comparison tables if applicable'
                  ] : [
                    'Add more structured elements (lists, tables)',
                    'Break content into scannable sections',
                    'Consider adding pros/cons or comparison data'
                  ]
                }, null, 2)
              }]
            };
          }

          case 'analyze_information_gain': {
            const { content } = args as { content: string };
            
            // Handle empty content
            if (!content || content.trim().length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Information Gain Score: 0/100 (no content)',
                    analysis: {
                      score: 0,
                      uniqueEntities: [],
                      uniqueEntityCount: 0,
                      commodityPhrasePercentage: 0,
                      commodityPhrases: []
                    },
                    interpretation: '⚠️ No content provided for analysis',
                    recommendations: ['Add content to analyze information gain']
                  }, null, 2)
                }]
              };
            }
            
            const result = calculateInformationGain(content);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Information Gain Score: ${result.score}/100`,
                  analysis: {
                    score: result.score,
                    uniqueEntities: result.uniqueEntities.slice(0, 20),
                    uniqueEntityCount: result.uniqueEntities.length,
                    commodityPhrasePercentage: result.commodityPhrasePercentage,
                    commodityPhrases: result.commodityPhrases.slice(0, 10)
                  },
                  interpretation: result.score >= 60 
                    ? '✅ High information density - valuable for AI agents'
                    : result.score >= 30
                    ? '⚠️ Moderate information gain - room for improvement'
                    : '❌ Low information gain - content may be too generic',
                  recommendations: result.score < 60 ? [
                    'Add specific statistics and numbers',
                    'Include technical details and specifications',
                    'Replace generic phrases with concrete facts',
                    'Add expert quotes or citations',
                    result.commodityPhrasePercentage > 10 ? 'Reduce commodity phrases like "in today\'s world"' : null
                  ].filter(Boolean) : ['Content has good information density']
                }, null, 2)
              }]
            };
          }

          case 'check_inverted_pyramid': {
            const { content } = args as { content: string };
            
            // Handle empty content
            if (!content || content.trim().length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Inverted Pyramid Score: N/A (no content)',
                    analysis: {
                      score: 0,
                      answerPosition: 0,
                      isOptimal: false,
                      positionDescription: 'No content to analyze'
                    },
                    interpretation: '⚠️ No content provided for analysis',
                    recommendations: ['Add content to analyze inverted pyramid structure']
                  }, null, 2)
                }]
              };
            }
            
            const result = scoreInvertedPyramid(content);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Inverted Pyramid Score: ${result.score}/100`,
                  analysis: {
                    score: result.score,
                    answerPosition: result.answerPosition,
                    isOptimal: result.isOptimal,
                    positionDescription: result.answerPosition <= 50 
                      ? 'Key info in first 50 words (excellent)'
                      : result.answerPosition <= 100
                      ? 'Key info in first 100 words (good)'
                      : `Key info at word ${result.answerPosition} (needs improvement)`
                  },
                  interpretation: result.score >= 70
                    ? '✅ Excellent structure - key info is front-loaded'
                    : result.score >= 40
                    ? '⚠️ Good structure but could improve'
                    : '❌ Poor structure - key info buried too deep',
                  recommendations: result.score < 70 ? [
                    'Move key facts and conclusions to the first paragraph',
                    'Lead with the most important information',
                    'Put supporting details and background later',
                    'Ensure the first 50-100 words answer the main question'
                  ] : ['Structure is well-optimized for AI extraction']
                }, null, 2)
              }]
            };
          }

          case 'get_engine_recommendations': {
            const { engine, hasEarnedMedia, isListicle, ageInDays } = args as {
              engine: string;
              hasEarnedMedia: boolean;
              isListicle: boolean;
              ageInDays: number;
            };
            
            // Validate engine type
            const validEngines = ['claude', 'gpt', 'perplexity', 'gemini'];
            if (!validEngines.includes(engine)) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Invalid engine: "${engine}". Valid options are: ${validEngines.join(', ')}`,
                    tool: 'get_engine_recommendations'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
            const validEngine = engine as 'claude' | 'gpt' | 'perplexity' | 'gemini';
            const config = getEngineConfig(validEngine);
            const recommendations = getOptimizationRecommendations(validEngine, {
              hasEarnedMedia,
              isListicle,
              ageInDays
            });
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `${engine.charAt(0).toUpperCase() + engine.slice(1)} Optimization: ${recommendations.length} recommendations`,
                  engine: {
                    name: engine,
                    biases: config.biases,
                    queryFanOut: config.queryFanOut
                  },
                  currentStatus: {
                    hasEarnedMedia,
                    isListicle,
                    ageInDays,
                    isFresh: ageInDays < 90
                  },
                  recommendations,
                  priorityActions: recommendations.slice(0, 3)
                }, null, 2)
              }]
            };
          }

          case 'full_page_analysis': {
            const { url, content, lastModified } = args as {
              url: string;
              content: string;
              lastModified?: string;
            };
            
            // Validate required inputs
            if (!url || url.trim().length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'URL is required for full page analysis',
                    tool: 'full_page_analysis'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
            if (!content || content.trim().length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Content is required for full page analysis',
                    tool: 'full_page_analysis'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
            // Validate lastModified date if provided
            let parsedLastModified: Date | undefined;
            if (lastModified) {
              parsedLastModified = new Date(lastModified);
              if (isNaN(parsedLastModified.getTime())) {
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: `Invalid lastModified date format: "${lastModified}". Please use ISO 8601 format.`,
                      tool: 'full_page_analysis'
                    }, null, 2)
                  }],
                  isError: true
                };
              }
            }
            
            const sdk = createChimeraSDK();
            const result = sdk.analyzePage({
              url,
              content,
              lastModified: parsedLastModified
            });
            
            // Note: factDensity.score is 0-1, others are already 0-100
            const factDensityPercent = Math.round(result.factDensity.score * 100);
            const informationGainScore = Math.round(result.informationGain.score); // Already 0-100
            const invertedPyramidScore = Math.round(result.invertedPyramid.score); // Already 0-100
            const fluffScoreValue = Math.round(result.fluffScore); // Already 0-100
            const listicleSuitabilityPercent = Math.round(result.listicleSuitability.confidence * 100);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Comprehensive GEO Analysis for ${url}`,
                  url: result.url,
                  scores: {
                    factDensity: factDensityPercent,
                    informationGain: informationGainScore,
                    invertedPyramid: invertedPyramidScore,
                    fluffScore: fluffScoreValue,
                    listicleSuitability: listicleSuitabilityPercent
                  },
                  freshness: result.freshness ? {
                    ageInDays: result.freshness.ageInDays,
                    isStale: result.freshness.isStale,
                    priority: result.freshness.refreshPriority
                  } : null,
                  schema: result.schema && result.schema['@graph'].length > 0 ? 'Generated' : 'Missing',
                  entitiesDetected: result.schema?.['@graph'].map(e => e['@type']) || [],
                  processingTime: `${result.processingTimeMs}ms`,
                  overallAssessment: {
                    aiReady: factDensityPercent >= 50 && informationGainScore >= 40,
                    needsWork: factDensityPercent < 50 || fluffScoreValue > 30
                  },
                  recommendations: [
                    factDensityPercent < 50 ? '📊 Add more structured data (tables, lists)' : null,
                    informationGainScore < 50 ? '📈 Increase information density with facts' : null,
                    invertedPyramidScore < 50 ? '🔝 Front-load key information' : null,
                    fluffScoreValue > 30 ? '✂️ Reduce marketing fluff' : null,
                    result.listicleSuitability.suitable ? `📝 Consider ${result.listicleSuitability.format} format` : null,
                    result.freshness?.isStale ? '🔄 Update stale content' : null,
                    (!result.schema || result.schema['@graph'].length === 0) ? '🏷️ Add JSON-LD structured data' : null
                  ].filter(Boolean)
                }, null, 2)
              }]
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                tool: name,
                hint: 'Check the input parameters and try again'
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Chimera Citation Monitor MCP Server running on stdio');
  }
}

// Run the server
const server = new CitationMonitorServer();
server.run().catch(console.error);
