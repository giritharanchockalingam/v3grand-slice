// ─── Recommendation History ──────────────────────────────────────────
'use client';

import { useState } from 'react';

interface HistoricalRecommendation {
  version: number;
  verdict: string;
  confidence: number;
  timestamp: string;
  month?: number;
  explanation?: string;
  gateResults?: Array<{ name: string; passed: boolean }>;
  isFlip?: boolean;
  previousVerdict?: string | null;
}

interface Props {
  history?: HistoricalRecommendation[];
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'INVEST':         { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'HOLD':           { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  'DE-RISK':        { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500' },
  'EXIT':           { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
  'DO-NOT-PROCEED': { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300',     dot: 'bg-red-700' },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-surface-700">{value}%</span>
    </div>
  );
}

export function RecommendationHistory({ history }: Props) {
  const [expanded, setExpanded] = useState(false);

  const mockHistory: HistoricalRecommendation[] = [
    {
      verdict: 'INVEST', confidence: 82, version: 3,
      explanation: 'Strong IRR and DSCR metrics exceed hurdles. Market conditions favorable.',
      gateResults: [{ name: 'IRR Gate', passed: true }, { name: 'NPV Gate', passed: true }, { name: 'DSCR Gate', passed: true }, { name: 'Equity Multiple', passed: true }],
      isFlip: false, month: 3,
      timestamp: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      verdict: 'HOLD', confidence: 71, version: 2,
      explanation: 'NPV weak but IRR acceptable. Awaiting market clarity.',
      gateResults: [{ name: 'IRR Gate', passed: true }, { name: 'NPV Gate', passed: false }, { name: 'DSCR Gate', passed: true }, { name: 'Equity Multiple', passed: true }],
      isFlip: true, previousVerdict: 'DE-RISK', month: 2,
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      verdict: 'DE-RISK', confidence: 65, version: 1,
      explanation: 'Early stage analysis. Multiple scenarios under review.',
      gateResults: [{ name: 'IRR Gate', passed: true }, { name: 'NPV Gate', passed: false }, { name: 'DSCR Gate', passed: true }, { name: 'Equity Multiple', passed: false }],
      isFlip: false, month: 1,
      timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const displayHistory = history && history.length > 0 ? history : mockHistory;
  const recentRecommendations = displayHistory.slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">Recommendation History</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors flex items-center gap-1"
        >
          {expanded ? 'Collapse' : 'Expand'}
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {recentRecommendations.map((rec, idx) => {
          const s = VERDICT_STYLES[rec.verdict] ?? VERDICT_STYLES['HOLD'];
          return (
            <div key={idx} className="rounded-xl border border-surface-200/60 bg-surface-50/50 p-3.5 hover:border-surface-300/60 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {rec.verdict}
                  </span>
                  <span className="text-2xs text-surface-400 font-mono">v{rec.version}</span>
                  {rec.month && <span className="text-2xs text-surface-400">· Month {rec.month}</span>}
                  {rec.isFlip && (
                    <span className="badge-warning text-2xs">FLIP from {rec.previousVerdict}</span>
                  )}
                </div>
                <span className="text-2xs text-surface-400 font-mono flex-shrink-0">
                  {new Date(rec.timestamp).toLocaleDateString()}
                </span>
              </div>

              <div className="mb-2">
                <ConfidenceBar value={rec.confidence} />
              </div>

              {rec.explanation && (
                <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{rec.explanation}</p>
              )}

              {expanded && rec.gateResults && (
                <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-surface-100">
                  {(rec.gateResults as Array<{ name: string; passed: boolean }>).map((g) => (
                    <div key={g.name} className="flex items-center gap-1.5 text-2xs">
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${g.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {g.passed ? '✓' : '✕'}
                      </div>
                      <span className={g.passed ? 'text-surface-600' : 'text-red-600 font-medium'}>{g.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full History Table (Expanded) */}
      {expanded && displayHistory.length > 3 && (
        <div className="mt-4 pt-4 border-t border-surface-100">
          <p className="text-2xs text-surface-500 font-semibold uppercase tracking-wider mb-3">Full History</p>
          <div className="overflow-x-auto rounded-lg border border-surface-200/60">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-surface-50 text-surface-500 text-left">
                  <th className="px-3 py-2 font-semibold">Version</th>
                  <th className="px-3 py-2 font-semibold">Verdict</th>
                  <th className="px-3 py-2 font-semibold">Confidence</th>
                  <th className="px-3 py-2 font-semibold">Month</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((rec, idx) => {
                  const s = VERDICT_STYLES[rec.verdict] ?? VERDICT_STYLES['HOLD'];
                  return (
                    <tr key={idx} className="border-t border-surface-100 hover:bg-surface-50/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-surface-500">{rec.version}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-2xs font-bold ${s.bg} ${s.text}`}>
                          {rec.verdict}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{rec.confidence}%</td>
                      <td className="px-3 py-2 text-surface-500">{rec.month ?? '—'}</td>
                      <td className="px-3 py-2 text-surface-400 font-mono">
                        {new Date(rec.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
