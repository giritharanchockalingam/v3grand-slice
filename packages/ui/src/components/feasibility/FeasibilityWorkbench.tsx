'use client';

import React, { useState } from 'react';
import {
  useDealAssumptions,
  useUpsertAssumption,
  useApproveAssumption,
  useGenerateICMemo,
  useSetActiveScenario,
  useRunMonteCarlo,
  useRecompute,
  useBoardCriteria,
  useCapitalStructureScenarios,
  useScenarios,
  usePhase2Gate,
  type AssumptionRow,
} from '../../hooks/use-feasibility';
import { useDashboard } from '../../hooks/use-dashboard';

const SCENARIOS = [
  { key: 'base', label: 'Base' },
  { key: 'bear', label: 'Downside' },
  { key: 'bull', label: 'Upside' },
] as const;

const WORKFLOW_STEPS = [
  { id: 1, label: 'Scenario', short: 'Scenario' },
  { id: 2, label: 'Assumptions', short: 'Assumptions' },
  { id: 3, label: 'Sensitivity', short: 'Sensitivity' },
  { id: 4, label: 'IC Memo', short: 'IC Memo' },
] as const;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    locked: 'bg-surface-200 text-surface-700',
    approved: 'bg-green-100 text-green-800',
    reviewed: 'bg-amber-100 text-amber-800',
    draft: 'bg-surface-100 text-surface-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function IcMemoView({ memo }: { memo: Record<string, unknown> }) {
  const [auditOpen, setAuditOpen] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(memo, null, 2));
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(memo, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ic-memo-${(memo.dealId ?? 'deal')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const outputs = memo.outputs as Record<string, unknown> | null | undefined;
  const recommendation = memo.recommendation as Record<string, unknown> | null | undefined;
  const boardCriteria = (memo.boardCriteria as Array<{ name: string; threshold: number; actual: number; passed: boolean }>) ?? [];
  const assumptions = (memo.assumptions as Array<{ key: string; value: unknown; status?: string; source?: string }>) ?? [];
  const auditTrail = memo.auditTrail as Array<Record<string, unknown>> | undefined;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 text-xs font-medium">
          Copy JSON
        </button>
        <button type="button" onClick={download} className="px-3 py-1.5 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-800 text-xs font-medium">
          Download JSON
        </button>
      </div>
      <div className="rounded-xl border border-surface-200 overflow-hidden">
        <div className="bg-surface-50 px-4 py-3 border-b border-surface-200">
          <h4 className="font-semibold text-surface-900">{String(memo.title ?? 'IC Memo')}</h4>
          <p className="text-2xs text-surface-500 mt-0.5">Generated {memo.generatedAt ? new Date(String(memo.generatedAt)).toLocaleString() : ''} by {String(memo.generatedBy ?? '—')}</p>
        </div>
        <div className="p-4 space-y-4">
          {memo.thesis && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Thesis</h5>
              <p className="text-surface-800">{String(memo.thesis)}</p>
            </div>
          )}
          {memo.market && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Market</h5>
              <pre className="text-2xs text-surface-700 bg-surface-50 p-3 rounded-lg overflow-auto">{JSON.stringify(memo.market, null, 2)}</pre>
            </div>
          )}
          {outputs && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Outputs</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {outputs.irr != null && <div className="metric-card"><p className="stat-label">IRR</p><p className="stat-value text-brand-700">{(Number(outputs.irr) * 100).toFixed(1)}%</p></div>}
                {outputs.npv != null && <div className="metric-card"><p className="stat-label">NPV</p><p className="stat-value text-brand-700">{(Number(outputs.npv) / 1e7).toFixed(1)} Cr</p></div>}
                {outputs.equityMultiple != null && <div className="metric-card"><p className="stat-label">Equity Multiple</p><p className="stat-value text-brand-700">{Number(outputs.equityMultiple).toFixed(2)}x</p></div>}
                {outputs.paybackYear != null && <div className="metric-card"><p className="stat-label">Payback</p><p className="stat-value text-brand-700">{outputs.paybackYear} yr</p></div>}
                {outputs.dscr != null && <div className="metric-card"><p className="stat-label">DSCR</p><p className="stat-value text-brand-700">{Number(outputs.dscr).toFixed(2)}</p></div>}
              </div>
            </div>
          )}
          {recommendation && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Recommendation</h5>
              <p className="text-surface-800"><strong>{String(recommendation.verdict ?? '—')}</strong> {recommendation.confidence != null && `(${(Number(recommendation.confidence) * 100).toFixed(0)}% confidence)`}</p>
              {recommendation.explanation && <p className="text-surface-600 mt-1 text-2xs">{String(recommendation.explanation)}</p>}
            </div>
          )}
          {boardCriteria.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Board criteria (hurdles)</h5>
              <ul className="space-y-1">
                {boardCriteria.map((c, i) => (
                  <li key={i} className="flex justify-between items-center text-2xs">
                    <span className="text-surface-700">{c.name}</span>
                    <span className={c.passed ? 'text-green-600' : 'text-amber-600'}>
                      {typeof c.actual === 'number' && c.threshold !== 0 ? `${(c.actual >= 1 ? (c.actual * 100).toFixed(1) : c.actual)}${(c.threshold < 1 && c.threshold > 0) ? '%' : ''} vs ${(c.threshold >= 1 ? c.threshold : (c.threshold * 100).toFixed(1) + '%')}` : (c.passed ? 'Pass' : 'Fail')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assumptions.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Governance assumptions</h5>
              <ul className="space-y-1">
                {assumptions.map((a, i) => (
                  <li key={i} className="flex justify-between text-2xs">
                    <span className="text-surface-700">{a.key}</span>
                    <span className="text-surface-500">{typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)} {a.status && `(${a.status})`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {auditTrail && auditTrail.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setAuditOpen((o) => !o)}
                className="text-xs font-semibold text-surface-500 uppercase tracking-wide hover:text-surface-700"
              >
                {auditOpen ? '▼' : '▶'} Audit trail ({auditTrail.length} entries)
              </button>
              {auditOpen && (
                <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-surface-200 p-2 space-y-1">
                  {auditTrail.slice(0, 20).map((e: Record<string, unknown>, i: number) => (
                    <div key={i} className="text-2xs text-surface-600 flex justify-between gap-2">
                      <span>{String(e.action ?? e.type ?? '—')}</span>
                      <span className="text-surface-400">{e.timestamp ? new Date(String(e.timestamp)).toLocaleString() : ''}</span>
                    </div>
                  ))}
                  {auditTrail.length > 20 && <p className="text-2xs text-surface-400">… and {auditTrail.length - 20} more</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeasibilityWorkbench({ dealId }: { dealId: string }) {
  const { data: dashboard } = useDashboard(dealId);
  const { data: assumptionsData, isLoading: assumptionsLoading } = useDealAssumptions(dealId);
  const { data: boardCriteriaData } = useBoardCriteria(dealId);
  const { data: capitalStructureData } = useCapitalStructureScenarios(dealId);
  const { data: scenariosData } = useScenarios(dealId);
  const { data: phase2GateData } = usePhase2Gate(dealId);
  const upsertMut = useUpsertAssumption(dealId);
  const approveMut = useApproveAssumption(dealId);
  const icMemoMut = useGenerateICMemo(dealId);
  const setScenarioMut = useSetActiveScenario(dealId);
  const runMCMut = useRunMonteCarlo(dealId);
  const recomputeMut = useRecompute(dealId);
  const [icResult, setIcResult] = useState<Record<string, unknown> | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ value: string; unit: string; rationale: string; source: string; confidence: string }>({ value: '', unit: '', rationale: '', source: '', confidence: '' });

  // Add-assumption form state
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newConfidence, setNewConfidence] = useState('');
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);

  const activeScenario = (dashboard as any)?.activeScenario ?? 'base';
  const assumptions = assumptionsData?.assumptions ?? [];

  const handleGenerateICMemo = async () => {
    try {
      const res = await icMemoMut.mutateAsync({ scenarioKey: activeScenario, includeAuditTrail });
      setIcResult((res.memo as Record<string, unknown>) ?? null);
    } catch {
      // Error shown by mutation
    }
  };

  const handleAddAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    const value = newValue.trim() === '' ? 0 : Number(newValue);
    try {
      await upsertMut.mutateAsync({
        key: newKey.trim(),
        value: Number.isNaN(value) ? newValue : value,
        unit: newUnit.trim() || undefined,
        rationale: newRationale.trim() || undefined,
        source: newSource.trim() || undefined,
        confidence: newConfidence === '' ? undefined : Number(newConfidence),
      });
      setNewKey('');
      setNewValue('');
      setNewUnit('');
      setNewRationale('');
      setNewSource('');
      setNewConfidence('');
    } catch {
      // Error shown by mutation
    }
  };

  const openEdit = (a: AssumptionRow) => {
    setEditingKey(a.assumptionKey);
    setEditForm({
      value: typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value ?? ''),
      unit: a.unit ?? '',
      rationale: a.rationale ?? '',
      source: a.source ?? '',
      confidence: a.confidence ?? '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;
    const numVal = Number(editForm.value);
    try {
      await upsertMut.mutateAsync({
        key: editingKey,
        value: Number.isNaN(numVal) ? editForm.value : numVal,
        unit: editForm.unit || undefined,
        rationale: editForm.rationale || undefined,
        source: editForm.source || undefined,
        confidence: editForm.confidence === '' ? undefined : Number(editForm.confidence),
      });
      setEditingKey(null);
    } catch {
      // Error shown by mutation
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Workflow steps */}
      <div className="elevated-card p-4">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Feasibility workflow</p>
        <div className="flex flex-wrap gap-2 sm:gap-4">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">{step.id}</span>
              <span className="text-sm font-medium text-surface-700">{step.label}</span>
              {step.id < 4 && <span className="text-surface-300 hidden sm:inline">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 1. Scenario */}
      <div className="elevated-card p-6" id="feasibility-scenario">
        <h3 className="section-title mb-4">1. Scenario</h3>
        <p className="text-sm text-surface-500 mb-4">Choose the scenario used for metrics and the IC memo.</p>
        <div className="flex gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => setScenarioMut.mutate(s.key)}
              disabled={setScenarioMut.isPending || activeScenario === s.key}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all focus:ring-2 focus:ring-brand-400 ${
                activeScenario === s.key ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-surface-700 border-surface-200 hover:border-brand-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-2xs text-surface-400 mt-2">Active: <strong>{SCENARIOS.find((s) => s.key === activeScenario)?.label ?? activeScenario}</strong></p>
      </div>

      {/* Board criteria (Excel: Executive Summary hurdles) */}
      {boardCriteriaData?.boardCriteria && boardCriteriaData.boardCriteria.length > 0 && (
        <div className="elevated-card p-6">
          <h3 className="section-title mb-4">Board criteria</h3>
          <p className="text-sm text-surface-500 mb-3">Pass/fail vs agreed hurdles (from latest base recommendation).</p>
          <ul className="space-y-2">
            {boardCriteriaData.boardCriteria.map((c, i) => (
              <li key={i} className="flex justify-between items-center text-sm">
                <span className="text-surface-700">{c.name}</span>
                <span className={c.passed ? 'text-green-600 font-medium' : 'text-amber-600'}>
                  {c.passed ? 'Pass' : 'Fail'} {typeof c.actual === 'number' && <span className="text-surface-500">({typeof c.threshold === 'number' && c.threshold <= 1 ? (c.actual * 100).toFixed(1) + '%' : c.actual} vs {c.threshold <= 1 && c.threshold > 0 ? (c.threshold * 100).toFixed(0) + '%' : c.threshold})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* WACC & Hurdle (Excel: Key Assumptions / WACC tab) */}
      {dashboard && (dashboard as any).financialAssumptions && (
        <div className="elevated-card p-6">
          <h3 className="section-title mb-4">WACC & hurdle</h3>
          <p className="text-sm text-surface-500 mb-3">Discount and hurdle rates used for NPV and investment gates.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(dashboard as any).financialAssumptions.wacc != null && (
              <div className="metric-card">
                <p className="stat-label">WACC</p>
                <p className="stat-value text-brand-700">{((dashboard as any).financialAssumptions.wacc * 100).toFixed(2)}%</p>
              </div>
            )}
            {(dashboard as any).financialAssumptions.targetIRR != null && (
              <div className="metric-card">
                <p className="stat-label">Target IRR (hurdle)</p>
                <p className="stat-value text-brand-700">{((dashboard as any).financialAssumptions.targetIRR * 100).toFixed(1)}%</p>
              </div>
            )}
            {(dashboard as any).financialAssumptions.targetDSCR != null && (
              <div className="metric-card">
                <p className="stat-label">Target DSCR</p>
                <p className="stat-value text-brand-700">{(dashboard as any).financialAssumptions.targetDSCR}</p>
              </div>
            )}
          </div>
          <p className="text-2xs text-surface-400 mt-2">All NPV and IRR checks use the above hurdle; capital structure scenarios use target IRR/DSCR.</p>
        </div>
      )}

      {/* Probability-weighted expected return (Excel: Scenario Stress Test) */}
      {scenariosData && (scenariosData.expectedIRR != null || scenariosData.expectedNPV != null) && (
        <div className="elevated-card p-6">
          <h3 className="section-title mb-4">Expected return (probability-weighted)</h3>
          <p className="text-sm text-surface-500 mb-3">Weights: Bear {((scenariosData.probabilityWeights?.bear ?? 0) * 100).toFixed(0)}% / Base {((scenariosData.probabilityWeights?.base ?? 0) * 100).toFixed(0)}% / Bull {((scenariosData.probabilityWeights?.bull ?? 0) * 100).toFixed(0)}%.</p>
          <div className="grid grid-cols-2 gap-4">
            {scenariosData.expectedIRR != null && (
              <div className="metric-card">
                <p className="stat-label">Expected IRR</p>
                <p className="stat-value text-brand-700">{((scenariosData.expectedIRR ?? 0) * 100).toFixed(1)}%</p>
              </div>
            )}
            {scenariosData.expectedNPV != null && (
              <div className="metric-card">
                <p className="stat-label">Expected NPV</p>
                <p className="stat-value text-brand-700">{((scenariosData.expectedNPV ?? 0) / 1e7).toFixed(1)} Cr</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Capital structure scenarios (Excel: Capital Structure / Investment Memo) */}
      {capitalStructureData?.scenarios && capitalStructureData.scenarios.length > 0 && (
        <div className="elevated-card p-6">
          <h3 className="section-title mb-4">Capital structure scenarios</h3>
          <p className="text-sm text-surface-500 mb-3">Base-case pro forma at 40%, 30%, 20% debt for IC comparison.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 font-semibold text-surface-700">Debt / Equity</th>
                  <th className="text-right py-2 font-semibold text-surface-700">IRR</th>
                  <th className="text-right py-2 font-semibold text-surface-700">NPV (Cr)</th>
                  <th className="text-right py-2 font-semibold text-surface-700">DSCR</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Risk</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {capitalStructureData.scenarios.map((s, i) => (
                  <tr key={i} className="border-b border-surface-100">
                    <td className="py-2 font-medium text-surface-800">{s.debtPct ?? 0}% / {s.equityPct ?? 0}%</td>
                    <td className="py-2 text-right text-surface-700">{((s.irr ?? 0) * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-surface-700">{((s.npv ?? 0) / 1e7).toFixed(1)}</td>
                    <td className="py-2 text-right text-surface-700">{(s.avgDSCR ?? 0).toFixed(2)}</td>
                    <td className="py-2 text-surface-600">{s.riskLevel ?? '—'}</td>
                    <td className="py-2 text-surface-600">{s.recommendation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phase 2 gate (Excel: Phase 2 Gate tab) */}
      {phase2GateData?.phase2Gate && (
        <div className="elevated-card p-6">
          <h3 className="section-title mb-4">Phase 2 gate</h3>
          <p className="text-sm text-surface-500 mb-3">8-point expansion gate (e.g. Month 36). Verdict: <strong>{phase2GateData.phase2Gate.verdict}</strong> ({phase2GateData.phase2Gate.passedCount}/{phase2GateData.phase2Gate.totalCount} passed).</p>
          <ul className="space-y-2">
            {phase2GateData.phase2Gate.criteria.map((c, i) => (
              <li key={i} className="flex justify-between items-start text-sm">
                <span className="text-surface-700">{c.name}</span>
                <span className={c.passed ? 'text-green-600' : 'text-surface-400'}>
                  {c.current != null ? (c.threshold < 1 ? ((c.current ?? 0) * 100).toFixed(1) + '%' : c.current) : 'TBD'} {!c.passed && c.current != null && '(below threshold)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Assumptions */}
      <div className="elevated-card p-6" id="feasibility-assumptions">
        <h3 className="section-title mb-4">2. Assumption governance (FEATURE E)</h3>
        <p className="text-sm text-surface-500 mb-4">Draft → Reviewed → Approved → Locked for IC. Add assumptions below, then move them through the workflow.</p>

        <form onSubmit={handleAddAssumption} className="p-4 rounded-xl bg-surface-50 border border-surface-200 mb-6">
          <p className="text-xs font-semibold text-surface-600 mb-3">Add assumption</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Key *</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. occupancy_year_1"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Value</label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0.72 or text"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Unit</label>
              <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="%" className="input w-full" />
            </div>
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Confidence (0–1)</label>
              <input type="text" value={newConfidence} onChange={(e) => setNewConfidence(e.target.value)} placeholder="0.9" className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Rationale</label>
              <input type="text" value={newRationale} onChange={(e) => setNewRationale(e.target.value)} placeholder="Brief rationale" className="input w-full" />
            </div>
            <div>
              <label className="block text-2xs font-medium text-surface-600 mb-1">Source</label>
              <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. Market report" className="input w-full" />
            </div>
          </div>
          <div className="mt-3">
            <button type="submit" disabled={upsertMut.isPending || !newKey.trim()} className="btn-primary text-sm">
              {upsertMut.isPending ? 'Adding…' : 'Add assumption'}
            </button>
          </div>
        </form>

        {assumptionsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-12 rounded-lg" />
            ))}
          </div>
        ) : assumptions.length === 0 ? (
          <p className="text-sm text-surface-400 italic">No governance assumptions yet. Add one using the form above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 font-semibold text-surface-700">Key</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Value</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Unit</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Owner</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Status</th>
                  <th className="text-left py-2 font-semibold text-surface-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr className="border-b border-surface-100">
                      <td className="py-2 font-medium text-surface-800">{a.assumptionKey}</td>
                      <td className="py-2 text-surface-600">{typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)}</td>
                      <td className="py-2 text-surface-600">{a.unit ?? '—'}</td>
                      <td className="py-2 text-surface-600">{a.owner}</td>
                      <td className="py-2"><StatusBadge status={a.status} /></td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {a.status !== 'locked' && (
                            <>
                              {(a.status === 'draft' || a.status === 'reviewed') && (
                                <button type="button" onClick={() => openEdit(a)} className="text-xs font-medium text-surface-600 hover:text-brand-600">Edit</button>
                              )}
                              {a.status === 'draft' && (
                                <button type="button" onClick={() => approveMut.mutate({ key: a.assumptionKey, status: 'reviewed' })} disabled={approveMut.isPending} className="text-xs font-medium text-amber-600 hover:text-amber-700">Submit for review</button>
                              )}
                              {a.status === 'reviewed' && (
                                <button type="button" onClick={() => approveMut.mutate({ key: a.assumptionKey, status: 'approved' })} disabled={approveMut.isPending} className="text-xs font-medium text-green-600 hover:text-green-700">Approve</button>
                              )}
                              {a.status === 'approved' && (
                                <button type="button" onClick={() => approveMut.mutate({ key: a.assumptionKey, status: 'locked' })} disabled={approveMut.isPending} className="text-xs font-medium text-surface-600 hover:text-surface-700">Lock for IC</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingKey === a.assumptionKey && (
                      <tr className="bg-surface-50">
                        <td colSpan={6} className="p-4">
                          <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-2xs font-medium text-surface-600 mb-1">Value</label>
                              <input type="text" value={editForm.value} onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))} className="input w-full" />
                            </div>
                            <div>
                              <label className="block text-2xs font-medium text-surface-600 mb-1">Unit</label>
                              <input type="text" value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} className="input w-full" />
                            </div>
                            <div>
                              <label className="block text-2xs font-medium text-surface-600 mb-1">Rationale</label>
                              <input type="text" value={editForm.rationale} onChange={(e) => setEditForm((f) => ({ ...f, rationale: e.target.value }))} className="input w-full" />
                            </div>
                            <div>
                              <label className="block text-2xs font-medium text-surface-600 mb-1">Confidence</label>
                              <input type="text" value={editForm.confidence} onChange={(e) => setEditForm((f) => ({ ...f, confidence: e.target.value }))} className="input w-full" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-2xs font-medium text-surface-600 mb-1">Source</label>
                              <input type="text" value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} className="input w-full" />
                            </div>
                            <div className="flex gap-2 items-end">
                              <button type="submit" disabled={upsertMut.isPending} className="btn-primary text-sm">Save</button>
                              <button type="button" onClick={() => setEditingKey(null)} className="px-3 py-1.5 rounded-lg border border-surface-300 text-surface-600 text-sm hover:bg-surface-100">Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Sensitivity */}
      <div className="elevated-card p-6" id="feasibility-sensitivity">
        <h3 className="section-title mb-4">3. Sensitivity & Monte Carlo</h3>
        <p className="text-sm text-surface-500 mb-4">Run the full engine cascade (including Monte Carlo) to refresh metrics and populate sensitivity. Then generate the IC memo with up-to-date outputs.</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => recomputeMut.mutate()}
            disabled={recomputeMut.isPending}
            className="btn-primary"
          >
            {recomputeMut.isPending ? 'Running…' : 'Recompute all (Underwriter + MC)'}
          </button>
          <button
            type="button"
            onClick={() => runMCMut.mutate()}
            disabled={runMCMut.isPending}
            className="px-4 py-2 rounded-xl border border-surface-200 bg-white text-surface-700 text-sm font-medium hover:bg-surface-50"
          >
            {runMCMut.isPending ? 'Running…' : 'Run Monte Carlo only'}
          </button>
        </div>
        <div className="mt-4 h-24 rounded-lg bg-surface-50 border border-surface-200 flex items-center justify-center text-surface-400 text-sm">
          Tornado chart — run sensitivity analysis to populate
        </div>
      </div>

      {/* 4. IC Memo */}
      <div className="elevated-card p-6" id="feasibility-icmemo">
        <h3 className="section-title mb-4">4. Investment Committee memo</h3>
        <p className="text-sm text-surface-500 mb-4">Generate the IC memo for the active scenario. It includes outputs, governance assumptions, and optional audit trail.</p>
        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={includeAuditTrail} onChange={(e) => setIncludeAuditTrail(e.target.checked)} className="rounded border-surface-300" />
          <span className="text-sm text-surface-600">Include audit trail</span>
        </label>
        <button
          onClick={handleGenerateICMemo}
          disabled={icMemoMut.isPending}
          className="btn-primary inline-flex items-center gap-2"
        >
          {icMemoMut.isPending ? 'Generating…' : 'Generate IC memo'}
        </button>
        {icMemoMut.isError && (
          <p className="mt-2 text-sm text-red-600">{(icMemoMut.error as Error).message}</p>
        )}
        {icResult && (
          <div className="mt-6">
            <IcMemoView memo={icResult} />
          </div>
        )}
      </div>
    </div>
  );
}
