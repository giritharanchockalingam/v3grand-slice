// ─── Key Metrics Strip ──────────────────────────────────────────────
'use client';

import type { ProFormaOutput } from '@v3grand/core';

interface Props {
  proforma: ProFormaOutput | null;
}

function MetricCard({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 min-w-[140px]">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color ?? 'text-gray-900'}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

export function MetricsStrip({ proforma }: Props) {
  if (!proforma) {
    return (
      <div className="flex gap-3 overflow-x-auto">
        <MetricCard label="IRR" value="—" />
        <MetricCard label="NPV" value="—" />
        <MetricCard label="Equity Multiple" value="—" />
        <MetricCard label="Avg DSCR" value="—" />
        <MetricCard label="Payback" value="—" />
      </div>
    );
  }

  const irrPct = (proforma.irr * 100).toFixed(1);
  const npvCr = (proforma.npv / 1e7).toFixed(1);
  const irrColor = proforma.irr > 0.15 ? 'text-green-700' : proforma.irr > 0.10 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="flex gap-3 overflow-x-auto">
      <MetricCard label="IRR (Base)" value={irrPct} unit="%" color={irrColor} />
      <MetricCard label="NPV" value={npvCr} unit="Cr" color={proforma.npv > 0 ? 'text-green-700' : 'text-red-700'} />
      <MetricCard label="Equity Multiple" value={proforma.equityMultiple.toFixed(2)} unit="x" />
      <MetricCard label="Avg DSCR" value={proforma.avgDSCR.toFixed(2)} unit="x" color={proforma.avgDSCR > 1.3 ? 'text-green-700' : 'text-amber-700'} />
      <MetricCard label="Payback" value={String(proforma.paybackYear)} unit="yr" />
      <MetricCard label="Exit Value" value={(proforma.exitValue / 1e7).toFixed(1)} unit="Cr" />
    </div>
  );
}
