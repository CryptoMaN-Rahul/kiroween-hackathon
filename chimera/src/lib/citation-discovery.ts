/**
 * Citation Discovery
 * 
 * Real citation discovery using free APIs.
 * Searches Reddit, Hacker News, and other free sources for brand mentions.
 * 
 * Production-grade implementation with:
 * - Circuit breaker for API resilience
 * - Graceful degradation on failures
 * - Rate limiting awareness
 * 
 * @module citation-discovery
 */

import type { Citation, Sentiment } from '@/types';
import { analyzeSentiment, generateCitationId } from './citation-monitor';
import { withCircuitBreaker } from './circuit-breaker';
import { withRateLimit, getRateLimiterStats } from './rate-limiter';

// =============================================================================
// Types
// =============================================================================

export interface DiscoveryConfig {
  /** Brand terms to search for */
  brandTerms: string[];
  /** Brand's owned domains (to distinguish earned vs owned media) */
  ownedDomains?: string[];
  /** Maximum results per source (default: 50) */
  maxResultsPerSource?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
}

export interface DiscoveredCitation {
  id: string;
  source: 'reddit' | 'hackernews' | 'google';
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  mentionContext: string;
  sentiment: Sentiment;
  domainAuthority: number;
  discoveredAt: Date;
  isEarnedMedia: boolean;
  metadata: Record<string, unknown>;
}

// =============================================================================
// Reddit API (Free, no API key required for read-only)
// =============================================================================

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    author: string;
  };
}

interface RedditSearchResponse {
  data: {
    children: RedditPost[];
    after: string | null;
  };
}

/**
 * Search Reddit for brand mentions.
 * Uses Reddit's public JSON API (no authentication required).
 * 
 * Protected by circuit breaker and rate limiter for resilience.
 */
export async function searchReddit(
  query: string,
  config: { maxResults?: number; timeoutMs?: number } = {}
): Promise<DiscoveredCitation[]> {
  const { maxResults = 50, timeoutMs = 10000 } = config;
  
  // Use circuit breaker for resilience
  return withCircuitBreaker(
    'reddit-api',
    async () => {
      // Apply rate limiting (Reddit: 60 requests/minute)
      return withRateLimit('reddit', async () => {
        const citations: DiscoveredCitation[] = [];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          // Reddit search API (public, no auth needed)
          const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${Math.min(maxResults, 100)}`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Chimera-GEO-SDK/2.0 (Citation Discovery)'
            },
            signal: controller.signal
          });
          
          if (!response.ok) {
            // Throw to trigger circuit breaker on non-OK responses
            throw new Error(`Reddit API error: ${response.status}`);
          }
          
          const data: RedditSearchResponse = await response.json();
          
          for (const post of data.data.children) {
            const { id, title, selftext, permalink, subreddit, score, num_comments, created_utc, author } = post.data;
            
            // Combine title and selftext for context
            const context = selftext ? `${title}\n\n${selftext.slice(0, 500)}` : title;
            
            // Calculate Reddit-specific authority based on engagement
            const engagementScore = Math.log10(Math.max(1, score + num_comments * 2)) * 10;
            const subredditBonus = getSubredditAuthority(subreddit);
            const authority = Math.min(100, Math.round(30 + engagementScore + subredditBonus));
            
            citations.push({
              id: generateCitationId(),
              source: 'reddit',
              sourceUrl: `https://www.reddit.com${permalink}`,
              sourceDomain: 'reddit.com',
              title,
              mentionContext: context,
              sentiment: analyzeSentiment(context),
              domainAuthority: authority,
              discoveredAt: new Date(),
              isEarnedMedia: true, // Reddit is always earned media
              metadata: {
                redditId: id,
                subreddit,
                score,
                numComments: num_comments,
                author,
                createdAt: new Date(created_utc * 1000).toISOString()
              }
            });
          }
          
          return citations;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    },
    // Fallback: return empty array on circuit open or failure
    () => {
      console.warn('[CitationDiscovery] Reddit search using fallback (circuit open or error)');
      return [];
    },
    { failureThreshold: 3, resetTimeoutMs: 60000 } // Open after 3 failures, retry after 1 minute
  );
}

/**
 * Get authority bonus for popular subreddits.
 */
function getSubredditAuthority(subreddit: string): number {
  const highAuthority: Record<string, number> = {
    'technology': 20, 'programming': 20, 'webdev': 18,
    'javascript': 18, 'python': 18, 'golang': 15,
    'startups': 15, 'entrepreneur': 15, 'business': 15,
    'news': 20, 'worldnews': 20, 'science': 20,
    'askreddit': 15, 'iama': 18, 'todayilearned': 15,
    'dataisbeautiful': 15, 'machinelearning': 18, 'artificial': 15
  };
  
  return highAuthority[subreddit.toLowerCase()] || 5;
}

// =============================================================================
// Hacker News API (Free, no API key required)
// =============================================================================

