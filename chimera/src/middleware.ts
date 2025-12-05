/**
 * Next.js Middleware for Chimera GEO SDK v2.0
 * 
 * Intercepts requests and performs fuzzy routing for 404s.
 * This is the entry point for the Chimera AI-First Edge system.
 * 
 * PRODUCTION ARCHITECTURE:
 * - Middleware runs BEFORE Next.js route resolution
 * - Routes are discovered dynamically from sitemap.xml and filesystem
 * - Dynamic routes are matched against patterns
 * - The router learns from redirects and persists aliases
 * 
 * @module middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSymbioteRouter } from '@/lib/symbiote-router';
import { detectAgent } from '@/lib/agent-detector';
import routeManifest from '@/lib/route-manifest.json';

// Initialize the router with production-grade configuration
const router = createSymbioteRouter({
  confidenceThreshold: 0.7, // 70% confidence threshold for fuzzy matching
  maxLatencyMs: 200,
  enableLearning: true,
  aliasThreshold: 3
});

// Load routes from build-time generated manifest
// This avoids Node.js fs/path dependencies in Edge Runtime
const DISCOVERED_ROUTES = routeManifest.routes;

/**
 * Additional static routes not in app directory
 */
const ADDITIONAL_ROUTES = [
  '/api/dashboard',
  '/llms.txt',
  '/ai-manifest.json',
  '/sitemap.xml',
  '/robots.txt',
];

/**
 * Dynamic route patterns - these match parameterized routes
 * Add your dynamic routes here (e.g., /blog/[slug])
 */
const DYNAMIC_PATTERNS = [
  '/shop/[category]/[subcategory]',
  '/products/[brand]/[product]',
  '/blog/[slug]',
];

// Combine all routes
const ALL_ROUTES = [...DISCOVERED_ROUTES, ...ADDITIONAL_ROUTES];

// Load routes into router on initialization
router.loadRoutes(ALL_ROUTES);

/**
 * Check if a path matches any dynamic route pattern
 * Simple implementation without external dependencies
 */
function matchesDynamicPattern(path: string): boolean {
  const pathParts = path.split('/').filter(Boolean);
  
  for (const pattern of DYNAMIC_PATTERNS) {
    const patternParts = pattern.split('/').filter(Boolean);
    
    if (pathParts.length !== patternParts.length) continue;
    
    let matches = true;
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      // Dynamic segment [slug] matches anything
      if (patternPart.startsWith('[') && patternPart.endsWith(']')) {
        continue;
      }
      
      // Static segment must match exactly
      if (patternPart !== pathPart) {
        matches = false;
        break;
      }
    }
    
    if (matches) return true;
  }
  
  return false;
}

/**
 * Paths that should be excluded from fuzzy routing.
 */
const EXCLUDED_PATHS = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

/**
 * Checks if a path should be excluded from processing.
 */
function shouldExclude(path: string): boolean {
  return EXCLUDED_PATHS.some(excluded => path.startsWith(excluded));
}

/**
 * Check if a route actually exists in our application.
 */
function routeExists(path: string): boolean {
  // Check router's loaded routes first
  if (router.routeExists(path)) {
    return true;
  }
  
  // Check if it matches a dynamic pattern
  if (matchesDynamicPattern(path)) {
    return true;
  }
  
  return false;
}

/**
 * Main middleware function.
 * 
 * FLOW:
 * 1. Skip excluded paths (static assets, API routes)
 * 2. Initialize routes if not done (lazy loading)
 * 3. Check if route exists directly → pass through
 * 4. If route doesn't exist → attempt fuzzy matching
 * 5. If fuzzy match found with high confidence → redirect
 * 6. If no match → return structured 404 for AI agents
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip excluded paths (fast path)
  if (shouldExclude(path)) {
    return NextResponse.next();
  }

  // Detect if this is an AI agent
  const agentResult = detectAgent(request);

  // CRITICAL: Check if route actually exists BEFORE fuzzy matching
  // This is what makes the middleware actually useful
  if (routeExists(path)) {
    // Route exists, pass through with SDK header
    const response = NextResponse.next();
    response.headers.set('X-Chimera-SDK', '2.0');
    return response;
  }

  // Route doesn't exist - this is where fuzzy matching kicks in
  // Process through the router for potential redirect
  const result = router.processRequest(path, agentResult.type);
  
  // Debug logging
  console.log('[Chimera Debug]', {
    path,
    shouldRedirect: result.shouldRedirect,
    confidence: result.match.confidence,
    matchedPath: result.match.matchedPath,
    threshold: 0.6
  });

  // If we found a fuzzy match with sufficient confidence
  if (result.shouldRedirect && result.redirectPath) {
    const redirectUrl = new URL(result.redirectPath, request.url);
    
    // Use 307 for AI agents (temporary) and 301 for humans (permanent)
    // AI agents should re-check in case content changes
    const statusCode = agentResult.type !== 'Human' ? 307 : 301;
    
    const response = NextResponse.redirect(redirectUrl, statusCode);
    response.headers.set('X-Chimera-Redirect', 'true');
    response.headers.set('X-Chimera-Original-Path', path);
    response.headers.set('X-Chimera-Confidence', result.match.confidence.toString());
    response.headers.set('X-Chimera-Method', result.match.method);
    response.headers.set('X-Chimera-Agent-Type', agentResult.type);
    
    // Log for analytics (in production, send to analytics service)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chimera] Fuzzy redirect:', {
        from: path,
        to: result.redirectPath,
        confidence: result.match.confidence,
        method: result.match.method,
        agentType: agentResult.type,
        latencyMs: result.match.latencyMs
      });
    }

    return response;
  }

  // No fuzzy match found - return structured 404 response
  // For AI agents, we provide machine-readable error information
  const response = NextResponse.next();
  response.headers.set('X-Chimera-SDK', '2.0');
  response.headers.set('X-Chimera-Status', 'not-found');
  
  if (agentResult.type !== 'Human') {
    // For AI agents, provide helpful suggestions in headers
    const suggestions = router.getSuggestions(path, 5);
    response.headers.set('X-Chimera-Suggestions', suggestions.join(','));
    response.headers.set('X-Chimera-AI-Optimized', 'true');
    response.headers.set('X-Chimera-Agent-Type', agentResult.type);
    
    // Add Link header pointing to sitemap for discovery
    response.headers.set('Link', '</sitemap.xml>; rel="sitemap", </llms.txt>; rel="ai-manifest"');
  }

  return response;
}

/**
 * Configure which paths the middleware runs on.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
