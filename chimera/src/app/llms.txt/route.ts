/**
 * llms.txt API Route
 *
 * Returns a plain text manifest for AI agents to efficiently
 * discover and understand site content.
 *
 * Requirements: 1.7
 */

import { NextResponse } from 'next/server';
import { generate } from '@/lib/ai-search/llms-generator';
import { LLMsConfig, RouteEntry, ApiEntry, PageContent } from '@/lib/ai-search/types';

// Site configuration
const config: LLMsConfig = {
  siteName: 'Chimera',
  siteDescription: 'AI-First Edge Optimization Suite - Making your content findable and citable by AI agents',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://chimera.example.com',
  includeApiEndpoints: true,
  maxQuickFacts: 10,
};

// Define key routes
const routes: RouteEntry[] = [
  { path: '/', description: 'Home page with GEO Health Dashboard overview' },
  { path: '/dashboard', description: 'Real-time AI search optimization metrics and analytics' },
  { path: '/about', description: 'About Chimera and the AI-First Edge approach' },
  { path: '/shop/electronics/phones', description: 'Electronics and phone products catalog' },
];

// Define API endpoints
const apiEndpoints: ApiEntry[] = [
  { method: 'GET', path: '/api/dashboard', description: 'Returns dashboard metrics and GEO health scores' },
  { method: 'GET', path: '/llms.txt', description: 'AI agent manifest with site structure and quick facts' },
  { method: 'GET', path: '/ai-manifest.json', description: 'Machine-readable site capabilities manifest' },
];

// Sample page content for quick facts extraction
const pages: PageContent[] = [
  {
    url: '/',
    title: 'Chimera - AI-First Edge',
    description: 'AI search optimization suite',
    content: `Chimera solves the AI Bounce problem where AI agents abandon sites returning 404 errors.
Our fuzzy routing achieves 95% accuracy in matching hallucinated URLs.
The platform processes requests in under 100ms latency.
GEO Health scores improved by 40% for early adopters.
Citation rates increased by 3x after implementing structured data.`,
    headings: ['AI-First Edge', 'Features', 'Metrics'],
    statistics: [],
    lastModified: new Date(),
  },
];

/**
 * GET /llms.txt
 * Returns plain text manifest for AI agents
 */
export async function GET() {
  const content = generate(config, pages, routes, apiEndpoints);

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
