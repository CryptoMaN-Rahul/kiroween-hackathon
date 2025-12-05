/**
 * Route Discovery System
 * 
 * Production-grade route discovery that works with real-world applications.
 * Supports multiple discovery methods:
 * - Sitemap.xml parsing (remote or local)
 * - Filesystem scanning (Next.js app directory)
 * - Manual route registration
 * 
 * @module route-discovery
 */

import { promises as fs } from 'fs';
import path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface DiscoveredRoute {
  path: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  source: 'sitemap' | 'filesystem' | 'manual' | 'api';
}

export interface RouteDiscoveryConfig {
  /** Base URL for sitemap fetching */
  baseUrl?: string;
  /** Path to Next.js app directory for filesystem scanning */
  appDirectory?: string;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Whether to follow sitemap index files */
  followSitemapIndex?: boolean;
  /** Maximum number of routes to discover (default: 10000) */
  maxRoutes?: number;
  /** Request timeout for fetching sitemaps (default: 10000ms) */
  fetchTimeoutMs?: number;
}

export interface RouteManifest {
  routes: DiscoveredRoute[];
  discoveredAt: Date;
  source: string;
  expiresAt: Date;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

// =============================================================================
// Sitemap Parser
// =============================================================================

/**
 * Parse XML sitemap content and extract URLs.
 * Handles both regular sitemaps and sitemap index files.
 */
export function parseSitemapXml(xml: string): { urls: SitemapEntry[]; sitemapIndexUrls: string[] } {
  const urls: SitemapEntry[] = [];
  const sitemapIndexUrls: string[] = [];
  
  // Check if this is a sitemap index
  const isSitemapIndex = xml.includes('<sitemapindex');
  
  if (isSitemapIndex) {
    // Extract sitemap URLs from index
    const sitemapPattern = /<sitemap>\s*<loc>([^<]+)<\/loc>/g;
    let match;
    while ((match = sitemapPattern.exec(xml)) !== null) {
      sitemapIndexUrls.push(match[1].trim());
    }
  } else {
    // Extract URLs from regular sitemap
    const urlPattern = /<url>([\s\S]*?)<\/url>/g;
    let match;
    
    while ((match = urlPattern.exec(xml)) !== null) {
      const urlBlock = match[1];
      
      const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/);
      if (!locMatch) continue;
      
      const entry: SitemapEntry = {
        loc: locMatch[1].trim()
      };
      
      const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (lastmodMatch) entry.lastmod = lastmodMatch[1].trim();
      
      const changefreqMatch = urlBlock.match(/<changefreq>([^<]+)<\/changefreq>/);
      if (changefreqMatch) entry.changefreq = changefreqMatch[1].trim();
      
      const priorityMatch = urlBlock.match(/<priority>([^<]+)<\/priority>/);
      if (priorityMatch) entry.priority = priorityMatch[1].trim();
      
      urls.push(entry);
    }
  }
  
  return { urls, sitemapIndexUrls };
}

/**
 * Convert sitemap entry to discovered route.
 */
function sitemapEntryToRoute(entry: SitemapEntry, baseUrl?: string): DiscoveredRoute {
  let routePath = entry.loc;
  
  // Convert full URL to path if baseUrl provided
  if (baseUrl && routePath.startsWith(baseUrl)) {
    routePath = routePath.slice(baseUrl.length) || '/';
  } else if (routePath.startsWith('http')) {
    try {
      const url = new URL(routePath);
      routePath = url.pathname || '/';
    } catch {
      // Keep as-is if URL parsing fails
    }
  }
  
  // Ensure path starts with /
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }
  
  // Remove trailing slash except for root
  if (routePath.length > 1 && routePath.endsWith('/')) {
    routePath = routePath.slice(0, -1);
  }
  
  return {
    path: routePath,
    lastModified: entry.lastmod ? new Date(entry.lastmod) : undefined,
    changeFrequency: entry.changefreq as DiscoveredRoute['changeFrequency'],
    priority: entry.priority ? parseFloat(entry.priority) : undefined,
    source: 'sitemap'
  };
}

/**
 * Fetch sitemap from URL with timeout.
 */
