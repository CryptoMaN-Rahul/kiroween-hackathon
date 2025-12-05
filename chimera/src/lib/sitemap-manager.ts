/**
 * Sitemap Manager for Symbiote Router
 * 
 * Handles parsing, indexing, and managing sitemaps for route matching.
 * Production-grade implementation with:
 * - Gzip decompression support
 * - Sitemap index file support (recursive fetching)
 * - Lenient XML parsing for malformed sitemaps
 * - Caching with TTL
 * 
 * @module sitemap-manager
 */

import type { SitemapEntry } from '@/types';
import { tokenizePath } from './tokenizer';
import { gunzipSync } from 'zlib';

// =============================================================================
// Types
// =============================================================================

export interface SitemapFetchOptions {
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** Maximum number of sitemaps to fetch from index (default: 50) */
  maxSitemaps?: number;
  /** Whether to follow sitemap index files (default: true) */
  followIndex?: boolean;
  /** User-Agent header for requests */
  userAgent?: string;
  /** Whether to use lenient parsing for malformed XML (default: true) */
  lenientParsing?: boolean;
}

export interface SitemapFetchResult {
  entries: SitemapEntry[];
  errors: string[];
  fetchedUrls: string[];
  totalTime: number;
}

// =============================================================================
// XML Parsing Helpers
// =============================================================================

/**
 * Decode HTML entities in XML content.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Clean XML content for parsing.
 * Handles common issues in real-world sitemaps.
 */
function cleanXml(xml: string): string {
  return xml
    // Remove BOM if present
    .replace(/^\uFEFF/, '')
    // Remove XML declaration (can cause issues)
    .replace(/<\?xml[^?]*\?>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Normalize whitespace in tags
    .replace(/>\s+</g, '><')
    // Fix common encoding issues
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

/**
 * Parses a sitemap XML string into an array of entries.
 * Handles both regular sitemaps and sitemap indexes.
 * 
 * @param xml - Raw XML content
 * @param lenient - Whether to use lenient parsing (default: true)
 */
export function parseSitemapXml(xml: string, lenient: boolean = true): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  
  // Clean XML if lenient mode
  const cleanedXml = lenient ? cleanXml(xml) : xml;
  
  // Regex patterns for extraction
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
  const locRegex = /<loc>([^<]*)<\/loc>/i;
  const lastmodRegex = /<lastmod>([^<]*)<\/lastmod>/i;
  const changefreqRegex = /<changefreq>([^<]*)<\/changefreq>/i;
  const priorityRegex = /<priority>([^<]*)<\/priority>/i;

  let match;
  while ((match = urlRegex.exec(cleanedXml)) !== null) {
    const urlBlock = match[1];
    
    const locMatch = locRegex.exec(urlBlock);
    if (!locMatch) continue;

    // Decode HTML entities in URL
    const loc = decodeHtmlEntities(locMatch[1].trim());
    
    // Skip invalid URLs
    if (!loc || (!loc.startsWith('http') && !loc.startsWith('/'))) {
      continue;
    }

    const entry: SitemapEntry = { loc };

    const lastmodMatch = lastmodRegex.exec(urlBlock);
    if (lastmodMatch) {
      const lastmod = lastmodMatch[1].trim();
      // Validate date format (ISO 8601 or common variants)
      if (/^\d{4}-\d{2}-\d{2}/.test(lastmod)) {
        entry.lastmod = lastmod;
      }
    }

    const changefreqMatch = changefreqRegex.exec(urlBlock);
    if (changefreqMatch) {
      const freq = changefreqMatch[1].trim().toLowerCase();
      const validFreqs = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
      if (validFreqs.includes(freq)) {
        entry.changefreq = freq as SitemapEntry['changefreq'];
      }
    }

    const priorityMatch = priorityRegex.exec(urlBlock);
    if (priorityMatch) {
      const priority = parseFloat(priorityMatch[1].trim());
      if (!isNaN(priority) && priority >= 0 && priority <= 1) {
        entry.priority = priority;
      }
    }

    entries.push(entry);
  }

  return entries;
}

/**
 * Parses a sitemap index XML to get list of sitemap URLs.
 * 
 * @param xml - Raw XML content
 * @param lenient - Whether to use lenient parsing (default: true)
 */
export function parseSitemapIndex(xml: string, lenient: boolean = true): string[] {
  const sitemaps: string[] = [];
  
  // Clean XML if lenient mode
  const cleanedXml = lenient ? cleanXml(xml) : xml;
  
  const sitemapRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  const locRegex = /<loc>([^<]*)<\/loc>/i;

  let match;
  while ((match = sitemapRegex.exec(cleanedXml)) !== null) {
    const sitemapBlock = match[1];
    const locMatch = locRegex.exec(sitemapBlock);
    if (locMatch) {
      const loc = decodeHtmlEntities(locMatch[1].trim());
      if (loc && loc.startsWith('http')) {
        sitemaps.push(loc);
      }
    }
  }

  return sitemaps;
}

/**
 * Checks if XML content is a sitemap index (vs regular sitemap).
 */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

/**
 * Decompress gzip content.
 * Returns original content if not gzipped.
 */
export function decompressGzip(buffer: Buffer): string {
  // Check for gzip magic number (1f 8b)
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      const decompressed = gunzipSync(buffer);
      return decompressed.toString('utf-8');
    } catch {
      console.warn('[SitemapManager] Gzip decompression failed, trying as plain text');
      return buffer.toString('utf-8');
    }
  }
  return buffer.toString('utf-8');
}

