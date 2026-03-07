// ─── IC Analysis Tab — 16-Agent Investment Committee Reports ───────
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';

interface AgentResult {
  agentId: string;
  agentName: string;
  agentIcon: string;
  reply: string;
  durationMs: number;
  error?: string;
  provenance?: {
    externalApis?: string[];
    internalTools?: string[];
    webSearches?: number;
    dataQuality?: string;
  };
}

interface InvestAnalysis {
  id: string;
  dealId: string;
  verdict: string;
  confidence: number;
  summary: string;
  keyMetrics: {
    expectedReturn: string;
    riskLevel: string;
    marketOutlook: string;
    timelineConfidence: string;
  };
  warnings: string[];
  agentResults: AgentResult[];
  createdAt: string;
}

const RESULT_CATEGORIES = [
  {
    label: 'Transaction Advisory Services (TAS)',
    subtitle: 'Core Analysis',
    icon: '📊',
    color: 'brand',
    agentIds: ['market-analyst', 'deal-underwriter', 'portfolio-risk-officer', 'capital-allocator'],
  },
  {
    label: 'Risk Assurance & Governance (RA&G)',
    subtitle: 'Compliance & Legal',
    icon: '⚖️',
    color: 'violet',
    agentIds: ['compliance-auditor', 'legal-regulatory', 'tax-strategist', 'forensic-auditor'],
  },
  {
    label: 'Operations & Technology Consulting (OTC)',
    subtitle: 'Operations',
    icon: '🏗️',
    color: 'amber',
    agentIds: ['construction-monitor', 'revenue-optimizer', 'proptech-advisor', 'insurance-protection'],
  },
  {
    label: 'Strategy & Capital Markets (S&CM)',
    subtitle: 'Strategy',
    icon: '🎯',
    color: 'emerald',
    agentIds: ['esg-analyst', 'debt-structuring', 'lp-relations', 'exit-strategist'],
  },
];