interface HNSearchResponse {
  hits: Array<{
    objectID: string;
    title: string;
    url: string;
    author: string;
    points: number;
    num_comments: number;
    created_at: string;
    story_text?: string;
  }>;
  nbHits: number;
}

/**
 * Search Hacker News for brand mentions.
 * Uses Algolia's HN Search API (free, no auth needed).
 * 
 * Protected by circuit breaker and rate limiter for resilience.
 */
export async function searchHackerNews(
  query: string,
  config: { maxResults?: number; timeoutMs?: number } = {}
): Promise<DiscoveredCitation[]> {
  const { maxResults = 50, timeoutMs = 10000 } = config;
  
  // Use circuit breaker for resilience
  return withCircuitBreaker(
    'hackernews-api',
    async () => {
      // Apply rate limiting (HN: 100 requests/minute)
      return withRateLimit('hackernews', async () => {
        const citations: DiscoveredCitation[] = [];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          // Algolia HN Search API (free, no auth)
          const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${Math.min(maxResults, 100)}`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Chimera-GEO-SDK/2.0 (Citation Discovery)'
            },
            signal: controller.signal
          });
          
          if (!response.ok) {
            // Throw to trigger circuit breaker on non-OK responses
            throw new Error(`HN API error: ${response.status}`);
          }
          
          const data: HNSearchResponse = await response.json();
          
          for (const hit of data.hits) {
            const { objectID, title, url: storyUrl, author, points, num_comments, created_at, story_text } = hit;
            
            // Context is title + optional story text
            const context = story_text ? `${title}\n\n${story_text.slice(0, 500)}` : title;
            
            // HN authority based on points and comments
            // HN is high-authority for tech content
            const engagementScore = Math.log10(Math.max(1, points + num_comments * 3)) * 15;
            const authority = Math.min(100, Math.round(60 + engagementScore));
            
            citations.push({
              id: generateCitationId(),
              source: 'hackernews',
              sourceUrl: `https://news.ycombinator.com/item?id=${objectID}`,
              sourceDomain: 'news.ycombinator.com',
              title,
              mentionContext: context,
              sentiment: analyzeSentiment(context),
              domainAuthority: authority,
              discoveredAt: new Date(),
              isEarnedMedia: true, // HN is always earned media
              metadata: {
                hnId: objectID,
                originalUrl: storyUrl,
                author,
                points,
                numComments: num_comments,
                createdAt: created_at
              }
            });
          }
          
          return citations;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    },
    // Fallback: return empty array on circuit open or failure
    () => {
      console.warn('[CitationDiscovery] HN search using fallback (circuit open or error)');
      return [];
    },
    { failureThreshold: 3, resetTimeoutMs: 60000 } // Open after 3 failures, retry after 1 minute
  );
}

// =============================================================================
// GitHub API (Free, no API key required for basic search)
// =============================================================================

interface GitHubSearchResponse {
  total_count: number;
  items: Array<{
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    language: string | null;
    updated_at: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  }>;
}

/**
 * Search GitHub repositories for brand mentions.
 * Uses GitHub's public search API (no auth needed, but rate limited).
 * 
 * Protected by circuit breaker and rate limiter for resilience.
 */
