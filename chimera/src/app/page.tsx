/**
 * Chimera Landing Page
 * 
 * Premium landing page for the AI-First Edge GEO SDK.
 * Demonstrates fuzzy routing, content analysis, and schema generation.
 * 
 * Built for Kiroween Hackathon 🎃 - Frankenstein Category
 * "Stitching together a chimera of technologies into one powerful SDK"
 */

import Link from 'next/link';

// Floating particles for spooky atmosphere
function SpookyParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-emerald-400/30 rounded-full animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, description, gradient }: { 
  icon: string; 
  title: string; 
  description: string;
  gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 ${gradient} group hover:scale-[1.02] transition-all duration-300 border border-white/5 hover:border-emerald-500/30`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-emerald-500/10 to-transparent" />
      <div className="relative">
        <span className="text-5xl mb-4 block drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{icon}</span>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-white/80 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="text-center p-6">
      <span className="text-3xl mb-2 block">{icon}</span>
      <div className="text-4xl font-bold text-white mb-1">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  );
}

function TestRouteCard({ wrong, right, confidence }: { wrong: string; right: string; confidence: number }) {
  const threshold = 70; // Match the middleware threshold (0.7)
  const willRedirect = confidence >= threshold;
  
  return (
    <Link 
      href={wrong}
      className={`bg-gray-900/80 backdrop-blur rounded-xl p-5 border ${willRedirect ? 'border-gray-700/50 hover:border-emerald-500/50' : 'border-red-700/50 hover:border-red-500/50'} hover:bg-gray-800/80 transition-all duration-300 group relative overflow-hidden`}
    >
      {/* Animated scan line */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${willRedirect ? 'via-emerald-400' : 'via-red-400'} to-transparent animate-pulse`} />
      </div>
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-red-400/80 font-mono text-sm line-through mb-1 flex items-center gap-2">
            <span className="text-red-500">✗</span> {wrong}
          </div>
          {willRedirect ? (
            <div className="text-emerald-400 font-mono text-sm flex items-center gap-2">
              <span className="text-emerald-500">✓</span> {right}
            </div>
          ) : (
            <div className="text-gray-500 font-mono text-sm flex items-center gap-2">
              <span className="text-gray-600">⚠</span> Below threshold - won&apos;t redirect
            </div>
          )}
        </div>
        <div className={`${willRedirect ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} px-3 py-1.5 rounded-lg text-xs font-bold border`}>
          {confidence}% match
        </div>
      </div>
      <div className={`text-gray-500 text-xs ${willRedirect ? 'group-hover:text-emerald-400' : 'group-hover:text-red-400'} transition-colors flex items-center gap-1`}>
        <span>{willRedirect ? 'Click to test redirect' : 'Click to see 404'}</span>
        <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// Terminal-style demo component
