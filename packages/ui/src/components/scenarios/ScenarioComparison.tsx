'use client';
import { useState } from 'react';
import { useScenarios, usePromoteScenario, type ScenarioResult } from '../../hooks/use-scenarios';

const SCENARIO_COLORS: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  bear: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', label: 'Bear (Downside)' },
  base: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', label: 'Base (Expected)' },
  bull: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', label: 'Bull (Upside)' },
};

const VERDICT_COLORS: Record<string, string> = {
  INVEST: 'bg-green-600 text-white',
  HOLD: 'bg-yellow-500 text-white',
  'DE-RISK': 'bg-orange-500 text-white',
  EXIT: 'bg-red-600 text-white',
  'DO-NOT-PROCEED': 'bg-red-800 text-white',
};

function fmt(v: number): string {
  if (Math.abs(v) >= 1_00_00_000) return (v / 1_00_00_000).toFixed(1) + ' Cr';
  if (Math.abs(v) >= 1_00_000) return (v / 1_00_000).toFixed(1) + ' L';
  return v.toLocaleString('en-IN');
}

function ScenarioCard({
  scenarioKey,
  result,
  isActive,
  onPromote,
  promoting,
}: {
  scenarioKey: string;
  result: ScenarioResult | null;
  isActive: boolean;
  onPromote: () => void;
  promoting: boolean;
}) {
  const colors = SCENARIO_COLORS[scenarioKey] ?? SCENARIO_COLORS.base;

  if (!result) {
    return (
      <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-5 opacity-50`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${colors.badge}`}>{colors.label}</span>
        </div>
        <p className="text-gray-500 text-sm">No scenario data. Run Recompute to generate.</p>
      </div>
    );
  }

  const { proforma: p, decision: d } = result;

  return (
    <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-5 ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${colors.badge}`}>{colors.label}</span>
        {isActive ? (
          <span className="text-xs font-medium px-2 py-1 rounded bg-blue-600 text-white">Active</span>
        ) : (
          <button
            onClick={onPromote}
            disabled={promoting}
            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {promoting ? 'Promoting...' : 'Promote to Active'}
          </button>
        )}
      </div>

      {/* Verdict */}
      <div className="mb-4">
        <span className={`inline-block text-sm font-bold px-3 py-1 rounded ${VERDICT_COLORS[d.verdict] ?? 'bg-gray-400 text-white'}`}>
          {d.verdict}
        </span>
        <span className="text-xs text-gray-500 ml-2">Confidence: {d.confidence}</span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricBox label="IRR" value={`${(p.irr * 100).toFixed(1)}%`} good={p.irr > 0.15} />
        <MetricBox label="NPV" value={`${fmt(p.npv)}`} good={p.npv > 0} />
        <MetricBox label="Eq. Multiple" value={`${p.equityMultiple.toFixed(2)}x`} good={p.equityMultiple > 1.8} />
        <MetricBox label="Avg DSCR" value={`${p.avgDSCR.toFixed(2)}x`} good={p.avgDSCR > 1.3} />
        <MetricBox label="Payback" value={`${p.paybackYear} yr`} good={p.paybackYear <= 8} />
        <MetricBox label="Exit Value" value={fmt(p.exitValue)} good={true} />
      </div>

      {/* Gate Results */}
      <div className="text-xs space-y-1">
        {d.gateResults.map((g) => (
          <div key={g.name} className="flex items-center gap-1">
            <span>{g.passed ? '✅' : '❌'}</span>
            <span className={g.passed ? 'text-gray-600' : 'text-red-600'}>{g.name}</span>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">{d.explanation}</p>
    </div>
  );
}

function MetricBox({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="bg-white rounded p-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-bold ${good ? 'text-green-700' : 'text-red-600'}`}>{value}</div>
    </div>
  );
}

export function ScenarioComparison({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useScenarios(dealId);
  const promote = usePromoteScenario(dealId);

  if (isLoading) return <div className="p-8 text-gray-400">Loading scenarios...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading scenarios: {(error as Error).message}</div>;
  if (!data) return <div className="p-8 text-gray-400">No scenario data available.</div>;

  const { scenarios, activeScenario } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Scenario Comparison</h2>
        <span className="text-sm text-gray-500">
          Active scenario: <strong className="text-blue-600">{activeScenario}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['bear', 'base', 'bull'] as const).map((key) => (
          <ScenarioCard
            key={key}
            scenarioKey={key}
            result={scenarios[key]}
            isActive={activeScenario === key}
            onPromote={() => promote.mutate(key)}
            promoting={promote.isPending}
          />
        ))}
      </div>

      {/* Comparison Table */}
      {scenarios.base && scenarios.bear && scenarios.bull && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Year-by-Year Revenue Comparison (Cr)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="px-3 py-2 text-left">Year</th>
                  <th className="px-3 py-2 text-right text-red-600">Bear Revenue</th>
                  <th className="px-3 py-2 text-right text-blue-600">Base Revenue</th>
                  <th className="px-3 py-2 text-right text-green-600">Bull Revenue</th>
                  <th className="px-3 py-2 text-right text-red-600">Bear EBITDA</th>
                  <th className="px-3 py-2 text-right text-blue-600">Base EBITDA</th>
                  <th className="px-3 py-2 text-right text-green-600">Bull EBITDA</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.base.proforma.years.map((_, i) => {
                  const bear = scenarios.bear!.proforma.years[i];
                  const base = scenarios.base!.proforma.years[i];
                  const bull = scenarios.bull!.proforma.years[i];
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium">{i + 1}</td>
                      <td className="px-3 py-1.5 text-right text-red-600">{fmt(bear?.totalRevenue ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-600">{fmt(base?.totalRevenue ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-green-600">{fmt(bull?.totalRevenue ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-red-600">{fmt(bear?.ebitda ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-600">{fmt(base?.ebitda ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-green-600">{fmt(bull?.ebitda ?? 0)}</td>
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