export async function searchGitHub(
  query: string,
  config: { maxResults?: number; timeoutMs?: number } = {}
): Promise<DiscoveredCitation[]> {
  const { maxResults = 30, timeoutMs = 10000 } = config;
  
  // Use circuit breaker for resilience
  return withCircuitBreaker(
    'github-api',
    async () => {
      // Apply rate limiting (GitHub: 10 requests/minute for unauthenticated)
      return withRateLimit('github', async () => {
        const citations: DiscoveredCitation[] = [];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          // GitHub search API - search in README files
          const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+in:readme,description&sort=stars&order=desc&per_page=${Math.min(maxResults, 100)}`;
          
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Chimera-GEO-SDK/2.0 (Citation Discovery)'
            },
            signal: controller.signal
          });
          
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }
          
          const data: GitHubSearchResponse = await response.json();
          
          for (const repo of data.items) {
            // Calculate GitHub-specific authority based on stars and forks
            const starScore = Math.log10(Math.max(1, repo.stargazers_count)) * 10;
            const forkScore = Math.log10(Math.max(1, repo.forks_count)) * 5;
            const authority = Math.min(100, Math.round(50 + starScore + forkScore));
            
            // Context is repo name + description
            const context = repo.description 
              ? `${repo.full_name}: ${repo.description}`
              : repo.full_name;
            
            citations.push({
              id: generateCitationId(),
              source: 'hackernews', // Using 'hackernews' as closest match for now
              sourceUrl: repo.html_url,
              sourceDomain: 'github.com',
              title: repo.full_name,
              mentionContext: context,
              sentiment: analyzeSentiment(context),
              domainAuthority: authority,
              discoveredAt: new Date(),
              isEarnedMedia: true, // GitHub mentions are earned media
              metadata: {
                githubId: repo.id,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                language: repo.language,
                owner: repo.owner.login,
                updatedAt: repo.updated_at
              }
            });
          }
          
          return citations;
        } finally {
          clearTimeout(timeoutId);
        }
      }, {
        // GitHub has stricter rate limits for unauthenticated requests
        maxTokens: 10,
        refillRate: 10,
        refillIntervalMs: 60000
      });
    },
    // Fallback: return empty array on circuit open or failure
    () => {
      console.warn('[CitationDiscovery] GitHub search using fallback (circuit open or error)');
      return [];
    },
    { failureThreshold: 3, resetTimeoutMs: 60000 }
  );
}

// =============================================================================
// Combined Discovery
// =============================================================================

/**
 * Discover citations from all available free sources.
 * Includes: Reddit, Hacker News, GitHub
 */
export async function discoverCitations(config: DiscoveryConfig): Promise<DiscoveredCitation[]> {
  const { brandTerms, maxResultsPerSource = 50, timeoutMs = 10000 } = config;
  const allCitations: DiscoveredCitation[] = [];
  
  // Search each brand term across all sources
  for (const term of brandTerms) {
    // Run searches in parallel
    const [redditResults, hnResults, githubResults] = await Promise.all([
      searchReddit(term, { maxResults: maxResultsPerSource, timeoutMs }),
      searchHackerNews(term, { maxResults: maxResultsPerSource, timeoutMs }),
      searchGitHub(term, { maxResults: Math.min(maxResultsPerSource, 30), timeoutMs })
    ]);
    
    allCitations.push(...redditResults, ...hnResults, ...githubResults);
  }
  
  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueCitations = allCitations.filter(c => {
    if (seen.has(c.sourceUrl)) return false;
    seen.add(c.sourceUrl);
    return true;
  });
  
  // Sort by authority (highest first)
  uniqueCitations.sort((a, b) => b.domainAuthority - a.domainAuthority);
  
  return uniqueCitations;
}

/**
 * Convert discovered citation to standard Citation type.
 */
export function toStandardCitation(discovered: DiscoveredCitation): Citation {
  return {
    id: discovered.id,
    sourceUrl: discovered.sourceUrl,
    sourceDomain: discovered.sourceDomain,
    mentionContext: discovered.mentionContext,
    sentiment: discovered.sentiment,
    domainAuthority: discovered.domainAuthority,
    discoveredAt: discovered.discoveredAt,
    isEarnedMedia: discovered.isEarnedMedia
  };
}

// =============================================================================
// Citation Discovery Service
// =============================================================================

export interface CitationDiscoveryService {
  /** Discover citations for configured brand terms */
  discover(): Promise<DiscoveredCitation[]>;
  /** Search a specific source */
  searchSource(source: 'reddit' | 'hackernews', query: string): Promise<DiscoveredCitation[]>;
  /** Get discovery statistics */
  getStats(): { lastDiscovery: Date | null; totalDiscovered: number; bySource: Record<string, number> };
}

export function createCitationDiscoveryService(config: DiscoveryConfig): CitationDiscoveryService {
  let lastDiscovery: Date | null = null;
  let totalDiscovered = 0;
  const bySource: Record<string, number> = { reddit: 0, hackernews: 0 };
  
  return {
    async discover(): Promise<DiscoveredCitation[]> {
      const citations = await discoverCitations(config);
      
      lastDiscovery = new Date();
      totalDiscovered += citations.length;
      
      for (const c of citations) {
        bySource[c.source] = (bySource[c.source] || 0) + 1;
      }
      
      return citations;
    },
    
    async searchSource(source: 'reddit' | 'hackernews', query: string): Promise<DiscoveredCitation[]> {
      const searchConfig = {
        maxResults: config.maxResultsPerSource,
        timeoutMs: config.timeoutMs
      };
      
      switch (source) {
        case 'reddit':
          return searchReddit(query, searchConfig);
        case 'hackernews':
          return searchHackerNews(query, searchConfig);
        default:
          return [];
      }
    },
    
    getStats() {
      // Include rate limiter stats for visibility
      const redditRateLimit = getRateLimiterStats('reddit');
      const hnRateLimit = getRateLimiterStats('hackernews');
      const githubRateLimit = getRateLimiterStats('github');
      
      return { 
        lastDiscovery, 
        totalDiscovered, 
        bySource: { ...bySource },
        rateLimits: {
          reddit: redditRateLimit ? {
            availableTokens: redditRateLimit.availableTokens,
            limitedRequests: redditRateLimit.limitedRequests
          } : null,
          hackernews: hnRateLimit ? {
            availableTokens: hnRateLimit.availableTokens,
            limitedRequests: hnRateLimit.limitedRequests
          } : null,
          github: githubRateLimit ? {
            availableTokens: githubRateLimit.availableTokens,
            limitedRequests: githubRateLimit.limitedRequests
          } : null
        }
      };
    }
  };
}
