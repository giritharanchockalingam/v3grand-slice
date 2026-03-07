// ─── Recommendation Card with Investor-Grade Intelligence ───────────
'use client';

import { useState } from 'react';
import type { RecommendationState } from '@v3grand/core';

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; glow: string; accent: string }> = {
  'INVEST':         { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', glow: 'shadow-emerald-100', accent: 'bg-emerald-500' },
  'HOLD':           { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   glow: 'shadow-amber-100',   accent: 'bg-amber-500' },
  'DE-RISK':        { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  glow: 'shadow-orange-100',  accent: 'bg-orange-500' },
  'EXIT':           { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     glow: 'shadow-red-100',     accent: 'bg-red-500' },
  'DO-NOT-PROCEED': { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300',     glow: 'shadow-red-100',     accent: 'bg-red-600' },
};

const CONFIDENCE_COLORS = (c: number) =>
  c >= 80 ? 'bg-emerald-500' : c >= 60 ? 'bg-blue-500' : c >= 40 ? 'bg-amber-500' : 'bg-red-400';

interface DecisionInsight {
  narrative: string;
  topDrivers: string[];
  topRisks: string[];
  flipConditions: string[];
  riskFlags: string[];
}

interface Props {
  recommendation: RecommendationState | null;
  decisionInsight?: DecisionInsight | null;
}

export function RecommendationCard({ recommendation, decisionInsight }: Props) {
  const [showGates, setShowGates] = useState(false);

  if (!recommendation) {
    return (
      <div className="elevated-card p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-surface-700">No Recommendation</h3>
        <p className="mt-1 text-surface-400 text-xs">Run the underwriter to generate one.</p>
      </div>
    );
  }

  const style = VERDICT_STYLES[recommendation.verdict] ?? VERDICT_STYLES['HOLD'];
  const hasInsight = decisionInsight && (decisionInsight.narrative || decisionInsight.topDrivers.length > 0);

  return (
    <div className="elevated-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Recommendation</h3>
        <span className="text-2xs font-mono text-surface-400">v{recommendation.version}</span>
      </div>

      {/* Verdict Badge */}
      <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${style.bg} ${style.border} ${style.glow} shadow-sm mb-4`}>
        <div className={`w-2.5 h-2.5 rounded-full ${CONFIDENCE_COLORS(recommendation.confidence)}`} />
        <span className={`text-lg font-bold tracking-tight ${style.text}`}>
          {recommendation.verdict}
        </span>
      </div>

      {/* Confidence */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-surface-500">Confidence</span>
          <span className="text-sm font-bold text-surface-900">{recommendation.confidence}%</span>
        </div>
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${CONFIDENCE_COLORS(recommendation.confidence)}`}
            style={{ width: `${recommendation.confidence}%` }}
          />
        </div>
      </div>

      {/* Flip Indicator */}
      {recommendation.isFlip && (
        <div className="badge-warning mb-3">
          FLIP from {recommendation.previousVerdict}
        </div>
      )}

      {/* Narrative (investor-grade summary) */}
      {hasInsight && decisionInsight?.narrative && (
        <div className="mb-4 p-3 bg-surface-50 rounded-lg border border-surface-100">
          <p className="text-xs text-surface-700 leading-relaxed">{decisionInsight.narrative}</p>
        </div>
      )}

      {/* Fallback: basic explanation when no insight available */}
      {!hasInsight && recommendation.explanation && (
        <p className="text-xs text-surface-600 leading-relaxed mb-4 line-clamp-3">{recommendation.explanation}</p>
      )}

      {/* Top Drivers */}
      {hasInsight && decisionInsight!.topDrivers.length > 0 && (
        <div className="mb-3">
          <h4 className="text-2xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Top Drivers</h4>
          <div className="space-y-1.5">
            {decisionInsight!.topDrivers.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-600 mt-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-surface-700 leading-snug">{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Risks */}
      {hasInsight && decisionInsight!.topRisks.length > 0 && (
        <div className="mb-3">
          <h4 className="text-2xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Key Risks</h4>
          <div className="space-y-1.5">
            {decisionInsight!.topRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500 mt-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-surface-700 leading-snug">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flip Conditions */}
      {hasInsight && decisionInsight!.flipConditions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-2xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
            {recommendation.verdict === 'INVEST' ? 'What Could Change' : 'To Change This Verdict'}
          </h4>
          <div className="space-y-1.5">
            {decisionInsight!.flipConditions.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-blue-50 text-blue-500 mt-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-surface-700 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Gate Results */}
      {recommendation.gateResults && Array.isArray(recommendation.gateResults) && (
        <div className="mt-auto pt-3 border-t border-surface-100">
          <button
            onClick={() => setShowGates(!showGates)}
            className="flex items-center gap-1.5 text-2xs font-medium text-surface-500 hover:text-surface-700 transition-colors mb-2 w-full"
          >
            <svg className={`w-3 h-3 transition-transform ${showGates ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {showGates ? 'Hide' : 'Show'} Gate Results ({(recommendation.gateResults as Array<{ name: string; passed: boolean }>).filter(g => g.passed).length}/{(recommendation.gateResults as Array<{ name: string; passed: boolean }>).length} passing)
          </button>
          {showGates && (
            <div className="grid grid-cols-2 gap-1.5 animate-slide-down">
              {(recommendation.gateResults as Array<{ name: string; passed: boolean }>).map((g) => (
                <div key={g.name} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${g.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {g.passed ? '✓' : '✕'}
                  </div>
                  <span className={g.passed ? 'text-surface-600' : 'text-red-600 font-medium'}>{g.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
