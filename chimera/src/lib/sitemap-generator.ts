/**
 * Sitemap Generator for Chimera
 * 
 * Generates sitemap.xml from Next.js app routes.
 * Supports splitting large sitemaps (>1000 routes) into multiple files.
 * 
 * @module sitemap-generator
 */

import type { SitemapEntry } from '@/types';

/**
 * Maximum routes per sitemap file before splitting.
 */
export const MAX_ROUTES_PER_SITEMAP = 1000;

/**
 * Configuration for sitemap generation.
 */
export interface SitemapGeneratorConfig {
  baseUrl: string;
  defaultChangefreq?: SitemapEntry['changefreq'];
  defaultPriority?: number;
  excludePatterns?: RegExp[];
}

/**
 * Result of sitemap generation.
 */
export interface GeneratedSitemap {
  /** Main sitemap or sitemap index XML */
  mainXml: string;
  /** Additional sitemap files if split (keyed by filename) */
  additionalSitemaps: Map<string, string>;
  /** Total number of routes */
  totalRoutes: number;
  /** Whether the sitemap was split */
  wasSplit: boolean;
}

/**
 * Generates XML for a single sitemap entry.
 */
function generateUrlEntry(entry: SitemapEntry): string {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
  
  if (entry.lastmod) {
    xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
  }
  
  if (entry.changefreq) {
    xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
  }
  
  if (entry.priority !== undefined) {
    xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
  }
  
  xml += '  </url>\n';
  return xml;
}

/**
 * Escapes special XML characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a complete sitemap XML from entries.
 */
export function generateSitemapXml(entries: SitemapEntry[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const entry of entries) {
    xml += generateUrlEntry(entry);
  }
  
  xml += '</urlset>\n';
  return xml;
}

/**
 * Generates a sitemap index XML pointing to multiple sitemaps.
 */
export function generateSitemapIndexXml(sitemapUrls: string[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const url of sitemapUrls) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(url)}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }
  
  xml += '</sitemapindex>\n';
  return xml;
}

/**
 * Converts paths to sitemap entries.
 */
export function pathsToEntries(
  paths: string[],
  config: SitemapGeneratorConfig
): SitemapEntry[] {
  return paths
    .filter(path => {
      // Apply exclude patterns
      if (config.excludePatterns) {
        return !config.excludePatterns.some(pattern => pattern.test(path));
      }
      return true;
    })
    .map(path => ({
      loc: config.baseUrl + path,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: config.defaultChangefreq || 'weekly',
      priority: config.defaultPriority || 0.5
    }));
}

/**
 * Generates sitemap(s) from an array of paths.
 * Automatically splits if more than MAX_ROUTES_PER_SITEMAP routes.
 */
export function generateSitemap(
  paths: string[],
  config: SitemapGeneratorConfig
): GeneratedSitemap {
  const entries = pathsToEntries(paths, config);
  const totalRoutes = entries.length;

  // No splitting needed
  if (totalRoutes <= MAX_ROUTES_PER_SITEMAP) {
    return {
      mainXml: generateSitemapXml(entries),
      additionalSitemaps: new Map(),
      totalRoutes,
      wasSplit: false
    };
  }

  // Split into multiple sitemaps
  const additionalSitemaps = new Map<string, string>();
  const sitemapUrls: string[] = [];
  
  const chunks = chunkArray(entries, MAX_ROUTES_PER_SITEMAP);
  
  for (let i = 0; i < chunks.length; i++) {
    const filename = `sitemap-${i + 1}.xml`;
    const sitemapXml = generateSitemapXml(chunks[i]);
    additionalSitemaps.set(filename, sitemapXml);
    sitemapUrls.push(`${config.baseUrl}/${filename}`);
  }

  return {
    mainXml: generateSitemapIndexXml(sitemapUrls),
    additionalSitemaps,
    totalRoutes,
    wasSplit: true
  };
}

/**
 * Splits an array into chunks of specified size.
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Discovers routes from a Next.js app directory structure.
 * This is a simplified version - in production, use Next.js's built-in sitemap generation.
 */
export function discoverNextJsRoutes(): string[] {
  // This would normally scan the file system
  // For now, return a placeholder that can be populated
  // In production, integrate with Next.js's route manifest
  return [];
}

/**
 * Sitemap Generator class for stateful operations.
 */
export class SitemapGenerator {
  private config: SitemapGeneratorConfig;
  private routes: string[] = [];

  constructor(config: SitemapGeneratorConfig) {
    this.config = config;
  }

  /**
   * Adds routes to be included in the sitemap.
   */
  addRoutes(routes: string[]): void {
    this.routes.push(...routes);
  }

  /**
   * Clears all routes.
   */
  clearRoutes(): void {
    this.routes = [];
  }

  /**
   * Gets the current route count.
   */
  getRouteCount(): number {
    return this.routes.length;
  }

  /**
   * Generates the sitemap(s).
   */
  generate(): GeneratedSitemap {
    // Remove duplicates
    const uniqueRoutes = Array.from(new Set(this.routes));
    return generateSitemap(uniqueRoutes, this.config);
  }

  /**
   * Checks if the sitemap will be split.
   */
  willSplit(): boolean {
    return this.routes.length > MAX_ROUTES_PER_SITEMAP;
  }
}

/**
 * Creates a new SitemapGenerator instance.
 */
export function createSitemapGenerator(config: SitemapGeneratorConfig): SitemapGenerator {
  return new SitemapGenerator(config);
}
