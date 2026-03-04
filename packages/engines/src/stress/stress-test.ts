// ─── Stress Testing & Reverse Stress Testing Module ─────────────────
// F-7: Goes beyond Monte Carlo's stochastic analysis.
//
// Three modes:
// 1. Scenario Shock: Apply specific shocks (rate hike, demand crash, cost overrun)
// 2. Sensitivity Sweep: Vary one parameter across a range, measure impact on IRR/NPV
// 3. Reverse Stress Test: Find the parameter values that break the deal (IRR < WACC, NPV < 0)

import type { Deal, ProFormaOutput } from '@v3grand/core';
import { buildProForma } from '../underwriter/index.js';
import { evaluate as evaluateDecision } from '../decision/index.js';
import { scoreFactors } from '../factor/index.js';

// ── Types ──

export interface ScenarioShock {
  name: string;
  description: string;
  // Multipliers applied to deal assumptions (1.0 = no change)
  occupancyMultiplier?: number;
  adrMultiplier?: number;
  capexMultiplier?: number;
  interestRateAdder?: number;    // Added to debt interest rate (e.g. +0.02 = +200bps)
  exitMultipleAdder?: number;    // Added to exit multiple (e.g. -2 = exit at 6x instead of 8x)
  inflationAdder?: number;       // Added to inflation rate
  constructionDelayMonths?: number;
}