/**
 * Fetch a sitemap from URL with gzip support.
 */
export async function fetchSitemap(
  url: string,
  options: SitemapFetchOptions = {}
): Promise<{ content: string; error?: string }> {
  const {
    timeoutMs = 10000,
    userAgent = 'Chimera-GEO-SDK/2.0 (Sitemap Fetcher)'
  } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/xml, text/xml, application/gzip, */*',
        'Accept-Encoding': 'gzip, deflate'
      },
      signal: controller.signal
    });
    
    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    // Get response as buffer to handle gzip
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Decompress if gzipped
    const content = decompressGzip(buffer);
    
    return { content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: '', error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch and parse a sitemap, following sitemap index files.
 * 
 * @param url - URL of sitemap or sitemap index
 * @param options - Fetch options
 */
export async function fetchAndParseSitemap(
  url: string,
  options: SitemapFetchOptions = {}
): Promise<SitemapFetchResult> {
  const {
    maxSitemaps = 50,
    followIndex = true,
    lenientParsing = true
  } = options;
  
  const startTime = Date.now();
  const allEntries: SitemapEntry[] = [];
  const errors: string[] = [];
  const fetchedUrls: string[] = [];
  
  // Fetch initial sitemap
  const { content, error } = await fetchSitemap(url, options);
  fetchedUrls.push(url);
  
  if (error) {
    errors.push(`${url}: ${error}`);
    return { entries: allEntries, errors, fetchedUrls, totalTime: Date.now() - startTime };
  }
  
  // Check if it's a sitemap index
  if (followIndex && isSitemapIndex(content)) {
    const sitemapUrls = parseSitemapIndex(content, lenientParsing);
    
    // Limit number of sitemaps to fetch
    const urlsToFetch = sitemapUrls.slice(0, maxSitemaps);
    
    // Fetch all sitemaps in parallel (with concurrency limit)
    const concurrency = 5;
    for (let i = 0; i < urlsToFetch.length; i += concurrency) {
      const batch = urlsToFetch.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (sitemapUrl) => {
          const result = await fetchSitemap(sitemapUrl, options);
          fetchedUrls.push(sitemapUrl);
          return { url: sitemapUrl, ...result };
        })
      );
      
      for (const result of results) {
        if (result.error) {
          errors.push(`${result.url}: ${result.error}`);
        } else if (result.content) {
          const entries = parseSitemapXml(result.content, lenientParsing);
          allEntries.push(...entries);
        }
      }
    }
  } else {
    // Regular sitemap
    const entries = parseSitemapXml(content, lenientParsing);
    allEntries.push(...entries);
  }
  
  return {
    entries: allEntries,
    errors,
    fetchedUrls,
    totalTime: Date.now() - startTime
  };
}

/**
 * Extracts just the path from a full URL.
 */
export function extractPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // If not a valid URL, assume it's already a path
    return url.startsWith('/') ? url : '/' + url;
  }
}

/**
 * Route index for fast lookup and matching.
 */
export interface RouteIndex {
  /** All valid routes (paths only) */
  routes: string[];
  /** Map of route to its tokens for fast matching */
  tokenMap: Map<string, string[]>;
  /** Map of token to routes containing that token */
  invertedIndex: Map<string, Set<string>>;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Creates an index from sitemap entries for fast route lookup.
 */
export function indexRoutes(entries: SitemapEntry[]): RouteIndex {
  const routes: string[] = [];
  const tokenMap = new Map<string, string[]>();
  const invertedIndex = new Map<string, Set<string>>();

  for (const entry of entries) {
    const path = extractPathFromUrl(entry.loc);
    routes.push(path);

    const tokens = tokenizePath(path);
    tokenMap.set(path, tokens);

    // Build inverted index
    for (const token of tokens) {
      if (!invertedIndex.has(token)) {
        invertedIndex.set(token, new Set());
      }
      invertedIndex.get(token)!.add(path);
    }
  }

  return {
    routes,
    tokenMap,
    invertedIndex,
    lastUpdated: new Date()
  };
}

/**
 * Finds routes that share at least one token with the query path.
 * This is a fast pre-filter before semantic matching.
 */
export function findCandidateRoutes(
  queryPath: string, 
  index: RouteIndex
): string[] {
  const queryTokens = tokenizePath(queryPath);
  const candidates = new Set<string>();

  for (const token of queryTokens) {
    const routes = index.invertedIndex.get(token);
    if (routes) {
      routes.forEach(route => candidates.add(route));
    }
  }

  return Array.from(candidates);
}

/**
 * Checks if a route exists in the index.
 */
export function routeExists(path: string, index: RouteIndex): boolean {
  return index.tokenMap.has(path);
}

/**
 * Gets the tokens for a route from the index.
 */
export function getRouteTokens(path: string, index: RouteIndex): string[] | null {
  return index.tokenMap.get(path) || null;
}

/**
 * Sitemap Manager class for stateful operations.
 * Production-grade implementation with caching and auto-refresh.
 */
export class SitemapManager {
  private index: RouteIndex | null = null;
  private baseUrl: string;
  private cacheTtlMs: number;
  private lastFetchResult: SitemapFetchResult | null = null;
  private fetchOptions: SitemapFetchOptions;