function TerminalDemo() {
  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-gray-500 text-xs font-mono ml-2">chimera-router.ts</span>
      </div>
      
      {/* Terminal content */}
      <div className="p-4 font-mono text-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-purple-400">→</span>
          <span className="text-gray-400">Request:</span>
          <span className="text-red-400">/products/iphone-15-pro</span>
          <span className="text-red-500 animate-pulse">404</span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-gray-600">├─</span>
          <span className="text-cyan-400">Levenshtein:</span>
          <span className="text-white">0.72</span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-gray-600">├─</span>
          <span className="text-cyan-400">Jaro-Winkler:</span>
          <span className="text-white">0.68</span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-gray-600">├─</span>
          <span className="text-cyan-400">Cosine:</span>
          <span className="text-white">0.81</span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-gray-600">└─</span>
          <span className="text-yellow-400">Combined:</span>
          <span className="text-emerald-400 font-bold">0.75</span>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
          <span className="text-emerald-400">✓</span>
          <span className="text-gray-400">Redirect:</span>
          <span className="text-emerald-400">/shop/electronics/phones</span>
          <span className="text-gray-600 text-xs">(142ms)</span>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AlgorithmBadge({ name, score, color }: { name: string; score: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/50 border border-${color}-500/20`}>
      <div className={`w-2 h-2 rounded-full bg-${color}-400 animate-pulse`} />
      <span className="text-gray-400 text-xs">{name}</span>
      <span className={`text-${color}-400 font-mono text-sm font-bold`}>{score}</span>
    </div>
  );
}

export default function HomePage() {
  // Schema.org structured data for AI agents
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Chimera - AI-First Edge GEO SDK",
    "applicationCategory": "DeveloperApplication",
    "description": "Chimera catches hallucinated URLs from ChatGPT, Perplexity, Claude, and Gemini — redirecting them to the right page before they bounce. Built for Kiroween Hackathon.",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "datePublished": "2024-10-31",
    "dateModified": "2024-12-05",
    "author": {
      "@type": "Organization",
      "name": "Chimera"
    },
    "featureList": [
      "Fuzzy URL Routing with 5 algorithms",
      "Content Analysis and Information Gain scoring",
      "Auto Schema Generation with E-E-A-T signals",
      "Citation Monitoring",
      "Freshness Monitoring",
      "Engine-Specific Optimization"
    ]
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Spooky Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Eerie glow orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-[128px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px]" />
        {/* Subtle fog effect */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-emerald-950/20 to-transparent" />
      </div>
      <SpookyParticles />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-purple-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow duration-300">
                🧬
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">Chimera</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                Dashboard
              </Link>
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">
                About
              </Link>
              <Link 
                href="/dashboard" 
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge with Kiroween flair */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-purple-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8 hover:border-emerald-400/40 transition-colors">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span>🎃 Kiroween Hackathon</span>
              <span className="text-white/30">|</span>
              <span>GEO SDK v2.0 — Frankenstein Category</span>
            </div>
            
            {/* Headline with dramatic effect */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent drop-shadow-lg">
                Don&apos;t Let AI Agents
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-purple-400 bg-clip-text text-transparent animate-pulse" style={{ animationDuration: '3s' }}>
                👻 404 on Your Brand
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Chimera catches hallucinated URLs from ChatGPT, Perplexity, Claude, and Gemini — 
              redirecting them to the right page before they bounce.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/dashboard" 
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              >
                View Live Dashboard →
              </Link>
              <Link 
                href="/shop/electronics/phones" 
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold text-lg transition-all duration-300"
              >
                Try Demo Shop
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Stitched Together */}
      <section className="relative z-10 py-12 border-y border-emerald-500/10 bg-gradient-to-r from-emerald-950/20 via-transparent to-purple-950/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-emerald-500/20">
            <StatCard value="5" label="Fuzzy Algorithms" icon="🧪" />
            <StatCard value="512" label="Property Tests" icon="🔮" />
            <StatCard value="<200ms" label="Routing Latency" icon="⚡" />
            <StatCard value="12" label="MCP Tools" icon="🛠️" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for AI Search Optimization
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              A complete toolkit for making your website AI-agent friendly
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon="🔄"
              title="Fuzzy URL Routing"
              description="5 algorithms (Levenshtein, Jaro-Winkler, N-Gram, Soundex, Cosine) catch hallucinated URLs and redirect to the semantically closest page."
              gradient="bg-gradient-to-br from-blue-600/40 to-blue-900/40"
            />
            <FeatureCard 
              icon="📊"
              title="Content Analysis"
              description="Information gain scoring, inverted pyramid detection, and fluff analysis ensure your content is optimized for AI extraction."
              gradient="bg-gradient-to-br from-purple-600/40 to-purple-900/40"
            />
            <FeatureCard 
              icon="🏷️"
              title="Auto Schema Generation"
              description="Automatically generates JSON-LD with E-E-A-T signals. Detects Products, Articles, FAQs, Organizations, and People."
              gradient="bg-gradient-to-br from-emerald-600/40 to-emerald-900/40"
            />
            <FeatureCard 
              icon="📈"
              title="Citation Monitoring"
              description="Track earned vs owned media mentions. Build a reputation graph that AI search engines use for authority scoring."
              gradient="bg-gradient-to-br from-orange-600/40 to-orange-900/40"
            />
            <FeatureCard 
              icon="🕐"
              title="Freshness Monitoring"
              description="Detect stale content that AI engines penalize. Get refresh priority recommendations based on content velocity."
              gradient="bg-gradient-to-br from-pink-600/40 to-pink-900/40"
            />
            <FeatureCard 
              icon="🤖"
              title="Engine-Specific Optimization"
              description="Tailored recommendations for Claude, GPT, Perplexity, and Gemini based on each engine's unique biases."
              gradient="bg-gradient-to-br from-cyan-600/40 to-cyan-900/40"
            />
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="relative z-10 py-24 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs mb-4">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
              LIVE DEMO
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Watch the <span className="text-purple-400">Monster</span> in Action
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              See how Chimera catches a hallucinated URL and finds the best match using 5 algorithms
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Terminal Demo */}
            <TerminalDemo />
            
            {/* Algorithm breakdown */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">5 Algorithms, One Decision</h3>
              <p className="text-gray-400 text-sm">Each algorithm contributes to the final confidence score:</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400">📐</span>
                    <span className="text-gray-300 text-sm">Levenshtein Distance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '72%' }} />
                    </div>
                    <span className="text-blue-400 font-mono text-sm">0.72</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400">🔗</span>
                    <span className="text-gray-300 text-sm">Jaro-Winkler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '68%' }} />
                    </div>
                    <span className="text-purple-400 font-mono text-sm">0.68</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400">📊</span>
                    <span className="text-gray-300 text-sm">N-Gram Similarity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: '65%' }} />
                    </div>
                    <span className="text-cyan-400 font-mono text-sm">0.65</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-400">🔊</span>
                    <span className="text-gray-300 text-sm">Soundex Match</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-orange-400 font-mono text-sm">1.00</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-pink-400">📐</span>
                    <span className="text-gray-300 text-sm">Cosine Similarity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: '81%' }} />
                    </div>
                    <span className="text-pink-400 font-mono text-sm">0.81</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold">Weighted Final Score</span>
                  <span className="text-emerald-400 font-mono text-2xl font-bold">75%</span>
                </div>
                <p className="text-emerald-400/60 text-xs mt-1">Above 60% threshold → Redirect approved</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Try It Section */}
      <section className="relative z-10 py-24 bg-gradient-to-b from-transparent via-emerald-950/20 to-transparent">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              🧪 Test It Yourself
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Click any &quot;wrong&quot; URL below. Chimera will catch it and redirect you to the correct page.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <TestRouteCard wrong="/buy/phones" right="/shop/electronics/phones" confidence={75} />
            <TestRouteCard wrong="/mobile-shop" right="/shop/electronics/phones" confidence={68} />
            <TestRouteCard wrong="/electronics/mobile" right="/shop/electronics/phones" confidence={68} />
            <TestRouteCard wrong="/products/iphone" right="/shop/electronics/phones" confidence={58} />
          </div>
          
          <div className="mt-8 p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
            <p className="text-gray-400 text-sm">
              💡 Open DevTools → Network tab → Watch for <code className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">X-Chimera-*</code> headers
            </p>
          </div>
        </div>
      </section>

      {/* How It Works - The Stitching Process */}
      <section className="relative z-10 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-purple-400">🧵</span> How the Monster Works
            </h2>
            <p className="text-gray-500 text-sm">Stitched together from 5 algorithms, brought to life by edge computing</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '💀', title: 'AI Agent Requests', desc: 'ChatGPT guesses a URL like /products/iphone-15 that doesn\'t exist' },
              { step: '02', icon: '⚗️', title: 'Chimera Intercepts', desc: 'Middleware catches the 404 and runs 5 fuzzy matching algorithms' },
              { step: '03', icon: '✨', title: 'Smart Redirect', desc: 'Redirects to /shop/electronics/phones with 75% confidence' },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-3xl border border-emerald-500/20 group-hover:border-emerald-400/50 group-hover:shadow-lg group-hover:shadow-emerald-500/20 transition-all duration-300">
                  {item.icon}
                </div>
                <div className="text-emerald-400/60 text-xs font-mono mb-2">STEP {item.step}</div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          
          {/* Connecting lines */}
          <div className="hidden md:flex justify-center mt-8">
            <div className="flex items-center gap-2 text-emerald-500/30">
              <div className="w-24 h-px bg-gradient-to-r from-transparent to-emerald-500/50" />
              <span className="text-xs">⚡</span>
              <div className="w-24 h-px bg-emerald-500/50" />
              <span className="text-xs">⚡</span>
              <div className="w-24 h-px bg-gradient-to-r from-emerald-500/50 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Kiro Features Section - Enhanced */}
      <section className="relative z-10 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs mb-4">
              <span>🎃</span>
              KIROWEEN HACKATHON
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Built with <span className="text-emerald-400">Kiro</span> Features
            </h2>
            <p className="text-gray-500 text-sm">Spec-driven development meets AI-powered coding</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: '📋', 
                title: 'Specs', 
                desc: 'EARS requirements, design docs, 36 correctness properties',
                highlight: '36 Properties',
                color: 'blue'
              },
              { 
                icon: '🎣', 
                title: 'Hooks', 
                desc: 'Schema generator, content analyzer, freshness checker, GEO reporter',
                highlight: '4 Hooks',
                color: 'purple'
              },
              { 
                icon: '🧭', 
                title: 'Steering', 
                desc: 'Tech stack, project structure, GEO conventions, testing patterns',
                highlight: '5 Docs',
                color: 'orange'
              },
              { 
                icon: '🔌', 
                title: 'MCP', 
                desc: 'Citation monitor, content analyzer, schema generator, freshness tools',
                highlight: '12 Tools',
                color: 'emerald'
              },
            ].map((item) => (
              <div key={item.title} className="group relative bg-gray-900/50 rounded-xl p-6 border border-gray-800 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{item.icon}</span>
                    <span className={`text-xs px-2 py-1 rounded-full bg-${item.color}-500/10 text-${item.color}-400 border border-${item.color}-500/20`}>
                      {item.highlight}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-white">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Code snippet showing Kiro usage */}
          <div className="mt-12 bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-gray-500 text-xs font-mono ml-2">.kiro/steering/product.md</span>
            </div>
            <div className="p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-400">
<span className="text-purple-400"># Chimera: AI-First Edge</span>
{'\n'}
<span className="text-gray-600"># The Problem: AI Bounce</span>
{'\n'}AI agents have <span className="text-red-400">zero tolerance</span> for errors:
{'\n'}- They hallucinate URLs → <span className="text-red-400">404</span> → abandon site
{'\n'}- They can&apos;t parse unstructured content → skip to competitors
{'\n'}
{'\n'}<span className="text-gray-600"># Our Solution</span>
{'\n'}<span className="text-emerald-400">✓</span> Symbiote Router (Fuzzy URL Matching)
{'\n'}<span className="text-emerald-400">✓</span> Fact-Density Analyzer
{'\n'}<span className="text-emerald-400">✓</span> Schema Generator (JSON-LD + E-E-A-T)
{'\n'}<span className="text-emerald-400">✓</span> Citation Monitor (MCP-powered)
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-emerald-600/20 via-purple-600/10 to-emerald-600/20 rounded-3xl p-12 border border-emerald-500/20 text-center overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-4 left-4 text-4xl opacity-20">🧬</div>
            <div className="absolute bottom-4 right-4 text-4xl opacity-20">🎃</div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Resurrect Your AI Traffic?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              See your GEO Health Score and start catching those hallucinated URLs today.
            </p>
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-900 hover:from-emerald-400 hover:to-emerald-300 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              Open Dashboard
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-emerald-500/10 py-12 bg-gradient-to-t from-emerald-950/10 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-purple-500 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-emerald-500/20">
                🧬
              </div>
              <span className="font-bold">Chimera</span>
              <span className="text-emerald-500/30">|</span>
              <span className="text-gray-400 text-sm">AI-First Edge SDK</span>
            </div>
            <div className="text-gray-500 text-sm text-center flex items-center gap-2">
              <span>Built with</span>
              <span className="text-emerald-400 font-semibold">Kiro</span>
              <span>for</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs">
                🎃 Kiroween
              </span>
              <span className="text-purple-400">Frankenstein Category</span>
            </div>
            <div className="flex items-center gap-4 text-gray-400 text-sm">
              <Link href="/llms.txt" className="hover:text-emerald-400 transition-colors">llms.txt</Link>
              <Link href="/ai-manifest.json" className="hover:text-emerald-400 transition-colors">AI Manifest</Link>
              <Link href="/about" className="hover:text-emerald-400 transition-colors">About</Link>
            </div>
          </div>
          
          {/* Hackathon attribution */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-gray-600 text-xs">
              🧟 Stitching together fuzzy routing, content analysis, schema generation, citation monitoring, and more into one powerful SDK
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
