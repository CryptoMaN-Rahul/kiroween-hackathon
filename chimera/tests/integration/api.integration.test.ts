/**
 * API Integration Tests (Mocked)
 * 
 * Tests for external API integrations with mocked responses.
 * Verifies circuit breaker behavior and graceful degradation.
 * 
 * @module tests/integration/api.integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchReddit, searchHackerNews, searchGitHub, discoverCitations } from '@/lib/citation-discovery';
import { createCircuitBreaker, circuitBreakerRegistry } from '@/lib/circuit-breaker';
import { createDomainAuthorityService } from '@/lib/domain-authority';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Integration Tests (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breakers between tests
    circuitBreakerRegistry.resetAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Reddit API Integration', () => {
    it('parses Reddit search results correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'abc123',
                  title: 'Test post about Chimera SDK',
                  selftext: 'This is a great SDK for GEO optimization.',
                  url: 'https://reddit.com/r/programming/comments/abc123',
                  permalink: '/r/programming/comments/abc123/test_post',
                  subreddit: 'programming',
                  score: 150,
                  num_comments: 25,
                  created_utc: 1700000000,
                  author: 'testuser'
                }
              }
            ],
            after: null
          }
        })
      });

      const results = await searchReddit('Chimera SDK', { maxResults: 10, timeoutMs: 5000 });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe('reddit');
      expect(results[0].title).toBe('Test post about Chimera SDK');
      expect(results[0].sourceDomain).toBe('reddit.com');
      expect(results[0].isEarnedMedia).toBe(true);
      expect(results[0].domainAuthority).toBeGreaterThan(0);
    });

    it('handles Reddit API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw, should return empty array (circuit breaker fallback)
      const results = await searchReddit('test query', { maxResults: 10, timeoutMs: 5000 });
      expect(results).toEqual([]);
    });

    it('handles Reddit rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      // Should return empty array due to circuit breaker
      const results = await searchReddit('test query', { maxResults: 10, timeoutMs: 5000 });
      expect(results).toEqual([]);
    });
  });

  describe('Hacker News API Integration', () => {
    it('parses HN search results correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hits: [
            {
              objectID: '12345',
              title: 'Show HN: Chimera GEO SDK',
              url: 'https://github.com/example/chimera',
              author: 'hnuser',
              points: 200,
              num_comments: 50,
              created_at: '2024-11-15T10:00:00.000Z',
              story_text: 'A new SDK for AI search optimization.'
            }
          ],
          nbHits: 1
        })
      });

      const results = await searchHackerNews('Chimera', { maxResults: 10, timeoutMs: 5000 });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe('hackernews');
      expect(results[0].title).toBe('Show HN: Chimera GEO SDK');
      expect(results[0].sourceDomain).toBe('news.ycombinator.com');
      expect(results[0].isEarnedMedia).toBe(true);
      // HN has high base authority
      expect(results[0].domainAuthority).toBeGreaterThanOrEqual(60);
    });

    it('handles HN API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

      const results = await searchHackerNews('test', { maxResults: 10, timeoutMs: 5000 });
      expect(results).toEqual([]);
    });
  });

  describe('GitHub API Integration', () => {
    it('parses GitHub search results correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 1,
          items: [
            {
              id: 123456,
              name: 'chimera-sdk',
              full_name: 'example/chimera-sdk',
              html_url: 'https://github.com/example/chimera-sdk',
              description: 'GEO optimization SDK for AI-first websites',
              stargazers_count: 500,
              forks_count: 50,
              watchers_count: 500,
              language: 'TypeScript',
              updated_at: '2024-11-15T10:00:00Z',
              owner: {
                login: 'example',
                avatar_url: 'https://github.com/example.png'
              }
            }
          ]
        })
      });

      const results = await searchGitHub('chimera', { maxResults: 10, timeoutMs: 5000 });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('example/chimera-sdk');
      expect(results[0].sourceDomain).toBe('github.com');
      expect(results[0].isEarnedMedia).toBe(true);
      expect(results[0].domainAuthority).toBeGreaterThan(50);
    });

    it('handles GitHub rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Rate limit exceeded'
      });

      const results = await searchGitHub('test', { maxResults: 10, timeoutMs: 5000 });
      expect(results).toEqual([]);
    });
  });

  describe('Combined Citation Discovery', () => {
    it('aggregates results from multiple sources', async () => {
      // Mock Reddit response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'reddit1',
                  title: 'Reddit mention',
                  selftext: '',
                  url: 'https://reddit.com/r/test/1',
                  permalink: '/r/test/comments/1',
                  subreddit: 'test',
                  score: 10,
                  num_comments: 5,
                  created_utc: 1700000000,
                  author: 'user1'
                }
              }
            ],
            after: null
          }
        })
      });

      // Mock HN response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hits: [
            {
              objectID: 'hn1',
              title: 'HN mention',
              url: 'https://example.com',
              author: 'hnuser',
              points: 100,
              num_comments: 20,
              created_at: '2024-11-15T10:00:00.000Z'
            }
          ],
          nbHits: 1
        })
      });

      // Mock GitHub response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 1,
          items: [
            {
              id: 1,
              name: 'test-repo',
              full_name: 'user/test-repo',
              html_url: 'https://github.com/user/test-repo',
              description: 'Test repo',
              stargazers_count: 50,
              forks_count: 5,
              watchers_count: 50,
              language: 'JavaScript',
              updated_at: '2024-11-15T10:00:00Z',
              owner: { login: 'user', avatar_url: '' }
            }
          ]
        })
      });

      const results = await discoverCitations({
        brandTerms: ['TestBrand'],
        maxResultsPerSource: 10,
        timeoutMs: 5000
      });

      // Should have results from multiple sources
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // Results should be sorted by authority
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].domainAuthority).toBeGreaterThanOrEqual(results[i].domainAuthority);
      }
    });

    it('deduplicates results by URL', async () => {
      // Mock same URL from different sources
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: '1',
                  title: 'Same content',
                  selftext: '',
                  url: 'https://example.com/same',
                  permalink: '/r/test/1',
                  subreddit: 'test',
                  score: 10,
                  num_comments: 5,
                  created_utc: 1700000000,
                  author: 'user1'
                }
              }
            ],
            after: null
          }
        })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: [], nbHits: 0 })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_count: 0, items: [] })
      });

      const results = await discoverCitations({
        brandTerms: ['test'],
        maxResultsPerSource: 10,
        timeoutMs: 5000
      });

      // Check for unique URLs
      const urls = results.map(r => r.sourceUrl);
      const uniqueUrls = new Set(urls);
      expect(urls.length).toBe(uniqueUrls.size);
    });
  });

  describe('Circuit Breaker Behavior', () => {
    it('opens circuit after consecutive failures', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        name: 'test-breaker'
      });

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('API error');
          });
        } catch {
          // Expected
        }
      }

      // Circuit should be open
      expect(breaker.getState()).toBe('open');

      // Next call should use fallback
      const result = await breaker.execute(
        async () => 'success',
        () => 'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('half-opens circuit after timeout', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 100, // Short timeout for testing
        name: 'test-breaker-2'
      });

      // Trigger circuit open
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be half-open now
      expect(breaker.getState()).toBe('half-open');
    });

    it('closes circuit after successful calls in half-open state', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        successThreshold: 2,
        name: 'test-breaker-3'
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => { throw new Error('fail'); });
        } catch {
          // Expected
        }
      }

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make successful calls
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      // Should be closed now
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Domain Authority Service', () => {
    it('returns cached results', async () => {
      const service = createDomainAuthorityService({
        cacheTtlSeconds: 3600,
        useFallback: true
      });

      // First call - should use heuristic (no API mock)
      const result1 = await service.getScore('example.com');
      expect(result1.domain).toBe('example.com');
      expect(result1.score).toBeGreaterThan(0);

      // Second call - should use cache
      const result2 = await service.getScore('example.com');
      expect(result2.source).toBe('cache');
      expect(result2.score).toBe(result1.score);
    });

    it('uses heuristic scoring for unknown domains', async () => {
      const service = createDomainAuthorityService({
        useFallback: true
      });

      // Unknown domain should use heuristic
      const result = await service.getScore('random-unknown-domain-12345.xyz');
      expect(result.source).toBe('heuristic');
      expect(result.confidence).toBeLessThan(1);
    });

    it('returns known domain scores', async () => {
      const service = createDomainAuthorityService({
        useFallback: true
      });

      // Known high-authority domain
      const result = await service.getScore('google.com');
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('batch lookup returns results for all domains', async () => {
      const service = createDomainAuthorityService({
        useFallback: true
      });

      const domains = ['google.com', 'github.com', 'unknown-domain.xyz'];
      const results = await service.getBatchScores(domains);

      expect(results.size).toBe(3);
      expect(results.has('google.com')).toBe(true);
      expect(results.has('github.com')).toBe(true);
      expect(results.has('unknown-domain.xyz')).toBe(true);
    });
  });
});