async function fetchSitemap(url: string, timeoutMs: number = 10000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Chimera-GEO-SDK/2.0 (Route Discovery)',
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Discover routes from a sitemap URL.
 * Follows sitemap index files if configured.
 */
export async function discoverFromSitemap(
  sitemapUrl: string,
  config: RouteDiscoveryConfig = {}
): Promise<DiscoveredRoute[]> {
  const {
    baseUrl,
    followSitemapIndex = true,
    maxRoutes = 10000,
    fetchTimeoutMs = 10000
  } = config;
  
  const routes: DiscoveredRoute[] = [];
  const visitedSitemaps = new Set<string>();
  const sitemapsToProcess = [sitemapUrl];
  
  while (sitemapsToProcess.length > 0 && routes.length < maxRoutes) {
    const currentUrl = sitemapsToProcess.shift()!;
    
    if (visitedSitemaps.has(currentUrl)) continue;
    visitedSitemaps.add(currentUrl);
    
    try {
      const xml = await fetchSitemap(currentUrl, fetchTimeoutMs);
      const { urls, sitemapIndexUrls } = parseSitemapXml(xml);
      
      // Add discovered URLs
      for (const entry of urls) {
        if (routes.length >= maxRoutes) break;
        routes.push(sitemapEntryToRoute(entry, baseUrl));
      }
      
      // Queue sitemap index URLs for processing
      if (followSitemapIndex) {
        for (const indexUrl of sitemapIndexUrls) {
          if (!visitedSitemaps.has(indexUrl)) {
            sitemapsToProcess.push(indexUrl);
          }
        }
      }
    } catch (error) {
      console.warn(`[RouteDiscovery] Failed to fetch sitemap ${currentUrl}:`, error);
      // Continue with other sitemaps
    }
  }
  
  return routes;
}

/**
 * Read sitemap from local file.
 */
export async function discoverFromLocalSitemap(
  filePath: string,
  config: RouteDiscoveryConfig = {}
): Promise<DiscoveredRoute[]> {
  const { baseUrl, maxRoutes = 10000 } = config;
  
  try {
    const xml = await fs.readFile(filePath, 'utf-8');
    const { urls } = parseSitemapXml(xml);
    
    return urls
      .slice(0, maxRoutes)
      .map(entry => sitemapEntryToRoute(entry, baseUrl));
  } catch (error) {
    console.warn(`[RouteDiscovery] Failed to read local sitemap ${filePath}:`, error);
    return [];
  }
}

// =============================================================================
// Filesystem Scanner (Next.js App Directory)
// =============================================================================

/**
 * Scan Next.js app directory for routes.
 * Handles:
 * - page.tsx/page.js files
 * - Dynamic routes [slug], [...catchAll], [[...optionalCatchAll]]
 * - Route groups (folder)
 * - Parallel routes @folder
 */
export async function discoverFromFilesystem(
  appDir: string,
  config: RouteDiscoveryConfig = {}
): Promise<DiscoveredRoute[]> {
  const { maxRoutes = 10000 } = config;
  const routes: DiscoveredRoute[] = [];
  
  async function scanDirectory(dir: string, routePath: string = ''): Promise<void> {
    if (routes.length >= maxRoutes) return;
    
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Directory doesn't exist or not readable
    }
    
    for (const entry of entries) {
      if (routes.length >= maxRoutes) break;
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip special directories
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        if (entry.name === 'api') continue; // Skip API routes for now
        if (entry.name === 'node_modules') continue;
        
        // Handle route groups (folder) - don't add to path
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          await scanDirectory(fullPath, routePath);
          continue;
        }
        
        // Handle parallel routes @folder - skip
        if (entry.name.startsWith('@')) continue;
        
        // Handle dynamic routes
        let segment = entry.name;
        if (segment.startsWith('[') && segment.endsWith(']')) {
          // Keep dynamic segment as-is for pattern matching
          segment = segment;
        }
        
        const newRoutePath = routePath + '/' + segment;
        await scanDirectory(fullPath, newRoutePath);
      } else if (entry.isFile()) {
        // Check for page files
        if (entry.name === 'page.tsx' || entry.name === 'page.ts' || 
            entry.name === 'page.jsx' || entry.name === 'page.js') {
          const finalPath = routePath || '/';
          
          // Get file stats for lastModified
          try {
            const stats = await fs.stat(fullPath);
            routes.push({
              path: finalPath,
              lastModified: stats.mtime,
              source: 'filesystem'
            });
          } catch {
            routes.push({
              path: finalPath,
              source: 'filesystem'
            });
          }
        }
      }
    }
  }
  
  await scanDirectory(appDir);
  return routes;
}

/**
 * Check if a path matches a dynamic route pattern.
 * E.g., /products/[brand]/[product] matches /products/apple/iphone
 */
