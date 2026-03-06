'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { InvestAnalysisResponse, AgentResult } from '@/hooks/use-invest-analysis';

export default function InvestResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-surface-400">Loading results...</div>
      </div>
    }>
      <InvestResultsContent />
    </Suspense>
  );
}

function InvestResultsContent() {
  const searchParams = useSearchParams();
  const dealId = searchParams.get('dealId');
  const [result, setResult] = useState<InvestAnalysisResponse | null>(null);

  useEffect(() => {
    // Load result from sessionStorage
    const stored = sessionStorage.getItem('investResult');
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-white mb-2">No analysis results found</h2>
          <p className="text-surface-400 mb-6">Please run a new investment analysis.</p>
          <Link
            href="/invest"
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition-colors inline-block"
          >
            Start New Analysis
          </Link>
        </div>
      </div>
    );
  }

  const verdictConfig = {
    YES: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', glow: 'shadow-green-500/20', emoji: '✅' },
    NO: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', glow: 'shadow-red-500/20', emoji: '❌' },
    MAYBE: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'shadow-amber-500/20', emoji: '⚠️' },
  };

  const vc = verdictConfig[result.verdict];

  return (
    <div className="min-h-screen bg-surface-950">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Verdict Header */}
        <div className={`rounded-2xl ${vc.bg} border ${vc.border} p-8 mb-6 text-center shadow-lg ${vc.glow}`}>
          <div className="text-5xl mb-3">{vc.emoji}</div>
          <div className={`text-4xl font-black ${vc.color} mb-1`}>
            {result.verdict === 'YES' ? 'Go For It!' : result.verdict === 'NO' ? 'Not Recommended' : 'Proceed With Caution'}
          </div>
          <div className="text-surface-400 text-sm mb-4">
            Our team is {result.confidence}% confident in this recommendation
          </div>
          <p className="text-surface-200 text-lg max-w-2xl mx-auto">{result.summary}</p>

          {/* Confidence bar */}
          <div className="mt-6 max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span>Confidence</span>
              <span>{result.confidence}%</span>
            </div>
            <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  result.verdict === 'YES' ? 'bg-green-400' : result.verdict === 'NO' ? 'bg-red-400' : 'bg-amber-400'
                }`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Expected Return', value: result.keyMetrics.expectedReturn, icon: '💰' },
            { label: 'Risk Level', value: result.keyMetrics.riskLevel, icon: '🛡️' },
            { label: 'Market Outlook', value: result.keyMetrics.marketOutlook, icon: '🌍' },
            { label: 'Timeline', value: result.keyMetrics.timelineConfidence, icon: '📅' },
          ].map((metric) => (
            <div key={metric.label} className="bg-surface-900 rounded-xl border border-surface-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>{metric.icon}</span>
                <span className="text-xs font-medium text-surface-400">{metric.label}</span>
              </div>
              <p className="text-sm text-surface-200">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
              <span>⚠️</span> Things to Keep in Mind
            </h3>
            <ul className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                  <span className="text-amber-500/60 mt-0.5">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agent Results */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🧠</span> What Our Experts Found
          </h2>
          <div className="space-y-3">
            {result.agentResults.map((agent) => (
              <AgentResultCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-surface-800">
          {dealId && (
            <Link
              href={`/deals/${dealId}`}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition-colors text-center"
            >
              View Full Deal Dashboard
            </Link>
          )}
          <Link
            href="/invest"
            className="px-6 py-3 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-xl font-medium transition-colors text-center"
          >
            Analyze Another Investment
          </Link>
          <Link
            href="/agents"
            className="px-6 py-3 text-surface-400 hover:text-surface-200 transition-colors text-center text-sm"
          >
            Talk to an individual expert
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Agent Result Card ─── */
function AgentResultCard({ agent }: { agent: AgentResult }) {
  const [expanded, setExpanded] = useState(false);

  const toolCount = agent.toolCalls?.length ?? 0;
  const duration = agent.durationMs ? `${(agent.durationMs / 1000).toFixed(1)}s` : '';

  // Extract first 2-3 lines as summary
  const lines = agent.reply.split('\n').filter((l) => l.trim());
  const summaryLines = lines.slice(0, 3).join(' ').slice(0, 200);

  return (
    <div className={`bg-surface-900 rounded-xl border transition-all ${
      agent.error ? 'border-red-500/30' : 'border-surface-700'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-2xl flex-shrink-0">{agent.agentIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm">{agent.agentName}</span>
            {toolCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-400/20">
                {toolCount} tools
              </span>
            )}
            {duration && (
              <span className="text-[10px] text-surface-500">{duration}</span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-surface-400 mt-0.5 truncate">{summaryLines || 'Analysis complete'}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-surface-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-800">
          {agent.error ? (
            <div className="text-sm text-red-400 mt-3">{agent.reply}</div>
          ) : (
            <div className="mt-3 prose prose-invert prose-sm max-w-none text-surface-300">
              <AgentMarkdown content={agent.reply} />
            </div>
          )}
          {toolCount > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-800">
              <p className="text-xs text-surface-500 mb-1.5">Data sources used:</p>
              <div className="flex flex-wrap gap-1">
                {agent.toolCalls.map((tc, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded bg-surface-800 text-surface-400 border border-surface-700"
                  >
                    {tc.name.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Simple markdown renderer for agent replies */
function AgentMarkdown({ content }: { content: string }) {
  // Split into sections by ## headers
  const sections = content.split(/^(#{1,3}\s.+)$/gm);

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        // Headers
        if (trimmed.startsWith('### ')) {
          return <h4 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={i} className="text-base font-semibold text-white mt-4 mb-1">{trimmed.replace('## ', '')}</h3>;
        }

        // Regular content — render lines
        return (
          <div key={i} className="text-sm text-surface-300 whitespace-pre-wrap leading-relaxed">
            {trimmed}
          </div>
        );
      })}
    </div>
  );
}