export interface ShockResult {
  shockName: string;
  baseIrr: number;
  stressedIrr: number;
  irrDelta: number;
  baseNpv: number;
  stressedNpv: number;
  npvDelta: number;
  baseVerdict: string;
  stressedVerdict: string;
  verdictFlipped: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface SensitivityPoint {
  parameterValue: number;
  irr: number;
  npv: number;
  verdict: string;
  dscr: number;
}

export interface SensitivityResult {
  parameter: string;
  baseValue: number;
  points: SensitivityPoint[];
  breakEvenValue?: number;  // Value where IRR = WACC or NPV = 0
}

export interface ReverseStressResult {
  parameter: string;
  breakEvenValue: number;
  baseValue: number;
  headroom: number;      // How far from current value to break point (%)
  breakType: 'irr-below-wacc' | 'npv-negative' | 'dscr-below-1' | 'verdict-exit';
}

// ── Pre-defined Institutional Shock Scenarios ──

export const INSTITUTIONAL_SHOCKS: ScenarioShock[] = [
  {
    name: 'Rate Hike +300bps',
    description: 'RBI tightening cycle — repo rate rises 300bps, raising borrowing costs',
    interestRateAdder: 0.03,
  },
  {
    name: 'Demand Crash -30%',
    description: 'Major demand disruption (pandemic, geopolitical) — occupancy drops 30%',
    occupancyMultiplier: 0.70,
  },
  {
    name: 'ADR Compression -20%',
    description: 'New supply flooding market — ADR compresses 20%',
    adrMultiplier: 0.80,
  },
  {
    name: 'CAPEX Overrun +25%',
    description: 'Construction cost inflation or scope creep — 25% cost overrun',
    capexMultiplier: 1.25,
  },
  {
    name: 'Exit Multiple Contraction -2x',
    description: 'Cap rate expansion / market correction — exit multiple drops by 2x',
    exitMultipleAdder: -2,
  },
  {
    name: 'Stagflation',
    description: 'High inflation (+3%) with demand drop (-15%) — worst case macro',
    inflationAdder: 0.03,
    occupancyMultiplier: 0.85,
    interestRateAdder: 0.02,
  },
  {
    name: 'Perfect Storm',
    description: 'Simultaneous demand crash, rate hike, and CAPEX overrun',
    occupancyMultiplier: 0.75,
    interestRateAdder: 0.025,
    capexMultiplier: 1.15,
    exitMultipleAdder: -1,
  },
];

/**
 * Apply scenario shocks and measure impact on deal metrics.
 */
export function runScenarioShocks(
  deal: Deal,
  shocks?: ScenarioShock[],
): ShockResult[] {
  const scenarios = shocks ?? INSTITUTIONAL_SHOCKS;

  // Compute base case
  const baseProforma = buildProForma({ deal, scenarioKey: 'base' });
  const baseFactor = scoreFactors({ deal });
  const baseDecision = evaluateDecision({ deal, proformaResult: baseProforma, factorResult: baseFactor });

  return scenarios.map(shock => {
    const stressedDeal = applyShock(deal, shock);
    const stressedProforma = buildProForma({ deal: stressedDeal, scenarioKey: 'base' });
    const stressedFactor = scoreFactors({ deal: stressedDeal });
    const stressedDecision = evaluateDecision({ deal: stressedDeal, proformaResult: stressedProforma, factorResult: stressedFactor });

    const irrDelta = stressedProforma.irr - baseProforma.irr;
    const npvDelta = stressedProforma.npv - baseProforma.npv;
    const verdictFlipped = stressedDecision.verdict !== baseDecision.verdict;

    let severity: ShockResult['severity'] = 'LOW';
    if (stressedDecision.verdict === 'DO-NOT-PROCEED' || stressedDecision.verdict === 'EXIT') severity = 'CRITICAL';
    else if (stressedDecision.verdict === 'DE-RISK' || verdictFlipped) severity = 'HIGH';
    else if (Math.abs(irrDelta) > 0.03) severity = 'MEDIUM';

    return {
      shockName: shock.name,
      baseIrr: baseProforma.irr,
      stressedIrr: stressedProforma.irr,
      irrDelta,
      baseNpv: baseProforma.npv,
      stressedNpv: stressedProforma.npv,
      npvDelta,
      baseVerdict: baseDecision.verdict,
      stressedVerdict: stressedDecision.verdict,
      verdictFlipped,
      severity,
    };
  });
}

/**
 * Sensitivity sweep: vary one parameter and measure impact.
 */
export function runSensitivitySweep(
  deal: Deal,
  parameter: 'occupancy' | 'adr' | 'exitMultiple' | 'interestRate' | 'capex' | 'inflation',
  range: { min: number; max: number; steps: number },
): SensitivityResult {
  const points: SensitivityPoint[] = [];
  const step = (range.max - range.min) / range.steps;
  const baseValue = getParameterValue(deal, parameter);
  let breakEvenValue: number | undefined;

  const wacc = deal.financialAssumptions.wacc ?? 0.12;

  for (let i = 0; i <= range.steps; i++) {
    const value = range.min + step * i;
    const adjustedDeal = setParameterValue(deal, parameter, value);
    const proforma = buildProForma({ deal: adjustedDeal, scenarioKey: 'base' });
    const factor = scoreFactors({ deal: adjustedDeal });
    const decision = evaluateDecision({ deal: adjustedDeal, proformaResult: proforma, factorResult: factor });

    points.push({
      parameterValue: value,
      irr: proforma.irr,
      npv: proforma.npv,
      verdict: decision.verdict,
      dscr: proforma.avgDSCR,
    });

    // Find break-even (IRR = WACC crossover)
    if (i > 0 && !breakEvenValue) {
      const prev = points[i - 1];
      const curr = points[i];
      if ((prev.irr >= wacc && curr.irr < wacc) || (prev.irr < wacc && curr.irr >= wacc)) {
        // Linear interpolation
        const ratio = (wacc - prev.irr) / (curr.irr - prev.irr);
        breakEvenValue = prev.parameterValue + ratio * (curr.parameterValue - prev.parameterValue);
      }
    }
  }

  return { parameter, baseValue, points, breakEvenValue };
}

/**
 * Reverse Stress Test: Find the parameter values that break the deal.
 * Uses binary search to find the exact break point for each parameter.
 */
export function runReverseStressTest(
  deal: Deal,
  parameters?: Array<'occupancy' | 'adr' | 'exitMultiple' | 'interestRate' | 'capex'>,
): ReverseStressResult[] {
  const params = parameters ?? ['occupancy', 'adr', 'exitMultiple', 'interestRate', 'capex'];
  const wacc = deal.financialAssumptions.wacc ?? 0.12;
  const results: ReverseStressResult[] = [];

  for (const param of params) {
    const baseValue = getParameterValue(deal, param);
    const bounds = getSearchBounds(param, baseValue);

    // Binary search for the break point (IRR < WACC)
    let lo = bounds.min;
    let hi = bounds.max;
    let breakValue: number | undefined;

    for (let iter = 0; iter < 30; iter++) {
      const mid = (lo + hi) / 2;
      const adjustedDeal = setParameterValue(deal, param, mid);
      const proforma = buildProForma({ deal: adjustedDeal, scenarioKey: 'base' });

      if (proforma.irr < wacc) {
        breakValue = mid;
        // Move towards base value (the "less stressed" direction)
        if (param === 'interestRate' || param === 'capex') {
          hi = mid; // Lower values are less stressed
        } else {
          lo = mid; // Higher values are less stressed
        }
      } else {
        if (param === 'interestRate' || param === 'capex') {
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }

    if (breakValue !== undefined) {
      const headroom = Math.abs(breakValue - baseValue) / Math.abs(baseValue);
      results.push({
        parameter: param,
        breakEvenValue: Math.round(breakValue * 10000) / 10000,
        baseValue,
        headroom: Math.round(headroom * 10000) / 10000,
        breakType: 'irr-below-wacc',
      });
    }
  }

  return results;
}

// ── Helpers ──

function applyShock(deal: Deal, shock: ScenarioShock): Deal {
  const d = JSON.parse(JSON.stringify(deal)) as Deal;
  const scenarios = d.scenarios as any;
  const base = scenarios?.base ?? {};
  const fin = d.financialAssumptions as any;
  const capex = d.capexPlan as any;

  if (shock.occupancyMultiplier !== undefined) {
    base.occupancyStabilized = (base.occupancyStabilized ?? 0.72) * shock.occupancyMultiplier;
  }
  if (shock.adrMultiplier !== undefined) {
    base.adrStabilized = (base.adrStabilized ?? 7000) * shock.adrMultiplier;
  }
  if (shock.interestRateAdder !== undefined) {
    fin.debtInterestRate = (fin.debtInterestRate ?? 0.095) + shock.interestRateAdder;
  }
  if (shock.exitMultipleAdder !== undefined) {
    fin.exitMultiple = Math.max(1, (fin.exitMultiple ?? 8) + shock.exitMultipleAdder);
  }
  if (shock.inflationAdder !== undefined) {
    fin.inflationRate = (fin.inflationRate ?? 0.05) + shock.inflationAdder;
  }
  if (shock.capexMultiplier !== undefined && capex?.phase1) {
    capex.phase1.totalBudgetCr = (capex.phase1.totalBudgetCr ?? 0) * shock.capexMultiplier;
  }

  if (scenarios) scenarios.base = base;
  d.financialAssumptions = fin;
  d.capexPlan = capex;
  return d;
}

function getParameterValue(deal: Deal, param: string): number {
  const scenarios = deal.scenarios as any;
  const fin = deal.financialAssumptions as any;
  const capex = deal.capexPlan as any;

  switch (param) {
    case 'occupancy': return scenarios?.base?.occupancyStabilized ?? 0.72;
    case 'adr': return scenarios?.base?.adrStabilized ?? 7000;
    case 'exitMultiple': return fin?.exitMultiple ?? 8;
    case 'interestRate': return fin?.debtInterestRate ?? 0.095;
    case 'capex': return capex?.phase1?.totalBudgetCr ?? 100;
    case 'inflation': return fin?.inflationRate ?? 0.05;
    default: return 0;
  }
}

function setParameterValue(deal: Deal, param: string, value: number): Deal {
  const d = JSON.parse(JSON.stringify(deal)) as Deal;
  const scenarios = d.scenarios as any;
  const fin = d.financialAssumptions as any;
  const capex = d.capexPlan as any;

  switch (param) {
    case 'occupancy': if (scenarios?.base) scenarios.base.occupancyStabilized = value; break;
    case 'adr': if (scenarios?.base) scenarios.base.adrStabilized = value; break;
    case 'exitMultiple': fin.exitMultiple = value; break;
    case 'interestRate': fin.debtInterestRate = value; break;
    case 'capex': if (capex?.phase1) capex.phase1.totalBudgetCr = value; break;
    case 'inflation': fin.inflationRate = value; break;
  }

  d.financialAssumptions = fin;
  d.capexPlan = capex;
  return d;
}

function getSearchBounds(param: string, baseValue: number): { min: number; max: number } {
  switch (param) {
    case 'occupancy': return { min: 0.10, max: baseValue };         // Search downward from base
    case 'adr': return { min: 1000, max: baseValue };               // Search downward
    case 'exitMultiple': return { min: 2, max: baseValue };         // Search downward
    case 'interestRate': return { min: baseValue, max: 0.25 };      // Search upward
    case 'capex': return { min: baseValue, max: baseValue * 3 };    // Search upward
    default: return { min: 0, max: baseValue * 2 };
  }
}
