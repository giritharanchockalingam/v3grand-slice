// ─── Recommendation Card ────────────────────────────────────────────
'use client';

import type { RecommendationState } from '@v3grand/core';

const VERDICT_COLORS: Record<string, string> = {
  'INVEST':          'bg-green-100 text-green-800 border-green-300',
  'HOLD':            'bg-yellow-100 text-yellow-800 border-yellow-300',
  'DE-RISK':         'bg-orange-100 text-orange-800 border-orange-300',
  'EXIT':            'bg-red-100 text-red-800 border-red-300',
  'DO-NOT-PROCEED':  'bg-red-200 text-red-900 border-red-400',
};

const GATE_TOOLTIPS: Record<string, string> = {
  'IRR Gate':        'Checks if projected IRR exceeds the target hurdle rate',
  'NPV Gate':        'Validates that net present value is positive at WACC',
  'DSCR Gate':       'Ensures average debt service coverage ratio ≥ 1.25x',
  'Equity Multiple': 'Confirms equity multiple exceeds the minimum threshold',
  'Payback Gate':    'Verifies payback period is within acceptable range',
  'Factor Score':    'Composite score from market, location, and deal quality factors',
};

interface Props {
  recommendation: RecommendationState | null;
}

export function RecommendationCard({ recommendation }: Props) {
  if (!recommendation) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-500">Recommendation</h3>
        <p className="mt-2 text-gray-400 text-sm">No recommendation yet. Run the underwriter to generate one.</p>
      </div>
    );
  }

  const colorClass = VERDICT_COLORS[recommendation.verdict] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">Recommendation</h3>

      <div className={`inline-block rounded-md border px-3 py-1 text-lg font-bold ${colorClass}`}>
        {recommendation.verdict}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div>
          <span className="text-xs text-gray-500">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${recommendation.confidence}%` }}
              />
            </div>
            <span className="text-sm font-medium">{recommendation.confidence}</span>
          </div>
        </div>

        <div>
          <span className="text-xs text-gray-500">Version</span>
          <p className="text-sm font-medium">v{recommendation.version}</p>
        </div>

        {recommendation.isFlip && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            FLIP from {recommendation.previousVerdict}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-600">{recommendation.explanation}</p>

      {recommendation.gateResults && (
        <div className="mt-3 grid grid-cols-2 gap-1">
          {(recommendation.gateResults as Array<{ name: string; passed: boolean }>).map((g) => (
            <div key={g.name} className="flex items-center gap-1 text-xs" title={GATE_TOOLTIPS[g.name] ?? ''}>
              <span>{g.passed ? '✅' : '❌'}</span>
              <span className={g.passed ? 'text-gray-600' : 'text-red-600'}>{g.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
