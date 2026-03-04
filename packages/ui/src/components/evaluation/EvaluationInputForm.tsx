// ─── Evaluation Input Form ──────────────────────────────────────────
// Rich input UI grouped into sections matching the Excel model tabs:
// Key Assumptions, Market Opportunity, Capital Structure, Operating Model, Risks

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DealEvaluationInput, WACCInputs, RiskItem, ScenarioAssumptions } from '@v3grand/core';

interface Props {
  initialInput: DealEvaluationInput;
  onSubmit: (input: DealEvaluationInput) => void;
  isLoading: boolean;
  readOnly?: boolean;
}

type Section = 'assumptions' | 'market' | 'capital' | 'operating' | 'scenarios' | 'risks';

const SECTION_LABELS: Record<Section, string> = {
  assumptions: 'Key Assumptions',
  market: 'Market & Revenue',
  capital: 'Capital Structure',
  operating: 'Operating Model',
  scenarios: 'Scenario Analysis',
  risks: 'Risk Register',
};

export function EvaluationInputForm({ initialInput, onSubmit, isLoading, readOnly = false }: Props) {
  const [input, setInput] = useState<DealEvaluationInput>(initialInput);
  const [activeSection, setActiveSection] = useState<Section>('assumptions');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-save with debounce
  const updateField = useCallback(<K extends keyof DealEvaluationInput>(key: K, value: DealEvaluationInput[K]) => {
    setInput(prev => {
      const next = { ...prev, [key]: value };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Auto-save via localStorage
        try { localStorage.setItem(`eval-draft-${next.dealId}`, JSON.stringify(next)); } catch {}
      }, 1000);
      return next;
    });
  }, []);

  const updateNested = useCallback((path: string, value: unknown) => {
    setInput(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Section Tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto border-b border-surface-100">
        {(Object.entries(SECTION_LABELS) as [Section, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeSection === 'assumptions' && (
          <KeyAssumptionsSection input={input} updateField={updateField} updateNested={updateNested} readOnly={readOnly} />
        )}
        {activeSection === 'market' && (
          <MarketSection input={input} updateNested={updateNested} readOnly={readOnly} />
        )}
        {activeSection === 'capital' && (
          <CapitalStructureSection input={input} updateField={updateField} updateNested={updateNested} readOnly={readOnly} />
        )}
        {activeSection === 'operating' && (
          <OperatingModelSection input={input} updateNested={updateNested} readOnly={readOnly} />
        )}
        {activeSection === 'scenarios' && (
          <ScenarioSection input={input} updateNested={updateNested} readOnly={readOnly} />
        )}
        {activeSection === 'risks' && (
          <RiskSection input={input} updateField={updateField} readOnly={readOnly} />
        )}
      </div>

      {/* Run Button */}
      {!readOnly && (
        <div className="border-t border-surface-100 px-4 py-3 bg-surface-50">
          <button
            onClick={() => onSubmit(input)}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Evaluation...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Run Full Evaluation
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Key Assumptions Section ──
function KeyAssumptionsSection({ input, updateField, updateNested, readOnly }: {
  input: DealEvaluationInput; updateField: Function; updateNested: Function; readOnly: boolean;
}) {
  return (
    <div className="space-y-6">
      <FieldGroup title="Project Identity">
        <TextField label="Deal Name" value={input.dealName} onChange={v => updateField('dealName', v)} readOnly={readOnly} />
        <TextField label="City" value={input.location.city} onChange={v => updateNested('location.city', v)} readOnly={readOnly} />
        <TextField label="State" value={input.location.state} onChange={v => updateNested('location.state', v)} readOnly={readOnly} />
      </FieldGroup>

      <FieldGroup title="Investment Size">
        <CurrencyField label="Total Project Cost" value={input.totalProjectCost} onChange={v => updateField('totalProjectCost', v)} readOnly={readOnly} tooltip="Total development cost including land, construction, soft costs" />
        <CurrencyField label="Land Cost" value={input.landCost} onChange={v => updateField('landCost', v)} readOnly={readOnly} />
        <CurrencyField label="Construction Cost" value={input.constructionCost} onChange={v => updateField('constructionCost', v)} readOnly={readOnly} />
        <CurrencyField label="Soft Costs" value={input.softCosts} onChange={v => updateField('softCosts', v)} readOnly={readOnly} />
        <CurrencyField label="Pre-Opening Cost" value={input.preOpeningCost} onChange={v => updateField('preOpeningCost', v)} readOnly={readOnly} />
        <PctField label="Contingency" value={input.contingencyPct} onChange={v => updateField('contingencyPct', v)} readOnly={readOnly} />
      </FieldGroup>

      <FieldGroup title="WACC / Hurdle Rate">
        <PctField label="Risk-Free Rate" value={input.waccInputs.riskFreeRate} onChange={v => updateNested('waccInputs.riskFreeRate', v)} readOnly={readOnly} tooltip="10Y government bond yield" />
        <PctField label="Equity Risk Premium" value={input.waccInputs.equityRiskPremium} onChange={v => updateNested('waccInputs.equityRiskPremium', v)} readOnly={readOnly} />
        <NumberField label="Beta (Levered)" value={input.waccInputs.betaLevered} onChange={v => updateNested('waccInputs.betaLevered', v)} readOnly={readOnly} step={0.05} />
        <PctField label="Country Risk Premium" value={input.waccInputs.countryRiskPremium} onChange={v => updateNested('waccInputs.countryRiskPremium', v)} readOnly={readOnly} />
        <PctField label="Size Premium" value={input.waccInputs.sizeRiskPremium} onChange={v => updateNested('waccInputs.sizeRiskPremium', v)} readOnly={readOnly} />
      </FieldGroup>

      <FieldGroup title="Exit Assumptions">
        <PctField label="Exit Cap Rate" value={input.exitCapRate} onChange={v => updateField('exitCapRate', v)} readOnly={readOnly} />
        <NumberField label="Exit Multiple" value={input.exitMultiple} onChange={v => updateField('exitMultiple', v)} readOnly={readOnly} step={0.5} />
        <NumberField label="Projection Years" value={input.projectionYears} onChange={v => updateField('projectionYears', v)} readOnly={readOnly} step={1} />
      </FieldGroup>

      <FieldGroup title="Tax & Inflation">
        <PctField label="Corporate Tax Rate" value={input.taxRate} onChange={v => updateField('taxRate', v)} readOnly={readOnly} />
        <PctField label="Inflation Rate" value={input.inflationRate} onChange={v => updateField('inflationRate', v)} readOnly={readOnly} />
      </FieldGroup>
    </div>
  );
}

// ── Market Section ──
function MarketSection({ input, updateNested, readOnly }: {
  input: DealEvaluationInput; updateNested: Function; readOnly: boolean;
}) {
  const sector = input.sectorInputs as any;
  return (
    <div className="space-y-6">
      <FieldGroup title="Property">
        <NumberField label="Total Keys (Phase 1)" value={sector.totalKeys} onChange={v => updateNested('sectorInputs.totalKeys', v)} readOnly={readOnly} step={1} />
        <NumberField label="Phase 2 Keys" value={sector.phase2Keys} onChange={v => updateNested('sectorInputs.phase2Keys', v)} readOnly={readOnly} step={1} />
      </FieldGroup>

      <FieldGroup title="Revenue Drivers">
        <CurrencyField label="Base ADR (Year 1)" value={sector.adrBase} onChange={v => updateNested('sectorInputs.adrBase', v)} readOnly={readOnly} />
        <CurrencyField label="Stabilized ADR" value={sector.adrStabilized} onChange={v => updateNested('sectorInputs.adrStabilized', v)} readOnly={readOnly} />
        <PctField label="ADR Growth Rate" value={sector.adrGrowthRate} onChange={v => updateNested('sectorInputs.adrGrowthRate', v)} readOnly={readOnly} />
        <SliderField label="Stabilized Occupancy" value={sector.occupancyStabilized} onChange={v => updateNested('sectorInputs.occupancyStabilized', v)} readOnly={readOnly} min={0.30} max={0.95} step={0.01} />
      </FieldGroup>

      <FieldGroup title="Revenue Mix">
        <PctField label="Rooms %" value={sector.revenueMix?.rooms ?? 0.55} onChange={v => updateNested('sectorInputs.revenueMix.rooms', v)} readOnly={readOnly} />
        <PctField label="F&B %" value={sector.revenueMix?.fb ?? 0.25} onChange={v => updateNested('sectorInputs.revenueMix.fb', v)} readOnly={readOnly} />
        <PctField label="Banquet %" value={sector.revenueMix?.banquet ?? 0.12} onChange={v => updateNested('sectorInputs.revenueMix.banquet', v)} readOnly={readOnly} />
        <PctField label="Spa %" value={sector.revenueMix?.spa ?? 0.03} onChange={v => updateNested('sectorInputs.revenueMix.spa', v)} readOnly={readOnly} />
        <PctField label="Other %" value={sector.revenueMix?.other ?? 0.05} onChange={v => updateNested('sectorInputs.revenueMix.other', v)} readOnly={readOnly} />
      </FieldGroup>

      <FieldGroup title="Market Context">
        <PctField label="Supply Growth" value={sector.marketSupplyGrowthPct} onChange={v => updateNested('sectorInputs.marketSupplyGrowthPct', v)} readOnly={readOnly} />
        <PctField label="Demand Growth" value={sector.marketDemandGrowthPct} onChange={v => updateNested('sectorInputs.marketDemandGrowthPct', v)} readOnly={readOnly} />
      </FieldGroup>
    </div>
  );
}

// ── Capital Structure Section ──
function CapitalStructureSection({ input, updateField, updateNested, readOnly }: {
  input: DealEvaluationInput; updateField: Function; updateNested: Function; readOnly: boolean;
}) {
  return (
    <div className="space-y-6">
      <FieldGroup title="Primary Capital Structure">
        <SliderField label="Equity %" value={input.equityPct} onChange={v => { updateField('equityPct', v); updateField('debtPct', 1 - v); }} readOnly={readOnly} min={0.10} max={0.80} step={0.05} />
        <PctField label="Debt %" value={input.debtPct} onChange={v => { updateField('debtPct', v); updateField('equityPct', 1 - v); }} readOnly={readOnly} />
        <PctField label="Interest Rate" value={input.interestRate} onChange={v => updateField('interestRate', v)} readOnly={readOnly} />
        <NumberField label="Debt Tenor (Years)" value={input.debtTenorYears} onChange={v => updateField('debtTenorYears', v)} readOnly={readOnly} step={1} />
        <NumberField label="Grace Period (Years)" value={input.gracePeriodYears} onChange={v => updateField('gracePeriodYears', v)} readOnly={readOnly} step={1} />
      </FieldGroup>

      <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Capital Structure Comparison</h4>
        <p className="text-xs text-surface-400 mb-3">These options will be compared side-by-side in the evaluation results.</p>
        {input.capitalStructureOptions.map((opt, i) => (
          <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-surface-100 last:border-0">
            <span className="font-medium text-surface-700 w-40">{opt.label}</span>
            <span className="text-surface-500">{(opt.debtPct * 100).toFixed(0)}% Debt</span>
            <span className="text-surface-500">{(opt.interestRate * 100).toFixed(1)}% Rate</span>
            <span className="text-surface-500">{opt.tenorYears}Y Tenor</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Operating Model Section ──
function OperatingModelSection({ input, updateNested, readOnly }: {
  input: DealEvaluationInput; updateNested: Function; readOnly: boolean;
}) {
  const sector = input.sectorInputs as any;
  return (
    <div className="space-y-6">
      <FieldGroup title="Operating Expenses (USALI)">
        <PctField label="Departmental Cost %" value={sector.departmentalCostPct} onChange={v => updateNested('sectorInputs.departmentalCostPct', v)} readOnly={readOnly} />
        <PctField label="Undistributed Cost %" value={sector.undistributedCostPct} onChange={v => updateNested('sectorInputs.undistributedCostPct', v)} readOnly={readOnly} />
        <PctField label="Management Fee %" value={sector.managementFeePct} onChange={v => updateNested('sectorInputs.managementFeePct', v)} readOnly={readOnly} />
        <PctField label="Incentive Fee %" value={sector.incentiveFeePct} onChange={v => updateNested('sectorInputs.incentiveFeePct', v)} readOnly={readOnly} />
        <PctField label="FF&E Reserve %" value={sector.ffAndEReservePct} onChange={v => updateNested('sectorInputs.ffAndEReservePct', v)} readOnly={readOnly} />
      </FieldGroup>

      <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
        <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Operating Model Options</h4>
        <p className="text-xs text-surface-400 mb-3">Independent vs Brand comparison will appear in results.</p>
        {input.operatingModelOptions.map((opt, i) => (
          <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-surface-100 last:border-0">
            <span className="font-medium text-surface-700 w-48">{opt.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${
              opt.type === 'brand' ? 'bg-blue-50 text-blue-600' : opt.type === 'independent' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>{opt.type}</span>
            <span className="text-surface-500">{(opt.baseMgmtFeePct * 100).toFixed(1)}% Mgmt</span>
            {opt.brandFeePct > 0 && <span className="text-surface-500">{(opt.brandFeePct * 100).toFixed(1)}% Brand</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scenario Section ──
function ScenarioSection({ input, updateNested, readOnly }: {
  input: DealEvaluationInput; updateNested: Function; readOnly: boolean;
}) {
  return (
    <div className="space-y-6">
      {(['bear', 'base', 'bull'] as const).map(key => {
        const s = input.scenarios[key];
        const colors = key === 'bear' ? 'border-red-200 bg-red-50/30'
          : key === 'bull' ? 'border-emerald-200 bg-emerald-50/30' : 'border-blue-200 bg-blue-50/30';
        return (
          <div key={key} className={`p-4 rounded-xl border ${colors}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold capitalize">{key} Case</h4>
              <PctField label="Probability" value={s.probability} onChange={v => updateNested(`scenarios.${key}.probability`, v)} readOnly={readOnly} inline />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SliderField label="Occupancy" value={s.occupancyStabilized} onChange={v => updateNested(`scenarios.${key}.occupancyStabilized`, v)} readOnly={readOnly} min={0.30} max={0.95} step={0.01} />
              <CurrencyField label="ADR" value={s.adrStabilized} onChange={v => updateNested(`scenarios.${key}.adrStabilized`, v)} readOnly={readOnly} />
              <PctField label="Revenue Growth" value={s.revenueGrowthRate} onChange={v => updateNested(`scenarios.${key}.revenueGrowthRate`, v)} readOnly={readOnly} />
              <PctField label="Cost Overrun" value={s.constructionCostOverrun} onChange={v => updateNested(`scenarios.${key}.constructionCostOverrun`, v)} readOnly={readOnly} />
              <PctField label="Exit Cap Rate" value={s.exitCapRate} onChange={v => updateNested(`scenarios.${key}.exitCapRate`, v)} readOnly={readOnly} />
              <NumberField label="Exit Multiple" value={s.exitMultiple} onChange={v => updateNested(`scenarios.${key}.exitMultiple`, v)} readOnly={readOnly} step={0.5} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Risk Section ──
function RiskSection({ input, updateField, readOnly }: {
  input: DealEvaluationInput; updateField: Function; readOnly: boolean;
}) {
  const addRisk = () => {
    const newRisk = {
      id: `risk-${Date.now()}`, name: '', category: 'market' as const,
      likelihood: 3 as const, impact: 3 as const,
      mitigationStrategy: '', residualLikelihood: 2 as const, residualImpact: 2 as const, owner: '',
    };
    updateField('risks', [...input.risks, newRisk]);
  };

  const updateRisk = (idx: number, field: string, value: unknown) => {
    const updated = [...input.risks];
    (updated[idx] as any)[field] = value;
    updateField('risks', updated);
  };

  const removeRisk = (idx: number) => {
    updateField('risks', input.risks.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-surface-700">Risk Register ({input.risks.length} risks)</h4>
        {!readOnly && (
          <button onClick={addRisk} className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">
            + Add Risk
          </button>
        )}
      </div>

      {input.risks.map((risk, i) => (
        <div key={risk.id} className="p-3 rounded-xl border border-surface-200 bg-surface-50/50">
          <div className="flex items-start justify-between mb-2">
            <input
              value={risk.name}
              onChange={e => updateRisk(i, 'name', e.target.value)}
              placeholder="Risk name..."
              disabled={readOnly}
              className="text-sm font-medium text-surface-800 bg-transparent border-none outline-none w-full"
            />
            {!readOnly && (
              <button onClick={() => removeRisk(i)} className="text-surface-400 hover:text-red-500 ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-surface-400">Category</label>
              <select
                value={risk.category}
                onChange={e => updateRisk(i, 'category', e.target.value)}
                disabled={readOnly}
                className="w-full mt-0.5 px-2 py-1 rounded border border-surface-200 text-xs bg-white"
              >
                {['market', 'construction', 'regulatory', 'financial', 'operational', 'environmental', 'political', 'execution'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-surface-400">Likelihood</label>
              <select value={risk.likelihood} onChange={e => updateRisk(i, 'likelihood', Number(e.target.value))} disabled={readOnly} className="w-full mt-0.5 px-2 py-1 rounded border border-surface-200 text-xs bg-white">
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-surface-400">Impact</label>
              <select value={risk.impact} onChange={e => updateRisk(i, 'impact', Number(e.target.value))} disabled={readOnly} className="w-full mt-0.5 px-2 py-1 rounded border border-surface-200 text-xs bg-white">
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-surface-400">Score</label>
              <div className={`mt-0.5 px-2 py-1 rounded text-center font-bold ${
                risk.likelihood * risk.impact >= 16 ? 'bg-red-100 text-red-700'
                : risk.likelihood * risk.impact >= 9 ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
              }`}>
                {risk.likelihood * risk.impact}
              </div>
            </div>
          </div>
          <textarea
            value={risk.mitigationStrategy}
            onChange={e => updateRisk(i, 'mitigationStrategy', e.target.value)}
            placeholder="Mitigation strategy..."
            disabled={readOnly}
            rows={2}
            className="w-full mt-2 px-2 py-1 rounded border border-surface-200 text-xs bg-white resize-none"
          />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REUSABLE FIELD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, readOnly, tooltip }: {
  label: string; value: string; onChange: (v: string) => void; readOnly: boolean; tooltip?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-surface-500" title={tooltip}>{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-surface-200 text-sm bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 disabled:bg-surface-50" />
    </label>
  );
}

function NumberField({ label, value, onChange, readOnly, step = 1, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; readOnly: boolean; step?: number; tooltip?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-surface-500" title={tooltip}>{label}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} disabled={readOnly} step={step}
        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-surface-200 text-sm bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 disabled:bg-surface-50 font-mono" />
    </label>
  );
}

function CurrencyField({ label, value, onChange, readOnly, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; readOnly: boolean; tooltip?: string;
}) {
  const crore = value / 1e7;
  return (
    <label className="block">
      <span className="text-xs text-surface-500" title={tooltip}>{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-xs text-surface-400">₹</span>
        <input type="number" value={Math.round(value)} onChange={e => onChange(Number(e.target.value))} disabled={readOnly}
          className="w-full px-2 py-1.5 rounded-lg border border-surface-200 text-sm bg-white focus:ring-1 focus:ring-brand-500 font-mono disabled:bg-surface-50" />
        <span className="text-2xs text-surface-400 whitespace-nowrap">{crore.toFixed(1)} Cr</span>
      </div>
    </label>
  );
}

function PctField({ label, value, onChange, readOnly, tooltip, inline }: {
  label: string; value: number; onChange: (v: number) => void; readOnly: boolean; tooltip?: string; inline?: boolean;
}) {
  const pctDisplay = (value * 100).toFixed(1);
  return (
    <label className={`${inline ? 'flex items-center gap-2' : 'block'}`}>
      <span className="text-xs text-surface-500" title={tooltip}>{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <input type="number" value={pctDisplay} onChange={e => onChange(Number(e.target.value) / 100)} disabled={readOnly} step={0.1}
          className={`${inline ? 'w-16' : 'w-full'} px-2 py-1.5 rounded-lg border border-surface-200 text-sm bg-white focus:ring-1 focus:ring-brand-500 font-mono disabled:bg-surface-50`} />
        <span className="text-xs text-surface-400">%</span>
      </div>
    </label>
  );
}

function SliderField({ label, value, onChange, readOnly, min, max, step, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; readOnly: boolean; min: number; max: number; step: number; tooltip?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500" title={tooltip}>{label}</span>
        <span className="text-xs font-mono text-surface-700">{(value * 100).toFixed(0)}%</span>
      </div>
      <input type="range" value={value} onChange={e => onChange(Number(e.target.value))} disabled={readOnly} min={min} max={max} step={step}
        className="w-full mt-1 accent-brand-500" />
    </label>
  );
}
