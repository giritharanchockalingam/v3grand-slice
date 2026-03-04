// ─── Key Metrics Strip ──────────────────────────────────────────────
'use client';

interface ProformaData {
  irr: number;
  npv: number;
  equityMultiple: number;
  paybackYear: number;
  avgDSCR?: number;
  exitValue?: number;
}

interface Props {
  proforma: ProformaData | null;
}

function MetricCard({ label, value, unit, color, tooltip }: {
  label: string; value: string; unit?: string; color?: string; tooltip?: string;
}) {
  return (
    <div className="metric-card min-w-[140px] group relative">
      <p className="stat-label flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="cursor-help text-surface-300 hover:text-surface-500 transition-colors" title={tooltip}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        )}
      </p>
      <p className={`text-xl font-bold mt-1 ${color ?? 'text-surface-900'}`}>
        {value}
        {unit && <span className="text-sm font-normal text-surface-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

export function MetricsStrip({ proforma }: Props) {
  if (!proforma) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
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
  const irrColor = proforma.irr > 0.15 ? 'text-emerald-600' : proforma.irr > 0.10 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <MetricCard label="IRR (Base)" value={irrPct} unit="%" color={irrColor} tooltip="Internal Rate of Return — annualised yield on equity" />
      <MetricCard label="NPV" value={npvCr} unit="Cr" color={proforma.npv > 0 ? 'text-emerald-600' : 'text-red-600'} tooltip="Net Present Value of free cash flows at WACC" />
      <MetricCard label="Equity Multiple" value={proforma.equityMultiple.toFixed(2)} unit="x" tooltip="Total equity returned ÷ equity invested" />
      <MetricCard label="Avg DSCR" value={proforma.avgDSCR != null ? proforma.avgDSCR.toFixed(2) : '—'} unit="x" color={proforma.avgDSCR != null && proforma.avgDSCR > 1.3 ? 'text-emerald-600' : 'text-amber-600'} tooltip="Debt Service Coverage Ratio — cash flow ÷ debt payments" />
      <MetricCard label="Payback" value={String(proforma.paybackYear)} unit="yr" tooltip="Years until cumulative FCFE turns positive" />
      {proforma.exitValue != null && <MetricCard label="Exit Value" value={(proforma.exitValue / 1e7).toFixed(1)} unit="Cr" tooltip="Estimated terminal value at exit cap rate" />}
    </div>
  );
}