export function ICAnalysisTab({ dealId }: { dealId: string }) {
  const [analysis, setAnalysis] = useState<InvestAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(RESULT_CATEGORIES.map(c => c.label)));

  useEffect(() => {
    let cancelled = false;
    async function fetchAnalysis() {
      try {
        setLoading(true);
        const res = await api.get<{ ok: boolean; data: InvestAnalysis; error?: string }>(`/deals/${dealId}/invest-analysis`);
        if (!cancelled) {
          if (res.ok && res.data) {
            setAnalysis(res.data);
          } else {
            setError(res.error || 'No IC analysis found');
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          // 404 means no analysis exists for this deal
          if (err?.status === 404) {
            setError('No IC analysis has been run for this deal yet.');
          } else {
            setError('Failed to load IC analysis');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAnalysis();
    return () => { cancelled = true; };
  }, [dealId]);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const expandAll = () => {
    const allAgentIds = analysis?.agentResults.map(a => a.agentId) ?? [];
    setExpandedAgents(new Set(allAgentIds));
    setExpandedCategories(new Set(RESULT_CATEGORIES.map(c => c.label)));
  };

  const collapseAll = () => {
    setExpandedAgents(new Set());
  };

  // Loading
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="shimmer h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // No analysis found
  if (error || !analysis) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🧠</span>
        </div>
        <h3 className="text-lg font-bold text-surface-900 mb-2">No IC Analysis Available</h3>
        <p className="text-sm text-surface-500 max-w-md mx-auto">
          {error || 'This deal was created before the 16-agent IC analysis feature was available, or the analysis hasn\'t been run yet.'}
        </p>
        <p className="text-xs text-surface-400 mt-3">
          Create a new deal via the Invest Wizard to generate a full IC analysis.
        </p>
      </div>
    );
  }

  const verdictColors = {
    YES: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    NO: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    MAYBE: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  };
  const vc = verdictColors[analysis.verdict as keyof typeof verdictColors] || verdictColors.MAYBE;

  const totalDuration = analysis.agentResults.reduce((sum, a) => sum + (a.durationMs || 0), 0);
  const avgDuration = analysis.agentResults.length > 0 ? totalDuration / analysis.agentResults.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
          <span className="text-base">🧠</span> IC Agent Analysis
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Expand All
          </button>
          <span className="text-surface-300">|</span>
          <button onClick={collapseAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Collapse All
          </button>
        </div>
      </div>

      {/* Verdict Summary Card */}
      <div className={`rounded-xl ${vc.bg} border ${vc.border} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${vc.badge}`}>
                {analysis.verdict === 'YES' ? '✅ RECOMMENDED' : analysis.verdict === 'NO' ? '❌ NOT RECOMMENDED' : '⚠️ CONDITIONAL'}
              </span>
              <span className="text-sm text-surface-500">
                {analysis.confidence}% confidence
              </span>
            </div>
            <p className="text-sm text-surface-700 leading-relaxed">{analysis.summary}</p>
          </div>
          <div className="flex-shrink-0 text-center">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={analysis.verdict === 'YES' ? '#10b981' : analysis.verdict === 'NO' ? '#ef4444' : '#f59e0b'}
                  strokeWidth="3"
                  strokeDasharray={`${analysis.confidence * 0.94} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${vc.text}`}>
                {analysis.confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-surface-200/50">
          {[
            { label: 'Expected Return', value: analysis.keyMetrics.expectedReturn, icon: '💰' },
            { label: 'Risk Level', value: analysis.keyMetrics.riskLevel, icon: '🛡️' },
            { label: 'Market Outlook', value: analysis.keyMetrics.marketOutlook, icon: '🌍' },
            { label: 'Timeline', value: analysis.keyMetrics.timelineConfidence, icon: '📅' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <span className="text-lg">{m.icon}</span>
              <p className="text-xs text-surface-500 mt-1">{m.label}</p>
              <p className="text-sm font-medium text-surface-800">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {analysis.warnings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-surface-200/50">
            <p className="text-xs font-semibold text-amber-700 mb-1.5">⚠️ Key Warnings</p>
            <ul className="space-y-1">
              {analysis.warnings.map((w, i) => (
                <li key={i} className="text-xs text-surface-600 pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-amber-500">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="metric-card text-center">
          <p className="stat-label">Total Agents</p>
          <p className="stat-value text-brand-700">{analysis.agentResults.length}</p>
        </div>
        <div className="metric-card text-center">
          <p className="stat-label">Avg Duration</p>
          <p className="stat-value text-brand-700">{(avgDuration / 1000).toFixed(1)}s</p>
        </div>
        <div className="metric-card text-center">
          <p className="stat-label">Total Analysis Time</p>
          <p className="stat-value text-brand-700">{(totalDuration / 1000 / 60).toFixed(1)}m</p>
        </div>
        <div className="metric-card text-center">
          <p className="stat-label">Analyzed On</p>
          <p className="stat-value text-brand-700 text-xs">{new Date(analysis.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Agent Results by Category */}
      <div className="space-y-4">
        {RESULT_CATEGORIES.map((category) => {
          const categoryResults = analysis.agentResults.filter(a =>
            category.agentIds.includes(a.agentId)
          );
          const isCategoryExpanded = expandedCategories.has(category.label);
          const successCount = categoryResults.filter(a => !a.error).length;

          return (
            <div key={category.label} className="elevated-card overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.label)}
                className="w-full flex items-center gap-3 p-4 hover:bg-surface-50/50 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{category.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="text-sm font-bold text-surface-900">{category.label}</h3>
                  <p className="text-xs text-surface-500">{category.subtitle} — {successCount}/{categoryResults.length} agents completed</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-surface-400">{categoryResults.length} agents</span>
                  <svg
                    className={`w-4 h-4 text-surface-400 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Agent Cards */}
              {isCategoryExpanded && (
                <div className="border-t border-surface-200/60 p-3 space-y-2">
                  {categoryResults.length > 0 ? categoryResults.map((agent) => (
                    <AgentReportCard
                      key={agent.agentId}
                      agent={agent}
                      expanded={expandedAgents.has(agent.agentId)}
                      onToggle={() => toggleAgent(agent.agentId)}
                    />
                  )) : (
                    <p className="text-xs text-surface-400 py-3 text-center">No agents in this category</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Single Agent Report Card ─── */
function AgentReportCard({
  agent,
  expanded,
  onToggle,
}: {
  agent: AgentResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const duration = agent.durationMs ? `${(agent.durationMs / 1000).toFixed(1)}s` : '';
  const lines = agent.reply.split('\n').filter(l => l.trim());
  const preview = lines.slice(0, 2).join(' ').slice(0, 150);

  return (
    <div className={`rounded-xl border transition-all ${
      agent.error
        ? 'border-red-200 bg-red-50/30'
        : expanded
          ? 'border-brand-200 bg-brand-50/20'
          : 'border-surface-200/60 bg-white hover:bg-surface-50/30'
    }`}>
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left">
        <span className="text-xl flex-shrink-0">{agent.agentIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-surface-900 text-sm">{agent.agentName}</span>
            {duration && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-500 border border-surface-200">
                {duration}
              </span>
            )}
            {agent.error && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                Error
              </span>
            )}
            {agent.provenance?.dataQuality && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                agent.provenance.dataQuality === 'verified-external'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : agent.provenance.dataQuality === 'internal-calculation'
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-surface-50 text-surface-500 border-surface-200'
              }`}>
                {agent.provenance.dataQuality.replace('-', ' ')}
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-surface-500 mt-0.5 truncate">{preview || 'Analysis complete'}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-surface-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-surface-200/60">
          {agent.error ? (
            <div className="text-sm text-red-600 mt-3 p-3 bg-red-50 rounded-lg">{agent.reply}</div>
          ) : (
            <div className="mt-3 prose prose-sm max-w-none text-surface-700">
              <AgentMarkdown content={agent.reply} />
            </div>
          )}

          {/* Provenance / Data Sources */}
          {agent.provenance && (
            <div className="mt-3 pt-3 border-t border-surface-200/40">
              <p className="text-xs font-semibold text-surface-500 mb-1.5">Data Sources & Provenance</p>
              <div className="flex flex-wrap gap-1">
                {agent.provenance.externalApis?.map((api, i) => (
                  <span key={`api-${i}`} className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                    {api}
                  </span>
                ))}
                {agent.provenance.internalTools?.map((tool, i) => (
                  <span key={`tool-${i}`} className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                    {tool}
                  </span>
                ))}
                {(agent.provenance.webSearches ?? 0) > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">
                    {agent.provenance.webSearches} web searches
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Simple Markdown Renderer ─── */
function AgentMarkdown({ content }: { content: string }) {
  const sections = content.split(/^(#{1,3}\s.+)$/gm);

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          return <h4 key={i} className="text-sm font-semibold text-surface-900 mt-3 mb-1">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={i} className="text-base font-semibold text-surface-900 mt-4 mb-1">{trimmed.replace('## ', '')}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={i} className="text-lg font-bold text-surface-900 mt-4 mb-2">{trimmed.replace('# ', '')}</h2>;
        }

        // Bullet points
        if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(l => l.trim());
          return (
            <div key={i} className="space-y-1">
              {items.map((item, j) => {
                const cleanItem = item.replace(/^[-•]\s*/, '');
                if (item.trim().startsWith('-') || item.trim().startsWith('•')) {
                  return (
                    <p key={j} className="text-sm text-surface-600 pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-brand-400">
                      {cleanItem}
                    </p>
                  );
                }
                return <p key={j} className="text-sm text-surface-600">{item}</p>;
              })}
            </div>
          );
        }

        return (
          <p key={i} className="text-sm text-surface-600 whitespace-pre-wrap leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
