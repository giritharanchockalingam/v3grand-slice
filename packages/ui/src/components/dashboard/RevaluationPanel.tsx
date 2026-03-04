// ─── Monthly Revaluation Panel ──────────────────────────────────────
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api-client';

interface RecommendationHistoryItem {
  version: number;
  verdict: string;
  confidence: number;
  timestamp: string;
  explanation?: string;
  previousVerdict?: string | null;
  isFlip?: boolean;
  gateResults?: Array<{ name: string; passed: boolean }>;
}

interface Props {
  dealId: string;
  currentMonth: number;
  lifecyclePhase: string;
  recommendationHistory?: RecommendationHistoryItem[];
  latestRecommendation?: {
    verdict: string;
    confidence: number;
    explanation?: string;
    gateResults?: Array<{ name: string; passed: boolean }>;
  } | null;
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'INVEST':         { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'HOLD':           { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  'DE-RISK':        { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500' },
  'EXIT':           { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
  'DO-NOT-PROCEED': { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300',     dot: 'bg-red-700' },
};

export function RevaluationPanel({
  dealId,
  currentMonth,
  lifecyclePhase,
  recommendationHistory = [],
  latestRecommendation,
}: Props) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const revalue = useMutation({
    mutationFn: (advanceMonth: boolean) =>
      api.post<any>(`/deals/${dealId}/revalue`, { advanceMonth }),
    onSuccess: (_data: any, advanceMonth: boolean) => {
      setFeedback({
        msg: advanceMonth
          ? `Month advanced to ${currentMonth + 1} — revaluation complete`
          : 'Revaluation complete for current month',
        type: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({ msg: err?.message ?? 'Revaluation failed', type: 'error' });
    },
  });

  const displayLatest = latestRecommendation || (recommendationHistory[0] as any);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <span>🔄</span> Monthly Revaluation
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Month <span className="font-bold text-brand-700">{currentMonth}</span>
            {' · '}
            <span className="text-surface-400 capitalize">{lifecyclePhase.replace('-', ' ')}</span>
          </p>
        </div>
        <div className="badge-brand capitalize">
          {lifecyclePhase.replace('-', ' ')}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={feedback.type === 'error' ? 'toast-error' : 'toast-success'}>
          <span className="font-medium">
            {feedback.type === 'error' ? '✕ ' : '✓ '}{feedback.msg}
          </span>
          <button onClick={() => setFeedback(null)} className="ml-3 text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => revalue.mutate(true)}
          disabled={revalue.isPending}
          className="btn-primary py-3.5 text-base"
        >
          {revalue.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : 'Advance Month & Revalue'}
        </button>
        <button
          onClick={() => revalue.mutate(false)}
          disabled={revalue.isPending}
          className="btn-secondary py-3.5 text-base"
        >
          {revalue.isPending ? 'Processing...' : 'Revalue (Same Month)'}
        </button>
      </div>

      {/* Latest Recommendation */}
      {displayLatest && (() => {
        const s = VERDICT_STYLES[displayLatest.verdict] ?? VERDICT_STYLES['HOLD'];
        return (
          <div className="rounded-xl border border-surface-200/80 bg-surface-50/50 p-5">
            <h3 className="section-title mb-3">Latest Recommendation</h3>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
                  {displayLatest.verdict}
                </span>
                {(displayLatest as any).isFlip && (
                  <span className="badge-warning text-2xs">
                    FLIP from {(displayLatest as any).previousVerdict}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xs text-surface-400 mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${displayLatest.confidence >= 80 ? 'bg-emerald-500' : displayLatest.confidence >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                      style={{ width: `${displayLatest.confidence}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-surface-900">{displayLatest.confidence}%</span>
                </div>
              </div>
            </div>
            {displayLatest.explanation && (
              <p className="text-xs text-surface-600 bg-white rounded-lg border border-surface-200/60 p-3 leading-relaxed">
                {displayLatest.explanation}
              </p>
            )}
          </div>
        );
      })()}

      {/* Gate Check Results */}
      {displayLatest?.gateResults && displayLatest.gateResults.length > 0 && (
        <div className="rounded-xl border border-surface-200/80 bg-surface-50/50 p-5">
          <h3 className="section-title mb-3">Gate Checks</h3>
          <div className="grid grid-cols-2 gap-2">
            {displayLatest.gateResults.map((g: { name: string; passed: boolean }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-surface-200/60 px-3 py-2.5">
                <div className={`w-5 h-5 rounded flex items-center justify-center text-2xs font-bold ${g.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                  {g.passed ? '✓' : '✕'}
                </div>
                <span className={g.passed ? 'text-surface-700' : 'text-red-600 font-medium'}>{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Sparkline */}
      {recommendationHistory.length > 1 && (
        <div className="rounded-xl border border-surface-200/80 bg-surface-50/50 p-5">
          <h3 className="section-title mb-3">Confidence Trend</h3>
          <div className="h-12 flex items-end gap-1 bg-white rounded-lg border border-surface-200/60 p-3">
            {[...recommendationHistory].reverse().map((item, idx) => {
              const pct = Math.max(item.confidence, 5);
              const color = item.confidence >= 80 ? 'bg-emerald-400' : item.confidence >= 60 ? 'bg-brand-400' : 'bg-amber-400';
              return (
                <div
                  key={idx}
                  className={`flex-1 ${color} rounded-t transition-all hover:opacity-80`}
                  style={{ height: `${pct}%` }}
                  title={`v${item.version}: ${item.confidence}% — ${item.verdict}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-2xs text-surface-400 mt-2 font-mono">
            <span>v{recommendationHistory[recommendationHistory.length - 1]?.version}</span>
            <span>Latest: v{recommendationHistory[0]?.version} ({recommendationHistory[0]?.confidence}%)</span>
          </div>
        </div>
      )}

      {/* Revaluation History Timeline */}
      {recommendationHistory.length > 0 && (
        <div className="rounded-xl border border-surface-200/80 bg-surface-50/50 p-5">
          <h3 className="section-title mb-3">Revaluation History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recommendationHistory.map((item, idx) => {
              const s = VERDICT_STYLES[item.verdict] ?? VERDICT_STYLES['HOLD'];
              return (
                <div key={item.version} className="flex items-start gap-3 bg-white rounded-xl border border-surface-200/60 p-3 hover:border-brand-200 transition-all">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-3 h-3 rounded-full ${s.dot}`} />
                    {idx < recommendationHistory.length - 1 && <div className="w-0.5 h-6 bg-surface-200 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xs font-mono text-surface-400">v{item.version}</span>
                      <span className={`text-2xs font-bold px-2 py-0.5 rounded-md border ${s.bg} ${s.text} ${s.border}`}>
                        {item.verdict}
                      </span>
                      {item.isFlip && (
                        <span className="text-2xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">FLIP</span>
                      )}
                      <span className="text-2xs text-surface-400 ml-auto font-mono">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${item.confidence}%` }} />
                      </div>
                      <span className="text-2xs text-surface-500">{item.confidence}%</span>
                    </div>
                    {item.explanation && (
                      <p className="text-2xs text-surface-400 mt-1 line-clamp-1">{item.explanation}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recommendationHistory.length === 0 && !displayLatest && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-surface-500">No revaluation history yet.</p>
          <p className="text-xs text-surface-400 mt-1">Run your first revaluation to begin tracking.</p>
        </div>
      )}
    </div>
  );
}
