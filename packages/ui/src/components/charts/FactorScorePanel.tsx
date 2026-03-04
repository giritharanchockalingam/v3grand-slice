// ─── Factor Score Panel ──────────────────────────────────────────────
'use client';

interface Props {
  globalScore?: number;
  localScore?: number;
  assetScore?: number;
  sponsorScore?: number;
  composite?: number;
  requiredReturn?: number;
  impliedDiscount?: number;
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{clampedScore.toFixed(0)}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
    </div>
  );
}

export function FactorScorePanel({
  globalScore = 72,
  localScore = 78,
  assetScore = 68,
  sponsorScore = 85,
  composite = 75,
  requiredReturn = 0.14,
  impliedDiscount = 0.06,
}: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-teal-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Factor Scores & Valuation</h3>

      {/* Composite Score Highlight */}
      <div className="mb-6 rounded-lg bg-gradient-to-r from-teal-50 to-teal-100 border border-teal-200 p-4">
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-bold text-teal-700">{composite.toFixed(0)}</div>
          <div>
            <p className="text-xs text-teal-600 font-medium">Composite Score</p>
            <p className="text-xs text-teal-500">
              {composite >= 80 ? 'Excellent' : composite >= 70 ? 'Strong' : 'Acceptable'}
            </p>
          </div>
        </div>
      </div>

      {/* Individual Scores */}
      <div className="space-y-4 mb-6">
        <ScoreBar
          label="Global Domain"
          score={globalScore}
          color={getScoreColor(globalScore)}
        />
        <ScoreBar
          label="Local Domain"
          score={localScore}
          color={getScoreColor(localScore)}
        />
        <ScoreBar
          label="Asset Quality"
          score={assetScore}
          color={getScoreColor(assetScore)}
        />
        <ScoreBar
          label="Sponsor Strength"
          score={sponsorScore}
          color={getScoreColor(sponsorScore)}
        />
      </div>

      {/* Valuation Metrics */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Required Return (WACC)</span>
          <span className="text-sm font-bold text-gray-900">{(requiredReturn * 100).toFixed(2)}%</span>
        </div>
        <div className="h-px bg-gray-200" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Implied Discount Rate</span>
          <span className="text-sm font-bold text-gray-900">{(impliedDiscount * 100).toFixed(2)}%</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Scores evaluate market conditions, location strengths, asset characteristics, and sponsor experience.
      </p>
    </div>
  );
}