  constructor(baseUrl: string = '', options: { cacheTtlMs?: number } & SitemapFetchOptions = {}) {
    this.baseUrl = baseUrl;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.fetchOptions = options;
  }

  /**
   * Loads and indexes a sitemap from XML content.
   */
  loadFromXml(xml: string, lenient: boolean = true): void {
    const entries = parseSitemapXml(xml, lenient);
    this.index = indexRoutes(entries);
  }

  /**
   * Loads routes directly from an array of paths.
   */
  loadFromPaths(paths: string[]): void {
    const entries: SitemapEntry[] = paths.map(path => ({
      loc: this.baseUrl + path
    }));
    this.index = indexRoutes(entries);
  }

  /**
   * Fetches and loads a sitemap from URL.
   * Handles gzip compression and sitemap index files.
   * 
   * @param url - URL of sitemap (defaults to baseUrl + /sitemap.xml)
   * @param options - Fetch options
   */
  async loadFromUrl(url?: string, options?: SitemapFetchOptions): Promise<SitemapFetchResult> {
    const sitemapUrl = url || `${this.baseUrl}/sitemap.xml`;
    const mergedOptions = { ...this.fetchOptions, ...options };
    
    const result = await fetchAndParseSitemap(sitemapUrl, mergedOptions);
    
    if (result.entries.length > 0) {
      this.index = indexRoutes(result.entries);
    }
    
    this.lastFetchResult = result;
    return result;
  }

  /**
   * Checks if cache is stale and needs refresh.
   */
  isCacheStale(): boolean {
    if (!this.index) return true;
    const age = Date.now() - this.index.lastUpdated.getTime();
    return age > this.cacheTtlMs;
  }

  /**
   * Refreshes the sitemap if cache is stale.
   * Returns true if refresh was performed.
   */
  async refreshIfStale(url?: string): Promise<boolean> {
    if (!this.isCacheStale()) return false;
    await this.loadFromUrl(url);
    return true;
  }

  /**
   * Gets all indexed routes.
   */
  getRoutes(): string[] {
    return this.index?.routes || [];
  }

  /**
   * Checks if a route exists.
   */
  hasRoute(path: string): boolean {
    return this.index ? routeExists(path, this.index) : false;
  }

  /**
   * Finds candidate routes for fuzzy matching.
   */
  findCandidates(queryPath: string): string[] {
    return this.index ? findCandidateRoutes(queryPath, this.index) : [];
  }

  /**
   * Gets the route index.
   */
  getIndex(): RouteIndex | null {
    return this.index;
  }

  /**
   * Gets the count of indexed routes.
   */
  getRouteCount(): number {
    return this.index?.routes.length || 0;
  }

  /**
   * Gets the last fetch result (for debugging/monitoring).
   */
  getLastFetchResult(): SitemapFetchResult | null {
    return this.lastFetchResult;
  }

  /**
   * Clears the cache, forcing a refresh on next access.
   */
  clearCache(): void {
    this.index = null;
    this.lastFetchResult = null;
  }

  /**
   * Gets cache statistics.
   */
  getCacheStats(): {
    hasCache: boolean;
    routeCount: number;
    cacheAge: number | null;
    isStale: boolean;
    lastFetchErrors: string[];
  } {
    return {
      hasCache: this.index !== null,
      routeCount: this.getRouteCount(),
      cacheAge: this.index ? Date.now() - this.index.lastUpdated.getTime() : null,
      isStale: this.isCacheStale(),
      lastFetchErrors: this.lastFetchResult?.errors || []
    };
  }
}

/**
 * Creates a new SitemapManager instance.
 */
export function createSitemapManager(
  baseUrl: string = '',
  options?: { cacheTtlMs?: number } & SitemapFetchOptions
): SitemapManager {
  return new SitemapManager(baseUrl, options);
}
