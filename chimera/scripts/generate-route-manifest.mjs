#!/usr/bin/env node
/**
 * Build-time Route Discovery Script
 * 
 * Discovers all routes from the Next.js app directory and generates
 * a static manifest that can be imported in Edge Runtime middleware.
 * 
 * Run this during build: node scripts/generate-route-manifest.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR = path.join(__dirname, '../src/app');
const OUTPUT_FILE = path.join(__dirname, '../src/lib/route-manifest.json');

/**
 * Scan Next.js app directory for routes
 */
async function discoverRoutes(dir, routePath = '') {
  const routes = [];
  
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return routes;
  }
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip special directories
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      if (entry.name === 'api') continue;
      if (entry.name === 'node_modules') continue;
      
      // Handle route groups (folder) - don't add to path
      if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
        const subRoutes = await discoverRoutes(fullPath, routePath);
        routes.push(...subRoutes);
        continue;
      }
      
      // Handle parallel routes @folder - skip
      if (entry.name.startsWith('@')) continue;
      
      // Handle dynamic routes - keep brackets
      const segment = entry.name;
      const newRoutePath = routePath + '/' + segment;
      const subRoutes = await discoverRoutes(fullPath, newRoutePath);
      routes.push(...subRoutes);
    } else if (entry.isFile()) {
      // Check for page files
      if (entry.name === 'page.tsx' || entry.name === 'page.ts' || 
          entry.name === 'page.jsx' || entry.name === 'page.js') {
        const finalPath = routePath || '/';
        routes.push(finalPath);
      }
    }
  }
  
  return routes;
}

/**
 * Main execution
 */
async function main() {
  console.log('[Chimera] Discovering routes from app directory...');
  
  const routes = await discoverRoutes(APP_DIR);
  
  // Sort routes for consistency
  routes.sort();
  
  const manifest = {
    routes,
    generatedAt: new Date().toISOString(),
    count: routes.length
  };
  
  // Write manifest
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
  
  console.log(`[Chimera] ✓ Discovered ${routes.length} routes`);
  console.log(`[Chimera] ✓ Manifest written to ${OUTPUT_FILE}`);
  
  // Print routes for verification
  if (routes.length < 20) {
    console.log('[Chimera] Routes:', routes);
  }
}

main().catch(error => {
  console.error('[Chimera] Route discovery failed:', error);
  process.exit(1);
});