export function matchDynamicRoute(path: string, pattern: string): boolean {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  
  if (pathParts.length !== patternParts.length) return false;
  
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    
    // Catch-all route [...slug]
    if (patternPart.startsWith('[...') && patternPart.endsWith(']')) {
      return true; // Matches rest of path
    }
    
    // Optional catch-all [[...slug]]
    if (patternPart.startsWith('[[...') && patternPart.endsWith(']]')) {
      return true;
    }
    
    // Dynamic segment [slug]
    if (patternPart.startsWith('[') && patternPart.endsWith(']')) {
      continue; // Any value matches
    }
    
    // Static segment must match exactly
    if (patternPart !== pathPart) {
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// Route Discovery Manager
// =============================================================================

export interface RouteDiscoveryManager {
  /** Discover routes from all configured sources */
  discover(): Promise<DiscoveredRoute[]>;
  /** Get cached routes (returns empty if cache expired) */
  getCached(): DiscoveredRoute[];
  /** Force refresh of route cache */
  refresh(): Promise<DiscoveredRoute[]>;
  /** Add manual routes */
  addRoutes(routes: DiscoveredRoute[]): void;
  /** Check if a path exists in discovered routes */
  hasRoute(path: string): boolean;
  /** Get route manifest with metadata */
  getManifest(): RouteManifest | null;
  /** Clear cache */
  clearCache(): void;
}

export function createRouteDiscoveryManager(
  config: RouteDiscoveryConfig = {}
): RouteDiscoveryManager {
  const { cacheTtlMs = 5 * 60 * 1000 } = config; // 5 minutes default
  
  let cachedRoutes: DiscoveredRoute[] = [];
  let manifest: RouteManifest | null = null;
  let cacheExpiry: Date | null = null;
  
  // Set for O(1) route lookup
  let routeSet: Set<string> = new Set();
  // Dynamic route patterns for pattern matching
  let dynamicPatterns: string[] = [];
  
  function updateRouteIndex(routes: DiscoveredRoute[]): void {
    routeSet = new Set(routes.map(r => r.path));
    dynamicPatterns = routes
      .filter(r => r.path.includes('['))
      .map(r => r.path);
  }
  
  return {
    async discover(): Promise<DiscoveredRoute[]> {
      const allRoutes: DiscoveredRoute[] = [];
      const sources: string[] = [];
      
      // Discover from sitemap if baseUrl configured
      if (config.baseUrl) {
        try {
          const sitemapUrl = `${config.baseUrl}/sitemap.xml`;
          const sitemapRoutes = await discoverFromSitemap(sitemapUrl, config);
          allRoutes.push(...sitemapRoutes);
          if (sitemapRoutes.length > 0) sources.push('sitemap');
        } catch (error) {
          console.warn('[RouteDiscovery] Sitemap discovery failed:', error);
        }
      }
      
      // Discover from filesystem if appDirectory configured
      if (config.appDirectory) {
        try {
          const fsRoutes = await discoverFromFilesystem(config.appDirectory, config);
          allRoutes.push(...fsRoutes);
          if (fsRoutes.length > 0) sources.push('filesystem');
        } catch (error) {
          console.warn('[RouteDiscovery] Filesystem discovery failed:', error);
        }
      }
      
      // Deduplicate by path
      const uniqueRoutes = new Map<string, DiscoveredRoute>();
      for (const route of allRoutes) {
        if (!uniqueRoutes.has(route.path)) {
          uniqueRoutes.set(route.path, route);
        }
      }
      
      cachedRoutes = Array.from(uniqueRoutes.values());
      cacheExpiry = new Date(Date.now() + cacheTtlMs);
      updateRouteIndex(cachedRoutes);
      
      manifest = {
        routes: cachedRoutes,
        discoveredAt: new Date(),
        source: sources.join(', ') || 'none',
        expiresAt: cacheExpiry
      };
      
      return cachedRoutes;
    },
    
    getCached(): DiscoveredRoute[] {
      if (cacheExpiry && new Date() > cacheExpiry) {
        return []; // Cache expired
      }
      return cachedRoutes;
    },
    
    async refresh(): Promise<DiscoveredRoute[]> {
      return this.discover();
    },
    
    addRoutes(routes: DiscoveredRoute[]): void {
      for (const route of routes) {
        if (!routeSet.has(route.path)) {
          cachedRoutes.push(route);
          routeSet.add(route.path);
          if (route.path.includes('[')) {
            dynamicPatterns.push(route.path);
          }
        }
      }
    },
    
    hasRoute(path: string): boolean {
      // Check exact match first
      if (routeSet.has(path)) return true;
      
      // Check dynamic patterns
      for (const pattern of dynamicPatterns) {
        if (matchDynamicRoute(path, pattern)) return true;
      }
      
      return false;
    },
    
    getManifest(): RouteManifest | null {
      return manifest;
    },
    
    clearCache(): void {
      cachedRoutes = [];
      manifest = null;
      cacheExpiry = null;
      routeSet.clear();
      dynamicPatterns = [];
    }
  };
}
