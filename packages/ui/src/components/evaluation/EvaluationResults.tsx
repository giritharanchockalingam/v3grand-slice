// ─── Evaluation Results Dashboard ───────────────────────────────────
// Rich visuals: KPI tiles, scenario cards, sensitivity heatmap,
// capital structure comparison, risk matrix, IC scorecard

'use client';

import { useState } from 'react';
import type { DealEvaluationOutput, EvaluationVerdict } from '@v3grand/core';

interface Props {
  result: DealEvaluationOutput;
  onDownloadMemo: () => void;
  isGeneratingMemo: boolean;
}

const VERDICT_STYLE: Record<EvaluationVerdict, { bg: string; text: string; border: string }> = {
  APPROVE:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  CONDITIONAL: { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  DEFER:       { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200' },
  REJECT:      { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200' },
};

export function EvaluationResults({ result, onDownloadMemo, isGeneratingMemo }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'scenarios' | 'sensitivity' | 'capital' | 'risk' | 'operating' | 'scorecard'>('overview');
  const vstyle = VERDICT_STYLE[result.verdict];

  return (
    <div className="flex flex-col h-full">
      {/* Header: Verdict + Download */}
      <div className="px-6 pt-6 pb-4 border-b border-surface-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border ${vstyle.bg} ${vstyle.border}`}>
              <span className={`text-xl font-bold ${vstyle.text}`}>{result.verdict}</span>
            </div>
            <div>
              <div className="text-xs text-surface-400">Confidence</div>
              <div className="text-lg font-bold text-surface-900">{result.confidence}%</div>
            </div>
          </div>
          <button
            onClick={onDownloadMemo}
            disabled={isGeneratingMemo}
            className="px-4 py-2 rounded-xl bg-surface-800 text-white text-sm font-medium hover:bg-surface-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isGeneratingMemo ? 'Generating...' : 'Download IC Memo'}
          </button>
        </div>

        {/* Narrative */}
        <p className="text-sm text-surface-700 leading-relaxed bg-surface-50 p-3 rounded-lg border border-surface-100">{result.narrative}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 px-6 py-2 overflow-x-auto border-b border-surface-100">
        {([
          ['overview', 'Overview'], ['scenarios', 'Scenarios'], ['sensitivity', 'Sensitivity'],
          ['capital', 'Capital Structure'], ['risk', 'Risk Matrix'], ['operating', 'Operating Model'], ['scorecard', 'IC Scorecard'],
        ] as [typeof activeTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === key ? 'bg-brand-500 text-white' : 'text-surface-500 hover:bg-surface-50'
            }`}>{label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'overview' && <OverviewTab result={result} />}
        {activeTab === 'scenarios' && <ScenariosTab result={result} />}
        {activeTab === 'sensitivity' && <SensitivityTab result={result} />}
        {activeTab === 'capital' && <CapitalTab result={result} />}
        {activeTab === 'risk' && <RiskTab result={result} />}
        {activeTab === 'operating' && <OperatingTab result={result} />}
        {activeTab === 'scorecard' && <ScorecardTab result={result} />}
      </div>
    </div>
  );
}

// ── Overview Tab ──
function OverviewTab({ result }: { result: DealEvaluationOutput }) {
  return (
    <div className="space-y-6">
      {/* KPI Tiles */}
      <div className="grid grid-cols-3 gap-3">
        <KPITile label="IRR" value={pct(result.irr)} subtext={`Hurdle: ${pct(result.wacc.hurdleRate)}`}
          status={result.irr >= result.wacc.hurdleRate ? 'green' : 'red'} tooltip="Internal Rate of Return — annualized return on equity invested" />
        <KPITile label="NPV" value={crore(result.npv)} subtext={`at ${pct(result.wacc.hurdleRate)} hurdle`}
          status={result.npv > 0 ? 'green' : 'red'} tooltip="Net Present Value — total value created above the required return" />
        <KPITile label="Equity Multiple" value={`${result.equityMultiple.toFixed(2)}x`} subtext={`Payback: Yr ${result.paybackYears}`}
          status={result.equityMultiple >= 2.0 ? 'green' : result.equityMultiple >= 1.5 ? 'amber' : 'red'} tooltip="Total distributions / equity invested" />
        <KPITile label="Avg DSCR" value={`${result.avgDSCR.toFixed(2)}x`} subtext="Debt service coverage"
          status={result.avgDSCR >= 1.4 ? 'green' : result.avgDSCR >= 1.2 ? 'amber' : 'red'} tooltip="Average annual EBITDA / annual debt service" />
        <KPITile label="WACC" value={pct(result.wacc.wacc)} subtext={`CoE: ${pct(result.wacc.costOfEquity)}`} status="neutral" tooltip="Weighted Average Cost of Capital" />
        <KPITile label="EBITDA Margin" value={pct(result.ebitdaMarginStabilized)} subtext="At stabilization"
          status={result.ebitdaMarginStabilized >= 0.35 ? 'green' : result.ebitdaMarginStabilized >= 0.25 ? 'amber' : 'red'} />
      </div>

      {/* Probability-Weighted Returns */}
      <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Probability-Weighted Returns</h4>
        <div className="flex gap-8">
          <div>
            <span className="text-2xs text-surface-400">PW-IRR</span>
            <div className="text-lg font-bold text-surface-800">{pct(result.probabilityWeightedIRR)}</div>
          </div>
          <div>
            <span className="text-2xs text-surface-400">PW-NPV</span>
            <div className="text-lg font-bold text-surface-800">{crore(result.probabilityWeightedNPV)}</div>
          </div>
        </div>
      </div>

      {/* Drivers & Risks */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Top Drivers</h4>
          <div className="space-y-1.5">
            {result.decisionDrivers.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-600 mt-0.5 text-2xs">▲</div>
                <span className="text-surface-700">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Key Risks</h4>
          <div className="space-y-1.5">
            {result.decisionRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500 mt-0.5 text-2xs">▼</div>
                <span className="text-surface-700">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flip Conditions */}
      {result.flipConditions.length > 0 && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <h4 className="text-xs font-semibold text-blue-700 mb-2">
            {result.verdict === 'APPROVE' ? 'What Could Change This Verdict' : 'What Must Improve'}
          </h4>
          <div className="space-y-1">
            {result.flipConditions.map((f, i) => (
              <div key={i} className="text-xs text-blue-800 flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0">→</span> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10-Year Projections Summary */}
      <div>
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">10-Year Projection</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-surface-400">
                <th className="text-left py-1 pr-3">Year</th>
                <th className="text-right py-1 px-2">Revenue</th>
                <th className="text-right py-1 px-2">EBITDA</th>
                <th className="text-right py-1 px-2">Margin</th>
                <th className="text-right py-1 px-2">DSCR</th>
                <th className="text-right py-1 px-2">FCFE</th>
              </tr>
            </thead>
            <tbody>
              {result.projections.map(p => (
                <tr key={p.year} className="border-t border-surface-50">
                  <td className="py-1 pr-3 font-medium">Y{p.year}</td>
                  <td className="text-right px-2 font-mono">{crore(p.revenue)}</td>
                  <td className="text-right px-2 font-mono">{crore(p.ebitda)}</td>
                  <td className="text-right px-2">{pct(p.ebitdaMargin)}</td>
                  <td className={`text-right px-2 font-mono ${p.dscr < 1.2 ? 'text-red-500' : ''}`}>{p.dscr.toFixed(2)}x</td>
                  <td className={`text-right px-2 font-mono ${p.fcfe < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{crore(p.fcfe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Scenarios Tab ──
function ScenariosTab({ result }: { result: DealEvaluationOutput }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {(['bear', 'base', 'bull'] as const).map(key => {
          const s = result.scenarioResults[key];
          const sv = VERDICT_STYLE[s.verdict];
          const borderColor = key === 'bear' ? 'border-red-200' : key === 'bull' ? 'border-emerald-200' : 'border-blue-200';
          return (
            <div key={key} className={`p-4 rounded-xl border ${borderColor} bg-white`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold capitalize">{s.label}</h4>
                <span className="text-2xs text-surface-400">{(s.probability * 100).toFixed(0)}% prob</span>
              </div>
              <div className={`inline-block px-2 py-0.5 rounded-lg text-2xs font-bold ${sv.bg} ${sv.text} ${sv.border} border mb-3`}>{s.verdict}</div>
              <div className="space-y-2">
                <MetricRow label="IRR" value={pct(s.irr)} />
                <MetricRow label="NPV" value={crore(s.npv)} />
                <MetricRow label="Multiple" value={`${s.equityMultiple.toFixed(2)}x`} />
                <MetricRow label="DSCR" value={`${s.dscr.toFixed(2)}x`} />
                <MetricRow label="Payback" value={`Year ${s.paybackYears}`} />
                <MetricRow label="EBITDA Margin" value={pct(s.ebitdaMarginStabilized)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Probability-Weighted Metrics</h4>
        <div className="flex gap-6">
          <div><span className="text-2xs text-surface-400">PW-IRR:</span> <span className="font-bold">{pct(result.probabilityWeightedIRR)}</span></div>
          <div><span className="text-2xs text-surface-400">PW-NPV:</span> <span className="font-bold">{crore(result.probabilityWeightedNPV)}</span></div>
        </div>
      </div>

      {/* Lite Alternatives */}
      {result.liteAlternativeResults.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Lite Alternative Comparison</h4>
          {result.liteAlternativeResults.map((alt, i) => (
            <div key={i} className="p-3 rounded-xl border border-surface-200 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-surface-700">{alt.description}</span>
                <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                  alt.riskRating === 'LOW' ? 'bg-emerald-50 text-emerald-700' : alt.riskRating === 'MODERATE' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                }`}>{alt.riskRating}</span>
              </div>
              <div className="flex gap-4 text-xs text-surface-500">
                <span>IRR: {pct(alt.irr)}</span>
                <span>NPV: {crore(alt.npv)}</span>
                <span className="text-surface-400">{alt.comparisonToBase.riskDelta}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sensitivity Tab ──
function SensitivityTab({ result }: { result: DealEvaluationOutput }) {
  if (!result.sensitivityMatrix) {
    return (
      <div className="text-center py-12 text-surface-400">
        <p className="text-sm">No sensitivity analysis configured.</p>
        <p className="text-xs mt-1">Add sensitivityConfig to the input to enable this view.</p>
      </div>
    );
  }

  const matrix = result.sensitivityMatrix;
  return (
    <div>
      <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
        IRR Sensitivity: {matrix.rowAxis.label} vs {matrix.colAxis.label}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-surface-400 border border-surface-100">{matrix.rowAxis.label} ↓ / {matrix.colAxis.label} →</th>
              {matrix.colAxis.values.map((v, ci) => (
                <th key={ci} className="p-2 text-center border border-surface-100 font-mono text-surface-500">
                  {matrix.colAxis.unit === 'pct' ? pct(v) : matrix.colAxis.unit === 'currency' ? `₹${v.toLocaleString()}` : v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.cells.map((row, ri) => (
              <tr key={ri}>
                <td className="p-2 border border-surface-100 font-mono text-surface-500">
                  {matrix.rowAxis.unit === 'pct' ? pct(matrix.rowAxis.values[ri]) : matrix.rowAxis.values[ri]}
                </td>
                {row.map((cell, ci) => {
                  const color = cell.verdict === 'APPROVE' ? 'bg-emerald-100 text-emerald-800'
                    : cell.verdict === 'CONDITIONAL' ? 'bg-amber-100 text-amber-800'
                    : cell.verdict === 'DEFER' ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800';
                  const isBase = ri === matrix.baseCase.row && ci === matrix.baseCase.col;
                  return (
                    <td key={ci} className={`p-2 border border-surface-100 text-center font-mono ${color} ${isBase ? 'ring-2 ring-brand-500 ring-inset' : ''}`}>
                      {pct(cell.irr)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-4 text-2xs text-surface-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100" /> APPROVE</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100" /> CONDITIONAL</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100" /> DEFER</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100" /> REJECT</span>
      </div>
    </div>
  );
}

// ── Capital Structure Tab ──
function CapitalTab({ result }: { result: DealEvaluationOutput }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Capital Structure Comparison</h4>
      <div className="grid grid-cols-3 gap-4">
        {result.capitalStructureComparison.map((opt, i) => (
          <div key={i} className="p-4 rounded-xl border border-surface-200 bg-white">
            <h5 className="text-sm font-bold text-surface-800 mb-3">{opt.label}</h5>
            <div className="space-y-2">
              <MetricRow label="Debt / Equity" value={`${(opt.debtPct * 100).toFixed(0)}/${(opt.equityPct * 100).toFixed(0)}`} />
              <MetricRow label="IRR" value={pct(opt.irr)} highlight={opt.irr >= result.wacc.hurdleRate} />
              <MetricRow label="NPV" value={crore(opt.npv)} highlight={opt.npv > 0} />
              <MetricRow label="DSCR" value={`${opt.dscr.toFixed(2)}x`} highlight={opt.dscr >= 1.3} />
              <MetricRow label="Multiple" value={`${opt.equityMultiple.toFixed(2)}x`} />
              <MetricRow label="Payback" value={`Year ${opt.paybackYears}`} />
            </div>
            {/* Visual bar for leverage */}
            <div className="mt-3 h-2 rounded-full bg-surface-100 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${opt.debtPct * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-2xs text-surface-400">
              <span>Debt {(opt.debtPct * 100).toFixed(0)}%</span>
              <span>Equity {(opt.equityPct * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Risk Matrix Tab ──
function RiskTab({ result }: { result: DealEvaluationOutput }) {
  const rm = result.riskMatrix;
  const ratingColor = rm.riskRating === 'LOW' ? 'text-emerald-600 bg-emerald-50'
    : rm.riskRating === 'MODERATE' ? 'text-amber-600 bg-amber-50'
    : rm.riskRating === 'HIGH' ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`px-4 py-2 rounded-xl text-sm font-bold ${ratingColor}`}>{rm.riskRating} RISK</div>
        <div className="text-xs text-surface-500">
          Overall Score: {rm.overallRiskScore.toFixed(0)}/100 | Mitigation Impact: {(rm.mitigationImpact * 100).toFixed(0)}%
        </div>
      </div>

      {/* 5×5 Matrix Grid */}
      <div>
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Risk Matrix (Impact vs Likelihood)</h4>
        <div className="grid grid-cols-6 gap-0.5 text-2xs">
          <div /> {/* empty corner */}
          {[1,2,3,4,5].map(imp => <div key={imp} className="text-center py-1 font-medium text-surface-500">Impact {imp}</div>)}
          {[5,4,3,2,1].map(lik => (
            <>
              <div key={`l-${lik}`} className="text-right pr-2 py-2 font-medium text-surface-500">Likelihood {lik}</div>
              {[1,2,3,4,5].map(imp => {
                const score = lik * imp;
                const risksHere = rm.risks.filter(r => r.likelihood === lik && r.impact === imp);
                const bg = score >= 16 ? 'bg-red-100' : score >= 9 ? 'bg-amber-100' : score >= 4 ? 'bg-yellow-50' : 'bg-emerald-50';
                return (
                  <div key={`${lik}-${imp}`} className={`${bg} rounded p-1 min-h-[40px] border border-surface-100`}>
                    {risksHere.map((r, i) => (
                      <div key={i} className="text-2xs truncate" title={r.name}>{r.name}</div>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Top Risks Table */}
      <div>
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Top 5 Risks</h4>
        <div className="space-y-2">
          {rm.topRisks.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-surface-100 text-xs">
              <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-white ${
                r.score >= 16 ? 'bg-red-500' : r.score >= 9 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}>{r.score}</div>
              <div className="flex-1">
                <div className="font-medium text-surface-700">{r.name}</div>
                <div className="text-surface-400">{r.category} | L:{r.likelihood} × I:{r.impact} → Residual: {r.residualScore}</div>
              </div>
              <div className="text-surface-400 text-2xs max-w-40 truncate">{r.mitigationStrategy}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Operating Model Tab ──
function OperatingTab({ result }: { result: DealEvaluationOutput }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Operating Model Comparison (Brand vs Independent)</h4>
      <div className="grid grid-cols-3 gap-4">
        {result.operatingModelComparison.map((opt, i) => (
          <div key={i} className="p-4 rounded-xl border border-surface-200 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <h5 className="text-sm font-bold text-surface-800">{opt.label}</h5>
              <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
                opt.type === 'brand' ? 'bg-blue-50 text-blue-600' : opt.type === 'independent' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>{opt.type}</span>
            </div>
            <div className="space-y-2">
              <MetricRow label="EBITDA Margin" value={pct(opt.ebitdaMargin)} highlight={opt.ebitdaMargin >= 0.30} />
              <MetricRow label="Net Rev After Fees" value={pct(opt.netRevenuePctAfterFees)} />
              <MetricRow label="10Y NOI" value={crore(opt.tenYearNOI)} />
              <MetricRow label="IRR" value={pct(opt.irr)} />
              {opt.setupCostCr > 0 && <MetricRow label="Setup Cost" value={`₹${opt.setupCostCr.toFixed(1)} Cr`} />}
            </div>
            <p className="mt-3 text-2xs text-surface-500 italic">{opt.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── IC Scorecard Tab ──
function ScorecardTab({ result }: { result: DealEvaluationOutput }) {
  const sc = result.icScorecard;
  const vstyle = VERDICT_STYLE[sc.recommendation];

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full border-4 border-brand-500 flex items-center justify-center">
          <span className="text-2xl font-bold text-brand-700">{sc.overallScore.toFixed(1)}</span>
        </div>
        <div>
          <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${vstyle.bg} ${vstyle.text} ${vstyle.border} border`}>{sc.recommendation}</div>
          <p className="text-xs text-surface-500 mt-1">Investment Committee Scorecard</p>
        </div>
      </div>

      {/* Section Scores */}
      <div className="space-y-3">
        {sc.sections.map((s, i) => (
          <div key={i} className="p-3 rounded-xl border border-surface-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-surface-700">{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-surface-400">{(s.weight * 100).toFixed(0)}% weight</span>
                <span className={`font-bold text-sm ${s.score >= 7 ? 'text-emerald-600' : s.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>{s.score}/10</span>
              </div>
            </div>
            <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full ${s.score >= 7 ? 'bg-emerald-500' : s.score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.score * 10}%` }} />
            </div>
            <p className="text-xs text-surface-500">{s.summary}</p>
            {s.flags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.flags.map((f, fi) => (
                  <span key={fi} className="px-2 py-0.5 rounded-full text-2xs bg-red-50 text-red-600">{f}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Conditions & Next Steps */}
      {sc.conditions.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <h4 className="text-xs font-semibold text-amber-700 mb-2">Conditions for Approval</h4>
          {sc.conditions.map((c, i) => (
            <div key={i} className="text-xs text-amber-800 flex items-start gap-2 mb-1"><span className="text-amber-500">•</span> {c}</div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
        <h4 className="text-xs font-semibold text-surface-500 mb-2">Recommended Next Steps</h4>
        {sc.nextSteps.map((n, i) => (
          <div key={i} className="text-xs text-surface-600 flex items-start gap-2 mb-1"><span className="text-surface-400">{i + 1}.</span> {n}</div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REUSABLE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function KPITile({ label, value, subtext, status, tooltip }: {
  label: string; value: string; subtext?: string; status: 'green' | 'amber' | 'red' | 'neutral'; tooltip?: string;
}) {
  const border = status === 'green' ? 'border-emerald-200' : status === 'red' ? 'border-red-200' : status === 'amber' ? 'border-amber-200' : 'border-surface-200';
  const dot = status === 'green' ? 'bg-emerald-500' : status === 'red' ? 'bg-red-500' : status === 'amber' ? 'bg-amber-500' : 'bg-surface-300';
  return (
    <div className={`p-3 rounded-xl border ${border} bg-white`} title={tooltip}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-2xs text-surface-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-surface-900 font-mono">{value}</div>
      {subtext && <div className="text-2xs text-surface-400 mt-0.5">{subtext}</div>}
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-surface-500">{label}</span>
      <span className={`font-mono font-medium ${highlight === true ? 'text-emerald-600' : highlight === false ? 'text-red-600' : 'text-surface-800'}`}>{value}</span>
    </div>
  );
}

// ── Formatters ──
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function crore(v: number): string {
  const cr = v / 1e7;
  return cr >= 0 ? `₹${cr.toFixed(1)} Cr` : `(₹${Math.abs(cr).toFixed(1)} Cr)`;
}
