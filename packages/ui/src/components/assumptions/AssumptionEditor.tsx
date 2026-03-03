'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

// Field definitions with metadata for rendering
const MARKET_FIELDS = [
  { key: 'adrBase', label: 'Base ADR (Year 1)', unit: '₹', min: 1000, max: 10000, step: 100 },
  { key: 'adrStabilized', label: 'Stabilized ADR', unit: '₹', min: 1000, max: 15000, step: 100 },
  { key: 'adrGrowthRate', label: 'ADR Growth Rate', unit: '%', min: 0, max: 0.15, step: 0.005, pct: true },
] as const;

const FINANCIAL_FIELDS = [
  { key: 'debtRatio', label: 'Debt Ratio (LTV)', unit: '%', min: 0, max: 1, step: 0.05, pct: true },
  { key: 'debtInterestRate', label: 'Interest Rate', unit: '%', min: 0.04, max: 0.18, step: 0.005, pct: true },
  { key: 'debtTenorYears', label: 'Debt Tenor', unit: 'yr', min: 5, max: 25, step: 1 },
  { key: 'exitMultiple', label: 'Exit Multiple', unit: 'x', min: 5, max: 20, step: 0.5 },
  { key: 'wacc', label: 'WACC', unit: '%', min: 0.05, max: 0.25, step: 0.005, pct: true },
  { key: 'targetIRR', label: 'Target IRR', unit: '%', min: 0.08, max: 0.30, step: 0.005, pct: true },
  { key: 'managementFeePct', label: 'Management Fee', unit: '%', min: 0, max: 0.10, step: 0.005, pct: true },
  { key: 'incentiveFeePct', label: 'Incentive Fee', unit: '%', min: 0, max: 0.15, step: 0.01, pct: true },
  { key: 'ffAndEReservePct', label: 'FF&E Reserve', unit: '%', min: 0, max: 0.10, step: 0.005, pct: true },
  { key: 'taxRate', label: 'Tax Rate', unit: '%', min: 0, max: 0.40, step: 0.01, pct: true },
  { key: 'inflationRate', label: 'Inflation Rate', unit: '%', min: 0, max: 0.12, step: 0.005, pct: true },
] as const;

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  pct?: boolean;
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const displayValue = field.pct ? (value * 100).toFixed(1) : value;
  const displayUnit = field.pct ? '%' : field.unit;

  return (
    <div className="flex items-center gap-3 py-2">
      <label className="w-40 text-sm text-gray-700 flex-shrink-0">{field.label}</label>
      <input
        type="range"
        min={field.pct ? field.min * 100 : field.min}
        max={field.pct ? field.max * 100 : field.max}
        step={field.pct ? field.step * 100 : field.step}
        value={field.pct ? value * 100 : value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(field.pct ? raw / 100 : raw);
        }}
        className="flex-1 h-2 accent-blue-600"
      />
      <div className="w-24 text-right">
        <span className="text-sm font-medium text-gray-900">{displayValue}</span>
        <span className="text-xs text-gray-500 ml-0.5">{displayUnit}</span>
      </div>
    </div>
  );
}

export function AssumptionEditor({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const [deal, setDeal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load deal
  useEffect(() => {
    api.get<any>(`/deals/${dealId}`).then(setDeal);
  }, [dealId]);

  if (!deal) return <div className="text-sm text-gray-400 p-4">Loading assumptions...</div>;

  const market = deal.marketAssumptions ?? deal.market_assumptions;
  const financial = deal.financialAssumptions ?? deal.financial_assumptions;

  function updateMarket(key: string, value: number) {
    setDeal((d: any) => ({
      ...d,
      marketAssumptions: { ...market, [key]: value },
      market_assumptions: { ...market, [key]: value },
    }));
    setDirty(true);
  }

  function updateFinancial(key: string, value: number) {
    setDeal((d: any) => ({
      ...d,
      financialAssumptions: { ...financial, [key]: value },
      financial_assumptions: { ...financial, [key]: value },
    }));
    setDirty(true);
  }

  async function handleSaveAndRecompute() {
    setSaving(true);
    setResult(null);
    try {
      const res = await api.patch<any>(`/deals/${dealId}/assumptions`, {
        marketAssumptions: deal.marketAssumptions ?? deal.market_assumptions,
        financialAssumptions: deal.financialAssumptions ?? deal.financial_assumptions,
      });
      setResult(res);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Revenue Drivers */}
      <Section title="Revenue Drivers">
        {MARKET_FIELDS.map((f) => (
          <FieldRow
            key={f.key}
            field={f as FieldDef}
            value={market?.[f.key] ?? 0}
            onChange={(v) => updateMarket(f.key, v)}
          />
        ))}
      </Section>

      {/* Financial Assumptions */}
      <Section title="Financial & Debt Structure">
        {FINANCIAL_FIELDS.map((f) => (
          <FieldRow
            key={f.key}
            field={f as FieldDef}
            value={financial?.[f.key] ?? 0}
            onChange={(v) => updateFinancial(f.key, v)}
          />
        ))}
      </Section>

      {/* Save + Recompute */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSaveAndRecompute}
          disabled={saving || !dirty}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:bg-gray-300 rounded-lg transition-colors"
        >
          {saving ? 'Saving & Recomputing...' : 'Save & Recompute'}
        </button>
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
      </div>

      {/* Result feedback */}
      {result && !result.error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Recompute complete. Verdict: <strong>{result.recommendation?.verdict}</strong>.
          IRR: {((result.proforma?.irr ?? 0) * 100).toFixed(1)}%.
          NPV: {((result.proforma?.npv ?? 0) / 1e7).toFixed(1)} Cr.
          <span className="block mt-1 text-xs text-green-600">Switch to Dashboard tab to see full results.</span>
        </div>
      )}
      {result?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error: {result.error}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
