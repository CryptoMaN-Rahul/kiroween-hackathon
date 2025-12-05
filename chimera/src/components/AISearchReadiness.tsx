'use client';

/**
 * AI Search Readiness Component
 * 
 * Displays AI-specific search metrics including:
 * - Citation Score
 * - AEO Score (Answer Engine Optimization)
 * - GEO Score (Generative Engine Optimization)
 * - llms.txt status
 * - Top quotable snippets
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

interface AISearchMetrics {
  citationScore: number;
  aeoScore: number;
  geoScore: number;
  llmsTxtStatus: {
    generated: boolean;
    lastUpdated: string;
    quickFactsCount: number;
  };
  topSnippets: Array<{
    text: string;
    score: number;
    source: string;
  }>;
  recommendations: string[];
}

// Score threshold for highlighting
const SCORE_THRESHOLD = 50;

function ScoreCard({ 
  label, 
  score, 
  icon,
  description 
}: { 
  label: string; 
  score: number; 
  icon: string;
  description: string;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400';
    if (s >= SCORE_THRESHOLD) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-green-500/10 border-green-500/30';
    if (s >= SCORE_THRESHOLD) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className={`rounded-lg p-4 border ${getBgColor(score)}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-gray-400 text-sm font-medium">{label}</span>
      </div>
      <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className="text-gray-500 text-xs mt-1">{description}</div>
    </div>
  );
}

function SnippetCard({ snippet }: { snippet: AISearchMetrics['topSnippets'][0] }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-300 text-sm flex-1 line-clamp-2">&quot;{snippet.text}&quot;</p>
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-bold text-blue-400">{snippet.score}</div>
          <div className="text-gray-500 text-xs">score</div>
        </div>
      </div>
      <div className="text-gray-500 text-xs mt-2">Source: {snippet.source}</div>
    </div>
  );
}

function RecommendationItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
      <span className="text-yellow-400">⚠️</span>
      <p className="text-yellow-200 text-sm">{text}</p>
    </div>
  );
}

export default function AISearchReadiness({ metrics }: { metrics?: AISearchMetrics }) {
  // Default mock data for demo
  const defaultMetrics: AISearchMetrics = {
    citationScore: 62,
    aeoScore: 45,
    geoScore: 78,
    llmsTxtStatus: {
      generated: true,
      lastUpdated: '2 hours ago',
      quickFactsCount: 8,
    },
    topSnippets: [
      { text: 'Our platform achieved 95% customer satisfaction in 2024.', score: 85, source: '/about' },
      { text: 'Revenue grew by $2 million last quarter.', score: 78, source: '/' },
      { text: 'The API handles 50,000 requests per second.', score: 72, source: '/docs' },
    ],
    recommendations: [
      'Add FAQ schema to improve AEO score',
      'Include more source citations in content',
    ],
  };

  const data = metrics || defaultMetrics;
  const hasLowScores = data.citationScore < SCORE_THRESHOLD || 
                       data.aeoScore < SCORE_THRESHOLD || 
                       data.geoScore < SCORE_THRESHOLD;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🎯 AI Search Readiness
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              How likely AI agents are to cite your content
            </p>
          </div>
          {hasLowScores && (
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              Needs Attention
            </span>
          )}
        </div>
      </div>

      {/* Score Cards */}
      <div className="p-6 border-b border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard 
            label="Citation Score"
            score={data.citationScore}
            icon="📝"
            description="Likelihood of being cited"
          />
          <ScoreCard 
            label="AEO Score"
            score={data.aeoScore}
            icon="🎤"
            description="Voice assistant readiness"
          />
          <ScoreCard 
            label="GEO Score"
            score={data.geoScore}
            icon="🤖"
            description="AI search visibility"
          />
        </div>
      </div>

      {/* llms.txt Status */}
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">llms.txt Status</h3>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            data.llmsTxtStatus.generated 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {data.llmsTxtStatus.generated ? '✓ Generated' : '✗ Not Generated'}
          </div>
          {data.llmsTxtStatus.generated && (
            <>
              <span className="text-gray-500 text-sm">
                Updated {data.llmsTxtStatus.lastUpdated}
              </span>
              <span className="text-gray-500 text-sm">
                {data.llmsTxtStatus.quickFactsCount} quick facts
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top Quotable Snippets */}
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Top Quotable Snippets</h3>
        <div className="space-y-3">
          {data.topSnippets.map((snippet, i) => (
            <SnippetCard key={i} snippet={snippet} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Action Items</h3>
          <div className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <RecommendationItem key={i} text={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
