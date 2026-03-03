// ─── Key Metrics Strip ──────────────────────────────────────────────
'use client';

import type { ProFormaOutput } from '@v3grand/core';

interface Props {
  proforma: ProFormaOutput | null;
}

function MetricCard({ label, value, unit, color, tooltip }: {
  label: string; value: string; unit?: string; color?: string; tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 min-w-[140px] group relative">
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="cursor-help text-gray-300 hover:text-gray-500" title={tooltip}>ⓘ</span>
        )}
      </p>
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
        <MetricCard label="IRR" value="—" tooltip="Internal Rate of Return — annualised yield on equity" />
        <MetricCard label="NPV" value="—" tooltip="Net Present Value of free cash flows at WACC" />
        <MetricCard label="Equity Multiple" value="—" tooltip="Total equity returned ÷ equity invested" />
        <MetricCard label="Avg DSCR" value="—" tooltip="Debt Service Coverage Ratio — cash flow ÷ debt payments" />
        <MetricCard label="Payback" value="—" tooltip="Years until cumulative FCFE turns positive" />
      </div>
    );
  }

  const irrPct = (proforma.irr * 100).toFixed(1);
  const npvCr = (proforma.npv / 1e7).toFixed(1);
  const irrColor = proforma.irr > 0.15 ? 'text-green-700' : proforma.irr > 0.10 ? 'text-yellow-700' : 'text-red-700';

  return (
    <div className="flex gap-3 overflow-x-auto">
      <MetricCard label="IRR (Base)" value={irrPct} unit="%" color={irrColor} tooltip="Internal Rate of Return — annualised yield on equity" />
      <MetricCard label="NPV" value={npvCr} unit="Cr" color={proforma.npv > 0 ? 'text-green-700' : 'text-red-700'} tooltip="Net Present Value of free cash flows at WACC" />
      <MetricCard label="Equity Multiple" value={proforma.equityMultiple.toFixed(2)} unit="x" tooltip="Total equity returned ÷ equity invested" />
      <MetricCard label="Avg DSCR" value={proforma.avgDSCR.toFixed(2)} unit="x" color={proforma.avgDSCR > 1.3 ? 'text-green-700' : 'text-amber-700'} tooltip="Debt Service Coverage Ratio — cash flow ÷ debt payments" />
      <MetricCard label="Payback" value={String(proforma.paybackYear)} unit="yr" tooltip="Years until cumulative FCFE turns positive" />
      <MetricCard label="Exit Value" value={(proforma.exitValue / 1e7).toFixed(1)} unit="Cr" tooltip="Estimated terminal value at exit cap rate" />
    </div>
  );
}
