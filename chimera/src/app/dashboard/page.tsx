'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * GEO Health Dashboard
 * 
 * Premium dashboard showing AI-readiness metrics
 */

interface DashboardData {
  geoHealthScore: {
    overall: number;
    components: {
      routeHealth: number;
      contentScannability: number;
      schemaCoverage: number;
      citationAuthority: number;
    };
    recommendations: string[];
  };
  routeHealth: {
    total404sCaught: number;
    successfulRedirects: number;
    learnedAliases: number;
    averageConfidence: number;
  };
  contentScannability: {
    averageScore: number;
    pagesAnalyzed: number;
    lowScorePages: string[];
  };
  schemaCoverage: {
    coveragePercentage: number;
    pagesWithSchema: number;
    totalPages: number;
    missingSchemaPages: string[];
  };
  sdkVersion: string;
  sdkFeatures: string[];
}

// Mock hallucination data for demo
const mockHallucinations = [
  { path: '/products/iphone-15', matchedTo: '/shop/electronics/phones', confidence: 0.89, agentType: 'ChatGPT', timestamp: '2 min ago' },
  { path: '/buy/macbook', matchedTo: '/shop/electronics/phones', confidence: 0.82, agentType: 'Perplexity', timestamp: '5 min ago' },
  { path: '/electronics/phones', matchedTo: '/shop/electronics/phones', confidence: 0.95, agentType: 'Claude', timestamp: '12 min ago' },
  { path: '/about-us', matchedTo: '/about', confidence: 0.78, agentType: 'Gemini', timestamp: '18 min ago' },
  { path: '/contact-form', matchedTo: '/about', confidence: 0.72, agentType: 'Generic-Bot', timestamp: '25 min ago' },
];

function ScoreRing({ score, size = 120, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#10b981', bg: 'from-emerald-500/20' };
    if (s >= 60) return { stroke: '#f59e0b', bg: 'from-amber-500/20' };
    return { stroke: '#ef4444', bg: 'from-red-500/20' };
  };
  
  const colors = getColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f2937"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold">{score}</span>
        <span className="text-gray-500 text-xs">/ 100</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, trend }: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        {trend && (
          <span className={`text-xs px-2 py-1 rounded-full ${trend.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-gray-400 text-sm">{title}</div>
      {subtitle && <div className="text-gray-500 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}

function ComponentScore({ label, score, icon }: { label: string; score: number; icon: string }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-500';
    if (s >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-2xl w-10">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-300">{label}</span>
          <span className="text-sm font-bold">{score}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getColor(score)} rounded-full transition-all duration-1000`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function HallucinationRow({ entry }: { entry: typeof mockHallucinations[0] }) {
  const agentColors: Record<string, string> = {
    'ChatGPT': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Perplexity': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Claude': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Gemini': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'Generic-Bot': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors">
      <div className={`px-3 py-1 rounded-lg text-xs font-medium border ${agentColors[entry.agentType]}`}>
        {entry.agentType}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-400/70 font-mono truncate">{entry.path}</span>
          <span className="text-gray-600">→</span>
          <span className="text-emerald-400 font-mono truncate">{entry.matchedTo}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold">{Math.round(entry.confidence * 100)}%</div>
        <div className="text-gray-500 text-xs">{entry.timestamp}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const score = data?.geoHealthScore.overall || 60;
  const components = data?.geoHealthScore.components || {
    routeHealth: 100,
    contentScannability: 65,
    schemaCoverage: 75,
    citationAuthority: 0
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center text-xl">
                🧬
              </div>
              <div>
                <h1 className="text-lg font-bold">Chimera</h1>
                <p className="text-gray-500 text-xs">GEO Health Dashboard</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">SDK v{data?.sdkVersion || '2.0'}</span>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Hero Score Section */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur rounded-3xl p-8 mb-8 border border-gray-700/50">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">GEO Health Score</h2>
              <p className="text-gray-400 mb-6 max-w-md">
                Your website&apos;s readiness for AI search engines. Higher scores mean better 
                discoverability in ChatGPT, Perplexity, Claude, and Gemini.
              </p>
              
              {/* Component Scores */}
              <div className="space-y-4">
                <ComponentScore label="Route Health" score={components.routeHealth} icon="🛡️" />
                <ComponentScore label="Content Scannability" score={components.contentScannability} icon="📊" />
                <ComponentScore label="Schema Coverage" score={components.schemaCoverage} icon="🏷️" />
                <ComponentScore label="Citation Authority" score={components.citationAuthority} icon="🔗" />
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <ScoreRing score={score} size={180} strokeWidth={12} />
              <p className="text-gray-500 text-sm mt-4">
                {score >= 80 ? '🎉 Excellent!' : score >= 60 ? '👍 Good, room to improve' : '⚠️ Needs attention'}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard 
            icon="🛡️"
            title="404s Intercepted"
            value={data?.routeHealth.total404sCaught || 47}
            subtitle="AI agents saved"
            trend={{ value: 12, positive: true }}
          />
          <MetricCard 
            icon="✅"
            title="Successful Redirects"
            value={data?.routeHealth.successfulRedirects || 42}
            subtitle="89% success rate"
            trend={{ value: 5, positive: true }}
          />
          <MetricCard 
            icon="🔗"
            title="Learned Aliases"
            value={data?.routeHealth.learnedAliases || 8}
            subtitle="Auto-created patterns"
          />
          <MetricCard 
            icon="📄"
            title="Pages Analyzed"
            value={data?.contentScannability.pagesAnalyzed || 12}
            subtitle={`${data?.schemaCoverage.pagesWithSchema || 9} with schema`}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Hallucination Log */}
          <div className="bg-gray-800/30 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-gray-700/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                🔄 Recent Fuzzy Redirects
              </h3>
              <p className="text-gray-500 text-sm">AI agents that guessed wrong but were saved</p>
            </div>
            <div className="divide-y divide-gray-700/30">
              {mockHallucinations.map((entry, i) => (
                <HallucinationRow key={i} entry={entry} />
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* AI Traffic */}
            <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                🤖 AI Agent Traffic
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'ChatGPT', value: 35, color: 'bg-emerald-500' },
                  { name: 'Perplexity', value: 28, color: 'bg-blue-500' },
                  { name: 'Claude', value: 18, color: 'bg-orange-500' },
                  { name: 'Gemini', value: 12, color: 'bg-purple-500' },
                  { name: 'Other Bots', value: 7, color: 'bg-gray-500' },
                ].map((agent) => (
                  <div key={agent.name} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-400">{agent.name}</div>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${agent.color} rounded-full`} style={{ width: `${agent.value}%` }} />
                    </div>
                    <div className="w-10 text-right text-sm font-medium">{agent.value}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                💡 Recommendations
              </h3>
              <div className="space-y-3">
                {(data?.geoHealthScore.recommendations || [
                  'Add more structured data (tables, lists)',
                  'Build citation authority through PR outreach'
                ]).map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                    <span className="text-amber-400">⚡</span>
                    <span className="text-sm text-gray-300">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SDK Features */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-bold mb-3">SDK v2.0 Features</h3>
              <div className="flex flex-wrap gap-2">
                {(data?.sdkFeatures || [
                  'Multi-algorithm fuzzy matching',
                  'Information gain analysis',
                  'E-E-A-T schema generation',
                  'Freshness monitoring'
                ]).slice(0, 4).map((feature, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-300">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 italic">&quot;Don&apos;t let AI agents 404 on your brand.&quot;</p>
          <p className="text-gray-600 text-sm mt-2">Built with Kiro for Kiroween 🎃</p>
        </div>
      </main>
    </div>
  );
}
