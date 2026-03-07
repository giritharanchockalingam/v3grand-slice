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
    api.get<any>(`/deals/${dealId}`).then((d) => setDeal(normalizeDealFromServer(d)));
  }, [dealId]);

  // Listen for CFO demo assumption changes (dispatched from PartnerWalkthrough)
  useEffect(() => {
    function handleDemoChange(e: Event) {
      const { field, value } = (e as CustomEvent).detail;
      const marketFields = ['adrBase', 'adrStabilized', 'adrGrowthRate'];
      if (marketFields.includes(field)) {
        setDeal((d: any) => {
          if (!d) return d;
          const market = d.marketAssumptions ?? d.market_assumptions ?? {};
          return {
            ...d,
            marketAssumptions: { ...market, [field]: value },
            market_assumptions: { ...market, [field]: value },
          };
        });
      } else {
        setDeal((d: any) => {
          if (!d) return d;
          const financial = d.financialAssumptions ?? d.financial_assumptions ?? {};
          return {
            ...d,
            financialAssumptions: { ...financial, [field]: value },
            financial_assumptions: { ...financial, [field]: value },
          };
        });
      }
      setDirty(true);
    }
    window.addEventListener('cfo-demo-change', handleDemoChange);
    return () => window.removeEventListener('cfo-demo-change', handleDemoChange);
  }, []);

  function normalizeDealFromServer(d: any) {
    if (!d) return d;
    const market = d.marketAssumptions ?? d.market_assumptions ?? {};
    const financial = d.financialAssumptions ?? d.financial_assumptions ?? {};
    return {
      ...d,
      marketAssumptions: market,
      market_assumptions: market,
      financialAssumptions: financial,
      financial_assumptions: financial,
    };
  }

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
      // Sync local state from server so sliders stay correct after save/recompute
      const serverDeal = res?.deal;
      if (serverDeal) {
        setDeal(normalizeDealFromServer(serverDeal));
      } else {
        const refreshed = await api.get<any>(`/deals/${dealId}`);
        setDeal(normalizeDealFromServer(refreshed));
      }
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId] });
    } catch (e: any) {
      setResult({ error: e.message });
      // Don't clear dirty so user can retry without re-entering
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

      {/* Default Values & Impact Guide */}
      <DefaultValuesGuide />

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
          {result.deal ? (
            <>
              Your assumptions were saved; recompute failed. Values below are as saved.
              <span className="block mt-1 font-medium">Error: {result.error}</span>
            </>
          ) : (
            <>Error: {result.error}</>
          )}
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

/* ─── Default Values & Impact Guide ─── */
function DefaultValuesGuide() {
  const [expanded, setExpanded] = useState(false);

  const DEFAULTS = [
    {
      category: 'Revenue Drivers',
      icon: '📈',
      items: [
        { name: 'Base ADR (Year 1)', default: '₹5,500 × star multiplier × type multiplier', impact: 'HIGH', desc: 'Starting Average Daily Rate. Directly drives top-line revenue. 5-Star gets 1.4× multiplier, Luxury Resort gets 1.3×. A ₹1,000 increase in ADR can improve IRR by 2-4%.' },
        { name: 'Stabilized ADR', default: '₹7,000 × star × type multiplier', impact: 'HIGH', desc: 'Target ADR after ramp-up (typically Year 4-5). Determines long-term revenue trajectory and exit valuation.' },
        { name: 'ADR Growth Rate', default: '5.0%', impact: 'MEDIUM', desc: 'Annual ADR escalation after Year 1. Compounding effect: 5% over 10 years = 63% total increase. India market average is 4-7%.' },
        { name: 'Occupancy Ramp (New Build)', default: '30% → 45% → 55% → 62% → 68% → 72%', impact: 'HIGH', desc: 'Year 1-6 occupancy targets. Year 1 at 30% is conservative. Stabilizes at 72% by Year 5-6. Every 5% occupancy improvement adds ~1-2% IRR.' },
      ],
    },
    {
      category: 'Debt & Capital Structure',
      icon: '🏦',
      items: [
        { name: 'Debt Ratio (LTV)', default: '60% (partnership) / 50% (solo)', impact: 'HIGH', desc: 'Leverage ratio. Higher debt = higher equity IRR if project performs, but higher risk. 60% is standard for Indian hotel projects. Above 70% is aggressive.' },
        { name: 'Interest Rate', default: '9.5%', impact: 'HIGH', desc: 'Annual cost of debt. At 60% LTV, each 0.5% increase adds ~₹1.5 Cr/year in interest expense on a ₹350 Cr project. Current Indian market range: 9-11%.' },
        { name: 'Debt Tenor', default: '15 years', impact: 'MEDIUM', desc: 'Loan repayment period. Longer tenor = lower EMI, better DSCR. 12-20 year range typical for hotel projects.' },
        { name: 'WACC', default: '11.0%', impact: 'HIGH', desc: 'Weighted Average Cost of Capital — the discount rate for NPV. IRR must exceed WACC+200bps to pass investment gates. Lower WACC = higher NPV.' },
      ],
    },
    {
      category: 'Return & Exit',
      icon: '🎯',
      items: [
        { name: 'Target IRR', default: '14% (Conservative) / 18% (Moderate) / 22% (Aggressive)', impact: 'CRITICAL', desc: 'The hurdle rate for the investment committee. All gate checks compare actual IRR to this target. Setting too high may cause rejection of viable deals.' },
        { name: 'Exit Multiple', default: '8×', impact: 'HIGH', desc: 'Terminal value = Year 10 NOI × Exit Multiple. Luxury hotels trade at 8-12×, business hotels at 6-8×. A 1× increase can add 3-5% to IRR.' },
        { name: 'Tax Rate', default: '25.0%', impact: 'MEDIUM', desc: 'Indian corporate tax rate. New manufacturing entities get 15%. Standard rate is 25.17%. Affects after-tax cash flows and NPV significantly.' },
        { name: 'Inflation Rate', default: '5.0%', impact: 'LOW-MEDIUM', desc: 'Used for cost escalation modeling. Affects operating expenses, construction costs, and replacement reserves. RBI targets 4±2%.' },
      ],
    },
    {
      category: 'Operating Fees & Reserves',
      icon: '⚙️',
      items: [
        { name: 'Management Fee', default: '3.0%', impact: 'MEDIUM', desc: 'Base fee paid to hotel operator (% of revenue). Franchise: ~3%, Management Contract: 3-5%. Directly reduces EBITDA margin.' },
        { name: 'Incentive Fee', default: '10.0%', impact: 'MEDIUM', desc: 'Performance fee (% of profit above threshold). Typical range: 8-12%. Only applies under management contracts and franchise agreements.' },
        { name: 'FF&E Reserve', default: '4.0%', impact: 'LOW', desc: 'Furniture, Fixtures & Equipment replacement reserve (% of revenue). Industry standard is 4%. Lenders typically require minimum 3%.' },
      ],
    },
  ];

  const SCENARIO_GUIDE = [
    {
      scenario: 'Conservative (Low Risk)',
      probabilities: 'Bear 35% / Base 45% / Bull 20%',
      bearOcc: '55%',
      baseOcc: '68%',
      bullOcc: '78%',
      targetIRR: '14%',
    },
    {
      scenario: 'Moderate (Medium Risk)',
      probabilities: 'Bear 25% / Base 50% / Bull 25%',
      bearOcc: '58%',
      baseOcc: '72%',
      bullOcc: '82%',
      targetIRR: '18%',
    },
    {
      scenario: 'Aggressive (High Risk)',
      probabilities: 'Bear 20% / Base 45% / Bull 35%',
      bearOcc: '60%',
      baseOcc: '75%',
      bullOcc: '88%',
      targetIRR: '22%',
    },
  ];

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900">Default Values & Impact Guide</h3>
            <p className="text-xs text-gray-500">Understand how each assumption affects IRR, NPV, and CFO recommendations</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-blue-200 p-4 space-y-6">
          {/* Assumption Defaults */}
          {DEFAULTS.map((cat) => (
            <div key={cat.category}>
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                <span>{cat.icon}</span> {cat.category}
              </h4>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <div key={item.name} className="rounded-lg bg-white border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        item.impact === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        item.impact === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        item.impact === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.impact} IMPACT
                      </span>
                    </div>
                    <div className="text-xs text-blue-700 font-mono mb-1.5">Default: {item.default}</div>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Scenario Guide */}
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <span>🎲</span> Risk Appetite & Scenario Weights
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 font-semibold text-gray-700">Risk Profile</th>
                    <th className="text-left p-2 font-semibold text-gray-700">Scenario Probabilities</th>
                    <th className="text-center p-2 font-semibold text-gray-700">Bear Occ.</th>
                    <th className="text-center p-2 font-semibold text-gray-700">Base Occ.</th>
                    <th className="text-center p-2 font-semibold text-gray-700">Bull Occ.</th>
                    <th className="text-center p-2 font-semibold text-gray-700">Target IRR</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIO_GUIDE.map((s) => (
                    <tr key={s.scenario} className="border-t border-gray-200">
                      <td className="p-2 font-medium text-gray-800">{s.scenario}</td>
                      <td className="p-2 text-gray-600">{s.probabilities}</td>
                      <td className="p-2 text-center text-red-600">{s.bearOcc}</td>
                      <td className="p-2 text-center text-gray-800">{s.baseOcc}</td>
                      <td className="p-2 text-center text-green-600">{s.bullOcc}</td>
                      <td className="p-2 text-center font-bold text-blue-700">{s.targetIRR}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CFO Recommendations Cheatsheet */}
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <span>💡</span> CFO Adjustment Playbook
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { title: 'To improve IRR', actions: 'Reduce investment amount, negotiate lower interest rate, increase ADR/Occupancy targets, shorten construction timeline, reduce management fees' },
                { title: 'To improve NPV', actions: 'Lower WACC (better financing terms), increase exit multiple assumption, extend revenue growth rate, improve occupancy ramp' },
                { title: 'To improve DSCR', actions: 'Lower LTV ratio (more equity, less debt), extend debt tenor, reduce interest rate, increase NOI through higher ADR or lower fees' },
                { title: 'To make deal viable', actions: 'Lower Target IRR hurdle, phase construction to reduce upfront capex, secure anchor tenants for guaranteed revenue, switch brand strategy for lower fees' },
              ].map((tip) => (
                <div key={tip.title} className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs font-bold text-emerald-800 mb-1">{tip.title}</p>
                  <p className="text-xs text-emerald-700">{tip.actions}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
