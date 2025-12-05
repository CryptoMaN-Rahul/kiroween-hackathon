/**
 * ai-manifest.json API Route
 *
 * Returns a machine-readable JSON manifest of site capabilities
 * for AI agents to programmatically understand what the site offers.
 *
 * Requirements: 5.5
 */

import { NextResponse } from 'next/server';
import { generate } from '@/lib/ai-search/manifest-generator';
import { ManifestConfig, ManifestRoute, PageContent } from '@/lib/ai-search/types';

// Site configuration
const config: ManifestConfig = {
  siteName: 'Chimera',
  siteDescription: 'AI-First Edge Optimization Suite - Making your content findable and citable by AI agents',
  version: '1.0.0',
  capabilities: [
    'fuzzy-url-routing',
    'content-analysis',
    'schema-generation',
    'citation-monitoring',
    'geo-optimization',
  ],
};

// Define manifest routes
const routes: ManifestRoute[] = [
  { path: '/', description: 'Home page with GEO Health Dashboard overview', methods: ['GET'] },
  { path: '/dashboard', description: 'Real-time AI search optimization metrics', methods: ['GET'] },
  { path: '/about', description: 'About Chimera and AI-First Edge approach', methods: ['GET'] },
  { path: '/shop/electronics/phones', description: 'Electronics and phone products', methods: ['GET'] },
  { path: '/api/dashboard', description: 'Dashboard metrics API', methods: ['GET'] },
  { path: '/llms.txt', description: 'AI agent manifest', methods: ['GET'] },
  { path: '/ai-manifest.json', description: 'Machine-readable capabilities manifest', methods: ['GET'] },
];

// Sample page content for intent and entity extraction
const pages: PageContent[] = [
  {
    url: 'https://chimera.example.com/',
    title: 'Chimera - AI-First Edge',
    description: 'AI search optimization platform',
    content: `Chimera helps you optimize your content for AI search engines.
Learn how to improve your GEO scores with our documentation.
Contact our support team for help getting started.
Browse our product features and pricing plans.`,
    headings: ['AI-First Edge', 'Features', 'Getting Started'],
    statistics: [],
    lastModified: new Date(),
  },
  {
    url: 'https://chimera.example.com/shop',
    title: 'Shop - Chimera',
    description: 'Browse and purchase products',
    content: `Shop our collection of AI optimization tools.
Buy enterprise solutions for your team.
Add products to cart and checkout securely.`,
    headings: ['Products', 'Enterprise', 'Pricing'],
    statistics: [],
    lastModified: new Date(),
  },
];

/**
 * GET /ai-manifest.json
 * Returns JSON manifest for AI agents
 */
export async function GET() {
  const manifest = generate(config, pages, routes);

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
