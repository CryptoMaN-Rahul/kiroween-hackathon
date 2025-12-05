/**
 * About Page
 * 
 * Information about Chimera and the AI-First Edge approach.
 */

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center text-xl">
                🧬
              </div>
              <span className="text-xl font-bold">Chimera</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                Dashboard
              </Link>
              <Link href="/shop/electronics/phones" className="text-gray-400 hover:text-white text-sm transition-colors">
                Demo Shop
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Chimera</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            The AI-First Edge SDK that makes your website discoverable by AI search engines.
          </p>
        </div>

        {/* The Problem */}
        <section className="mb-16">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              The AI Bounce Problem
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              AI agents like ChatGPT, Perplexity, Claude, and Gemini have <strong className="text-white">zero tolerance for errors</strong>. 
              When they request a URL that doesn&apos;t exist, they don&apos;t try again — they immediately abandon your site 
              and move to a competitor.
            </p>
            <p className="text-gray-400">
              This &quot;AI Bounce&quot; costs businesses real traffic. As AI search grows, websites that aren&apos;t 
              optimized for AI agents will become invisible.
            </p>
          </div>
        </section>

        {/* The Solution */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-3xl">💡</span>
            Our Solution
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: '🔄',
                title: 'Fuzzy URL Routing',
                desc: '5 algorithms catch hallucinated URLs and redirect to the semantically closest valid page.'
              },
              {
                icon: '📊',
                title: 'Content Analysis',
                desc: 'Information gain scoring, inverted pyramid detection, and AI scannability metrics.'
              },
              {
                icon: '🏷️',
                title: 'Auto Schema',
                desc: 'JSON-LD generation with E-E-A-T signals for Products, Articles, FAQs, and more.'
              },
              {
                icon: '📈',
                title: 'Citation Monitoring',
                desc: 'Track earned media mentions and build authority that AI engines trust.'
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Built With Kiro */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-2xl p-8 border border-emerald-500/20">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <span className="text-3xl">🎃</span>
              Built with Kiro for Kiroween
            </h2>
            <p className="text-gray-300 mb-6">
              Chimera was built using Kiro&apos;s full feature set:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { feature: 'Spec-Driven Development', detail: '110 tasks, 36 correctness properties' },
                { feature: 'Agent Hooks', detail: '6 hooks for security, testing, and GEO' },
                { feature: 'Steering Documents', detail: '6 files guiding code generation' },
                { feature: 'MCP Server', detail: '12 tools for GEO analysis' },
                { feature: 'Property-Based Testing', detail: '512 tests with fast-check' },
                { feature: 'Vibe Coding', detail: 'Iterative development in chat' },
              ].map((item) => (
                <div key={item.feature} className="flex items-start gap-3">
                  <span className="text-emerald-400">✓</span>
                  <div>
                    <span className="font-medium">{item.feature}</span>
                    <span className="text-gray-500 text-sm ml-2">— {item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Category */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-3xl">🧟</span>
            Frankenstein Category
          </h2>
          <p className="text-gray-300 mb-4">
            Chimera stitches together 8 disparate technologies into one powerful SDK:
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              'Fuzzy String Matching',
              'Information Theory',
              'Graph Theory',
              'NLP',
              'Schema.org',
              'Property-Based Testing',
              'MCP Protocol',
              'Event-Driven Architecture'
            ].map((tech) => (
              <span key={tech} className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300 text-sm">
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 rounded-xl font-semibold text-lg transition-all duration-300"
          >
            View Live Dashboard →
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          Built with Kiro for Kiroween Hackathon 🎃
        </div>
      </footer>
    </div>
  );
}
