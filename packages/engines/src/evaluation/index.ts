// ─── Unified Deal Evaluation Engine ─────────────────────────────────
// Generic pipeline: DealEvaluationInput → DealEvaluationOutput
// Sector-specific logic delegated to AssetPlugin.
// Pure functions, no I/O.

import type {
  DealEvaluationInput, DealEvaluationOutput, AssetPlugin,
  WACCOutput, EvaluationYearProjection, ScenarioResult,
  CapitalStructureOption, RiskMatrixOutput, RiskItem,
  LiteAlternativeResult, SensitivityMatrix, SensitivityCell,
  EvaluationVerdict, ICScorecard, ICSection,
} from '@v3grand/core';
import { calcIRR, calcNPV } from '../_shared/irr.js';

// ═══════════════════════════════════════════════════════════════════════
// MAIN EVALUATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════

export function evaluateDeal(
  input: DealEvaluationInput,
  plugin: AssetPlugin,
): DealEvaluationOutput {
  const t0 = Date.now();

  // 1. WACC
  const wacc = computeWACC(input.waccInputs);

  // 2. Base-case projections via plugin
  const baseScenario = input.scenarios.base;
  const { revenue, opex, sectorMetrics } = plugin.computeProjections(
    input.sectorInputs, baseScenario, input.projectionYears, input.inflationRate,
  );

  // 3. Year-by-year projections with debt service, tax, FCFE
  const projections = buildProjections(input, revenue, opex, sectorMetrics, wacc);

  // 4. Cash flows and core metrics
  const cashFlows = buildCashFlows(input, projections);
  const irr = calcIRR(cashFlows);
  const npv = calcNPV(cashFlows, wacc.hurdleRate);
  const equity = input.totalProjectCost * input.equityPct;
  const totalPositive = cashFlows.filter(cf => cf > 0).reduce((a, b) => a + b, 0);
  const equityMultiple = equity > 0 ? totalPositive / equity : 0;
  const paybackYears = computePayback(cashFlows, equity);
  const dscrValues = projections.map(p => p.dscr).filter(d => d > 0 && isFinite(d));
  const avgDSCR = dscrValues.length > 0 ? dscrValues.reduce((a, b) => a + b, 0) / dscrValues.length : 0;
  const stabYear = Math.min(input.stabilizationYear, projections.length);
  const ebitdaMarginStabilized = projections[stabYear - 1]?.ebitdaMargin ?? 0;
  const exitEbitda = projections[projections.length - 1]?.ebitda ?? 0;
  const exitValue = exitEbitda * input.exitMultiple;

  // 5. Scenario analysis
  const scenarioResults = computeScenarios(input, plugin, wacc);
  const pwIRR = scenarioResults.bear.probability * scenarioResults.bear.irr
    + scenarioResults.base.probability * scenarioResults.base.irr
    + scenarioResults.bull.probability * scenarioResults.bull.irr;
  const pwNPV = scenarioResults.bear.probability * scenarioResults.bear.npv
    + scenarioResults.base.probability * scenarioResults.base.npv
    + scenarioResults.bull.probability * scenarioResults.bull.npv;

  // 6. Capital structure comparison
  const capitalStructureComparison = computeCapitalStructures(input, plugin, wacc);

  // 7. Risk matrix
  const riskMatrix = computeRiskMatrix(input.risks);

  // 8. Operating model comparison
  const operatingModelComparison = plugin.computeOperatingModels(
    input.sectorInputs, revenue, opex, input.operatingModelOptions,
  );

  // 9. Lite alternatives
  const liteAlternativeResults = computeLiteAlternatives(input.liteAlternatives, wacc, irr, npv);

  // 10. Sensitivity matrix
  const sensitivityMatrix = input.sensitivityConfig
    ? computeSensitivity(input, plugin, wacc)
    : null;

  // 11. Decision
  const verdict = computeVerdict(irr, npv, avgDSCR, equityMultiple, paybackYears, wacc, riskMatrix, scenarioResults);
  const confidence = computeConfidence(irr, wacc, avgDSCR, riskMatrix, scenarioResults);
  const decisionDrivers = computeDrivers(irr, npv, equityMultiple, avgDSCR, wacc, riskMatrix, scenarioResults);
  const decisionRisks = computeRisks(irr, npv, avgDSCR, wacc, riskMatrix, scenarioResults, paybackYears);
  const flipConditions = computeFlips(verdict, irr, npv, avgDSCR, wacc, paybackYears);
  const narrative = composeNarrative(verdict, confidence, irr, npv, equityMultiple, wacc, riskMatrix, scenarioResults, paybackYears);

  // 12. IC Scorecard
  const sectorSections = plugin.getICSections(input.sectorInputs, projections);
  const icScorecard = buildICScorecard(
    irr, npv, equityMultiple, avgDSCR, wacc, riskMatrix, scenarioResults, sectorSections, verdict,
  );

  return {
    irr: r4(irr), npv: Math.round(npv), equityMultiple: r4(equityMultiple),
    paybackYears, avgDSCR: r4(avgDSCR), ebitdaMarginStabilized: r4(ebitdaMarginStabilized),
    exitValue: Math.round(exitValue),
    wacc, projections, cashFlows: cashFlows.map(Math.round),
    scenarioResults, probabilityWeightedIRR: r4(pwIRR), probabilityWeightedNPV: Math.round(pwNPV),
    capitalStructureComparison, riskMatrix, operatingModelComparison,
    liteAlternativeResults, sensitivityMatrix,
    verdict, confidence, decisionDrivers, decisionRisks, flipConditions, narrative, icScorecard,
    computedAt: new Date().toISOString(), durationMs: Date.now() - t0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// WACC CALCULATOR
// ═══════════════════════════════════════════════════════════════════════

function computeWACC(w: DealEvaluationInput['waccInputs']): WACCOutput {
  const costOfEquity = w.riskFreeRate + w.betaLevered * w.equityRiskPremium + w.countryRiskPremium + w.sizeRiskPremium;
  const afterTaxCostOfDebt = w.costOfDebt * (1 - w.taxRate);
  const wacc = w.equityWeight * costOfEquity + w.debtWeight * afterTaxCostOfDebt;
  const hurdleSpreadBps = 200; // 200bps above WACC standard
  const hurdleRate = wacc + hurdleSpreadBps / 10000;
  return { costOfEquity: r4(costOfEquity), afterTaxCostOfDebt: r4(afterTaxCostOfDebt), wacc: r4(wacc), hurdleRate: r4(hurdleRate), hurdleSpreadBps };
}

// ═══════════════════════════════════════════════════════════════════════
// PROJECTIONS BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildProjections(
  input: DealEvaluationInput,
  revenue: number[],
  opex: number[],
  sectorMetrics: Record<string, number>[],
  wacc: WACCOutput,
): EvaluationYearProjection[] {
  const debt = input.totalProjectCost * input.debtPct;
  const r = input.interestRate;
  const n = input.debtTenorYears;
  const grace = input.gracePeriodYears;

  // Annuity factor (post-grace)
  const effectiveTenor = n - grace;
  const annuityFactor = r > 0 && effectiveTenor > 0
    ? (r * Math.pow(1 + r, effectiveTenor)) / (Math.pow(1 + r, effectiveTenor) - 1)
    : effectiveTenor > 0 ? 1 / effectiveTenor : 0;
  const annualDebtService = debt * annuityFactor;

  const projections: EvaluationYearProjection[] = [];

  for (let y = 0; y < input.projectionYears; y++) {
    const rev = revenue[y] ?? 0;
    const opx = opex[y] ?? 0;
    const ebitda = rev - opx;
    const ebitdaMargin = rev > 0 ? ebitda / rev : 0;
    const ds = (y + 1) > grace ? annualDebtService : debt * r; // interest-only during grace
    const taxableIncome = ebitda - debt * r;
    const tax = Math.max(0, taxableIncome * input.taxRate);
    const fcfe = ebitda - tax - ds;
    const dscr = ds > 0 ? ebitda / ds : 0;

    projections.push({
      year: y + 1,
      revenue: Math.round(rev),
      operatingExpenses: Math.round(opx),
      ebitda: Math.round(ebitda),
      ebitdaMargin: r4(ebitdaMargin),
      debtService: Math.round(ds),
      fcfe: Math.round(fcfe),
      dscr: r4(dscr),
      sectorMetrics: sectorMetrics[y] ?? {},
    });
  }

  return projections;
}

// ═══════════════════════════════════════════════════════════════════════
// CASH FLOW BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildCashFlows(input: DealEvaluationInput, projections: EvaluationYearProjection[]): number[] {
  const equity = input.totalProjectCost * input.equityPct;
  const exitEbitda = projections[projections.length - 1]?.ebitda ?? 0;
  const exitValue = exitEbitda * input.exitMultiple;
  const debt = input.totalProjectCost * input.debtPct;

  // Simple outstanding debt at exit (approximate — assumes level amortization)
  const r = input.interestRate;
  const n = input.debtTenorYears;
  const exitYear = input.projectionYears;
  let outstandingDebt = debt;
  const annuityFactor = r > 0 && n > 0
    ? (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : n > 0 ? 1 / n : 0;
  const annualDS = debt * annuityFactor;
  for (let y = 1; y <= exitYear; y++) {
    if (y > input.gracePeriodYears) {
      const interest = outstandingDebt * r;
      const principal = annualDS - interest;
      outstandingDebt = Math.max(0, outstandingDebt - principal);
    }
  }
  const exitEquity = exitValue - outstandingDebt;

  const cfs: number[] = [-equity];
  for (let i = 0; i < projections.length - 1; i++) {
    cfs.push(projections[i].fcfe);
  }
  cfs.push((projections[projections.length - 1]?.fcfe ?? 0) + exitEquity);
  return cfs;
}

function computePayback(cashFlows: number[], equity: number): number {
  let cum = 0;
  for (let i = 1; i < cashFlows.length; i++) {
    cum += cashFlows[i];
    if (cum >= equity) return i;
  }
  return cashFlows.length;
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function computeScenarios(
  input: DealEvaluationInput, plugin: AssetPlugin, wacc: WACCOutput,
): { bear: ScenarioResult; base: ScenarioResult; bull: ScenarioResult } {
  const result: Record<string, ScenarioResult> = {};

  for (const key of ['bear', 'base', 'bull'] as const) {
    const scenario = input.scenarios[key];
    const { revenue, opex, sectorMetrics } = plugin.computeProjections(
      input.sectorInputs, scenario, input.projectionYears, input.inflationRate,
    );

    // Apply cost overrun
    const adjCost = input.totalProjectCost * (1 + scenario.constructionCostOverrun);
    const adjInput = { ...input, totalProjectCost: adjCost };

    const projections = buildProjections(adjInput, revenue, opex, sectorMetrics, wacc);
    const cashFlows = buildCashFlows(adjInput, projections);
    const irr = calcIRR(cashFlows);
    const npv = calcNPV(cashFlows, wacc.hurdleRate);
    const equity = adjCost * input.equityPct;
    const totalPos = cashFlows.filter(cf => cf > 0).reduce((a, b) => a + b, 0);
    const equityMultiple = equity > 0 ? totalPos / equity : 0;
    const paybackYears = computePayback(cashFlows, equity);
    const dscrVals = projections.map(p => p.dscr).filter(d => d > 0 && isFinite(d));
    const dscr = dscrVals.length > 0 ? dscrVals.reduce((a, b) => a + b, 0) / dscrVals.length : 0;
    const stabIdx = Math.min(input.stabilizationYear - 1, projections.length - 1);
    const ebitdaMarginStabilized = projections[stabIdx]?.ebitdaMargin ?? 0;
    const exitValue = (projections[projections.length - 1]?.ebitda ?? 0) * scenario.exitMultiple;

    const verdict = computeVerdict(irr, npv, dscr, equityMultiple, paybackYears, wacc, { overallRiskScore: 0, riskRating: 'MODERATE', risks: [], topRisks: [], mitigationImpact: 0 }, {} as any);

    result[key] = {
      label: scenario.label,
      probability: scenario.probability,
      irr: r4(irr), npv: Math.round(npv), equityMultiple: r4(equityMultiple),
      paybackYears, dscr: r4(dscr), ebitdaMarginStabilized: r4(ebitdaMarginStabilized),
      exitValue: Math.round(exitValue), verdict,
    };
  }

  return result as { bear: ScenarioResult; base: ScenarioResult; bull: ScenarioResult };
}

// ═══════════════════════════════════════════════════════════════════════
// CAPITAL STRUCTURE COMPARISON
// ═══════════════════════════════════════════════════════════════════════

function computeCapitalStructures(
  input: DealEvaluationInput, plugin: AssetPlugin, wacc: WACCOutput,
): CapitalStructureOption[] {
  const baseScenario = input.scenarios.base;
  const { revenue, opex, sectorMetrics } = plugin.computeProjections(
    input.sectorInputs, baseScenario, input.projectionYears, input.inflationRate,
  );

  return input.capitalStructureOptions.map(opt => {
    const adjInput = {
      ...input,
      equityPct: opt.equityPct,
      debtPct: opt.debtPct,
      interestRate: opt.interestRate,
      debtTenorYears: opt.tenorYears,
    };
    const projections = buildProjections(adjInput, revenue, opex, sectorMetrics, wacc);
    const cashFlows = buildCashFlows(adjInput, projections);
    const irr = calcIRR(cashFlows);
    const npv = calcNPV(cashFlows, wacc.hurdleRate);
    const equity = input.totalProjectCost * opt.equityPct;
    const totalPos = cashFlows.filter(cf => cf > 0).reduce((a, b) => a + b, 0);
    const equityMultiple = equity > 0 ? totalPos / equity : 0;
    const paybackYears = computePayback(cashFlows, equity);
    const dscrVals = projections.map(p => p.dscr).filter(d => d > 0 && isFinite(d));
    const dscr = dscrVals.length > 0 ? dscrVals.reduce((a, b) => a + b, 0) / dscrVals.length : 0;

    return {
      ...opt,
      irr: r4(irr), npv: Math.round(npv), dscr: r4(dscr),
      equityMultiple: r4(equityMultiple), paybackYears,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RISK MATRIX
// ═══════════════════════════════════════════════════════════════════════

function computeRiskMatrix(risks: DealEvaluationInput['risks']): RiskMatrixOutput {
  const scored: RiskItem[] = risks.map(r => ({
    ...r,
    score: r.likelihood * r.impact,
    residualScore: r.residualLikelihood * r.residualImpact,
  }));

  const totalScore = scored.reduce((sum, r) => sum + r.score, 0);
  const maxPossible = scored.length * 25; // max 5×5
  const overallRiskScore = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;

  let riskRating: RiskMatrixOutput['riskRating'] = 'LOW';
  if (overallRiskScore >= 70) riskRating = 'CRITICAL';
  else if (overallRiskScore >= 50) riskRating = 'HIGH';
  else if (overallRiskScore >= 30) riskRating = 'MODERATE';

  const topRisks = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);

  const totalResidual = scored.reduce((sum, r) => sum + r.residualScore, 0);
  const mitigationImpact = totalScore > 0 ? (totalScore - totalResidual) / totalScore : 0;

  return {
    risks: scored,
    overallRiskScore: r4(overallRiskScore),
    riskRating,
    topRisks,
    mitigationImpact: r4(mitigationImpact),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// LITE ALTERNATIVES
// ═══════════════════════════════════════════════════════════════════════

function computeLiteAlternatives(
  alts: DealEvaluationInput['liteAlternatives'],
  wacc: WACCOutput,
  baseIRR: number,
  baseNPV: number,
): LiteAlternativeResult[] {
  return alts.map(alt => {
    const cfs = [-alt.investmentRequired];
    for (let y = 1; y <= alt.durationYears; y++) {
      cfs.push(alt.annualIncome * Math.pow(1 + alt.growthRate, y - 1));
    }
    const irr = calcIRR(cfs);
    const npv = calcNPV(cfs, wacc.hurdleRate);
    const totalReturn = cfs.filter(cf => cf > 0).reduce((a, b) => a + b, 0);

    let riskRating: LiteAlternativeResult['riskRating'] = 'MODERATE';
    if (alt.investmentRequired < 0.1 * (baseNPV > 0 ? baseNPV : 1e8)) riskRating = 'LOW';
    if (irr < 0.05) riskRating = 'HIGH';

    return {
      description: alt.description,
      irr: r4(irr), npv: Math.round(npv), totalReturn: Math.round(totalReturn),
      riskRating,
      comparisonToBase: {
        irrDelta: r4(irr - baseIRR),
        npvDelta: Math.round(npv - baseNPV),
        riskDelta: irr < baseIRR
          ? `Lower return (${pct(irr)} vs ${pct(baseIRR)}) but potentially lower risk`
          : `Higher return than base case — worth investigating further`,
      },
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// SENSITIVITY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function computeSensitivity(
  input: DealEvaluationInput, plugin: AssetPlugin, wacc: WACCOutput,
): SensitivityMatrix {
  const cfg = input.sensitivityConfig!;
  const cells: SensitivityCell[][] = [];
  let baseRow = 0, baseCol = 0;

  // Find base-case indices
  const baseScenario = input.scenarios.base;

  for (let ri = 0; ri < cfg.rowValues.length; ri++) {
    const row: SensitivityCell[] = [];
    for (let ci = 0; ci < cfg.colValues.length; ci++) {
      // Override sector inputs with sensitivity values
      const overriddenSectorInputs = {
        ...input.sectorInputs,
        [cfg.rowParam]: cfg.rowValues[ri],
        [cfg.colParam]: cfg.colValues[ci],
      };
      const overriddenScenario = {
        ...baseScenario,
        [cfg.rowParam]: cfg.rowValues[ri],
        [cfg.colParam]: cfg.colValues[ci],
      };

      const { revenue, opex, sectorMetrics } = plugin.computeProjections(
        overriddenSectorInputs, overriddenScenario, input.projectionYears, input.inflationRate,
      );
      const projections = buildProjections(input, revenue, opex, sectorMetrics, wacc);
      const cashFlows = buildCashFlows(input, projections);
      const irr = calcIRR(cashFlows);
      const npv = calcNPV(cashFlows, wacc.hurdleRate);
      const verdict = irr >= wacc.hurdleRate && npv > 0 ? 'APPROVE' as const
        : irr >= wacc.wacc ? 'CONDITIONAL' as const
        : irr > 0 ? 'DEFER' as const : 'REJECT' as const;

      row.push({ rowValue: cfg.rowValues[ri], colValue: cfg.colValues[ci], irr: r4(irr), npv: Math.round(npv), verdict });
    }
    cells.push(row);
  }

  // Defaults for axis metadata
  const axes = plugin.getDefaultSensitivityAxes(input.sectorInputs);

  return {
    rowAxis: { parameter: cfg.rowParam, label: axes.rowLabel, values: cfg.rowValues, unit: axes.unit },
    colAxis: { parameter: cfg.colParam, label: axes.colLabel, values: cfg.colValues, unit: axes.unit },
    cells,
    baseCase: { row: baseRow, col: baseCol },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DECISION ENGINE
// ═══════════════════════════════════════════════════════════════════════

function computeVerdict(
  irr: number, npv: number, dscr: number, equityMultiple: number, payback: number,
  wacc: WACCOutput, riskMatrix: RiskMatrixOutput, scenarios: any,
): EvaluationVerdict {
  let score = 0;
  const maxScore = 100;

  // IRR vs hurdle (30 pts)
  if (irr >= wacc.hurdleRate) score += 30;
  else if (irr >= wacc.wacc) score += 15;

  // NPV > 0 (20 pts)
  if (npv > 0) score += 20;
  else if (npv > -npv * 0.1) score += 5; // slightly negative

  // DSCR (15 pts)
  if (dscr >= 1.4) score += 15;
  else if (dscr >= 1.2) score += 10;
  else if (dscr >= 1.0) score += 5;

  // Equity multiple (15 pts)
  if (equityMultiple >= 2.5) score += 15;
  else if (equityMultiple >= 2.0) score += 10;
  else if (equityMultiple >= 1.5) score += 5;

  // Payback (10 pts)
  if (payback <= 5) score += 10;
  else if (payback <= 7) score += 7;
  else if (payback <= 9) score += 3;

  // Risk adjustment (10 pts)
  if (riskMatrix.riskRating === 'LOW') score += 10;
  else if (riskMatrix.riskRating === 'MODERATE') score += 7;
  else if (riskMatrix.riskRating === 'HIGH') score += 3;
  // CRITICAL: 0 pts

  if (score >= 80) return 'APPROVE';
  if (score >= 60) return 'CONDITIONAL';
  if (score >= 40) return 'DEFER';
  return 'REJECT';
}

function computeConfidence(
  irr: number, wacc: WACCOutput, dscr: number,
  riskMatrix: RiskMatrixOutput, scenarios: any,
): number {
  let conf = 50;
  const irrHeadroom = irr - wacc.hurdleRate;
  conf += Math.min(20, Math.max(-20, irrHeadroom * 200));
  if (dscr >= 1.5) conf += 10;
  else if (dscr < 1.2) conf -= 10;
  if (riskMatrix.riskRating === 'LOW') conf += 10;
  else if (riskMatrix.riskRating === 'CRITICAL') conf -= 15;
  return Math.round(Math.min(100, Math.max(0, conf)));
}

function computeDrivers(
  irr: number, npv: number, equityMultiple: number, dscr: number,
  wacc: WACCOutput, riskMatrix: RiskMatrixOutput, scenarios: any,
): string[] {
  const drivers: string[] = [];
  if (irr > wacc.hurdleRate)
    drivers.push(`IRR of ${pct(irr)} exceeds hurdle rate of ${pct(wacc.hurdleRate)} by ${bps(irr - wacc.hurdleRate)} basis points`);
  if (npv > 0)
    drivers.push(`Positive NPV of ${crore(npv)} confirms value creation at the computed discount rate`);
  if (equityMultiple >= 2.0)
    drivers.push(`${equityMultiple.toFixed(2)}x equity multiple indicates strong capital appreciation`);
  if (dscr >= 1.4)
    drivers.push(`DSCR of ${dscr.toFixed(2)}x provides comfortable debt service coverage`);
  if (riskMatrix.mitigationImpact > 0.3)
    drivers.push(`Risk mitigation strategies reduce overall exposure by ${pct(riskMatrix.mitigationImpact)}`);
  return drivers.slice(0, 5);
}

function computeRisks(
  irr: number, npv: number, dscr: number,
  wacc: WACCOutput, riskMatrix: RiskMatrixOutput, scenarios: any, payback: number,
): string[] {
  const risks: string[] = [];
  if (irr < wacc.hurdleRate)
    risks.push(`IRR of ${pct(irr)} falls short of ${pct(wacc.hurdleRate)} hurdle rate — inadequate risk-adjusted return`);
  if (npv < 0)
    risks.push(`Negative NPV of ${crore(npv)} — project destroys value at current discount rate`);
  if (dscr < 1.3)
    risks.push(`DSCR of ${dscr.toFixed(2)}x provides thin debt coverage margin`);
  if (riskMatrix.riskRating === 'HIGH' || riskMatrix.riskRating === 'CRITICAL')
    risks.push(`Overall risk rating is ${riskMatrix.riskRating} — ${riskMatrix.topRisks[0]?.name ?? 'multiple factors'} requires attention`);
  if (payback > 8)
    risks.push(`${payback}-year payback extends capital lockup and cycle exposure`);
  if (scenarios?.bear?.irr !== undefined && scenarios.bear.irr < 0)
    risks.push(`Bear-case IRR is negative (${pct(scenarios.bear.irr)}) — downside scenario results in capital loss`);
  return risks.slice(0, 5);
}

function computeFlips(
  verdict: EvaluationVerdict, irr: number, npv: number, dscr: number,
  wacc: WACCOutput, payback: number,
): string[] {
  if (verdict === 'APPROVE') {
    return [
      `Maintain IRR above ${pct(wacc.hurdleRate)} (currently ${bps(irr - wacc.hurdleRate)}bps cushion)`,
      `Keep DSCR above 1.3x (currently ${dscr.toFixed(2)}x)`,
    ];
  }
  const flips: string[] = [];
  if (irr < wacc.hurdleRate)
    flips.push(`Increase IRR from ${pct(irr)} to above ${pct(wacc.hurdleRate)} (close ${bps(wacc.hurdleRate - irr)}bps gap)`);
  if (npv < 0)
    flips.push(`Turn NPV positive (currently ${crore(npv)}) through revenue uplift or cost reduction`);
  if (dscr < 1.3)
    flips.push(`Improve DSCR from ${dscr.toFixed(2)}x to above 1.3x via revenue growth or debt restructuring`);
  if (payback > 8)
    flips.push(`Reduce payback from ${payback} years to within 8 years through accelerated cash flows`);
  return flips.slice(0, 4);
}

function composeNarrative(
  verdict: EvaluationVerdict, confidence: number,
  irr: number, npv: number, equityMultiple: number,
  wacc: WACCOutput, riskMatrix: RiskMatrixOutput,
  scenarios: any, payback: number,
): string {
  const parts: string[] = [];

  switch (verdict) {
    case 'APPROVE':
      parts.push(`This deal meets all key investment thresholds with ${confidence}% confidence.`);
      break;
    case 'CONDITIONAL':
      parts.push(`This deal shows merit but requires conditions to be met before full commitment.`);
      break;
    case 'DEFER':
      parts.push(`This deal does not currently meet investment criteria and is recommended for deferral pending improvements.`);
      break;
    case 'REJECT':
      parts.push(`This deal fails fundamental investment tests and is not recommended for capital deployment.`);
      break;
  }

  const irrVsHurdle = irr - wacc.hurdleRate;
  if (irrVsHurdle > 0)
    parts.push(`The base-case IRR of ${pct(irr)} exceeds the ${pct(wacc.hurdleRate)} hurdle by ${bps(irrVsHurdle)} basis points, delivering a ${equityMultiple.toFixed(2)}x equity multiple with payback in year ${payback}.`);
  else
    parts.push(`The base-case IRR of ${pct(irr)} falls ${bps(Math.abs(irrVsHurdle))} basis points short of the ${pct(wacc.hurdleRate)} hurdle rate, with a ${equityMultiple.toFixed(2)}x equity multiple and payback in year ${payback}.`);

  if (riskMatrix.riskRating === 'HIGH' || riskMatrix.riskRating === 'CRITICAL')
    parts.push(`Risk profile is elevated (${riskMatrix.riskRating}) — ${riskMatrix.topRisks[0]?.name ?? 'key factors'} warrant close monitoring.`);
  else if (scenarios?.bear?.irr > 0)
    parts.push(`Even in the bear case, the deal returns ${pct(scenarios.bear.irr)} IRR, indicating limited downside.`);

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════
// IC SCORECARD
// ═══════════════════════════════════════════════════════════════════════

function buildICScorecard(
  irr: number, npv: number, equityMultiple: number, dscr: number,
  wacc: WACCOutput, riskMatrix: RiskMatrixOutput,
  scenarios: { bear: ScenarioResult; base: ScenarioResult; bull: ScenarioResult },
  sectorSections: ICSection[],
  verdict: EvaluationVerdict,
): ICScorecard {
  // Financial Returns section
  const finScore = Math.min(10, Math.max(1,
    (irr >= wacc.hurdleRate ? 4 : irr >= wacc.wacc ? 2 : 0)
    + (npv > 0 ? 2 : 0)
    + (equityMultiple >= 2.0 ? 2 : equityMultiple >= 1.5 ? 1 : 0)
    + (dscr >= 1.3 ? 2 : dscr >= 1.0 ? 1 : 0)
  ));

  const finFlags: string[] = [];
  if (irr < wacc.hurdleRate) finFlags.push('IRR below hurdle rate');
  if (npv < 0) finFlags.push('Negative NPV');
  if (dscr < 1.2) finFlags.push('Thin DSCR');

  const financialSection: ICSection = {
    name: 'Financial Returns',
    score: finScore,
    weight: 0.35,
    summary: `IRR ${pct(irr)} | NPV ${crore(npv)} | ${equityMultiple.toFixed(1)}x Multiple | DSCR ${dscr.toFixed(1)}x`,
    flags: finFlags,
  };

  // Risk Profile section
  const riskScore = riskMatrix.riskRating === 'LOW' ? 9
    : riskMatrix.riskRating === 'MODERATE' ? 7
    : riskMatrix.riskRating === 'HIGH' ? 4 : 2;

  const riskSection: ICSection = {
    name: 'Risk Profile',
    score: riskScore,
    weight: 0.25,
    summary: `${riskMatrix.riskRating} overall risk | ${riskMatrix.risks.length} identified risks | ${pct(riskMatrix.mitigationImpact)} mitigation impact`,
    flags: riskMatrix.topRisks.slice(0, 3).map(r => r.name),
  };

  // Scenario Resilience section
  const scenarioScore = Math.min(10, Math.max(1,
    (scenarios.bear.irr > 0 ? 3 : 0)
    + (scenarios.bear.npv > 0 ? 2 : 0)
    + (scenarios.bull.irr > wacc.hurdleRate ? 3 : 1)
    + (scenarios.base.dscr >= 1.3 ? 2 : 0)
  ));

  const scenarioSection: ICSection = {
    name: 'Scenario Resilience',
    score: scenarioScore,
    weight: 0.20,
    summary: `Bear IRR ${pct(scenarios.bear.irr)} | Base IRR ${pct(scenarios.base.irr)} | Bull IRR ${pct(scenarios.bull.irr)}`,
    flags: scenarios.bear.irr < 0 ? ['Bear case results in negative returns'] : [],
  };

  const allSections = [financialSection, riskSection, scenarioSection, ...sectorSections];
  const totalWeight = allSections.reduce((s, sec) => s + sec.weight, 0);
  const overallScore = Math.round(allSections.reduce((s, sec) => s + sec.score * (sec.weight / totalWeight), 0) * 10) / 10;

  const conditions: string[] = [];
  if (verdict === 'CONDITIONAL') {
    if (irr < wacc.hurdleRate) conditions.push('Restructure to achieve hurdle rate returns');
    if (dscr < 1.3) conditions.push('Improve DSCR through revenue enhancement or debt optimization');
    if (riskMatrix.riskRating === 'HIGH') conditions.push('Implement risk mitigation for top-rated risks');
  }

  const nextSteps: string[] = [];
  if (verdict === 'APPROVE') {
    nextSteps.push('Proceed to term sheet negotiation', 'Finalize due diligence', 'Prepare commitment memo');
  } else if (verdict === 'CONDITIONAL') {
    nextSteps.push('Address conditions listed above', 'Re-run evaluation after adjustments', 'Present to IC with conditions');
  } else {
    nextSteps.push('Communicate decision to sponsor', 'Document findings for future reference');
  }

  return { overallScore, sections: allSections, recommendation: verdict, conditions, nextSteps };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function r4(n: number): number { return Math.round(n * 10000) / 10000; }
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function bps(v: number): number { return Math.round(v * 10000); }
function crore(v: number): string {
  const cr = v / 1e7;
  return cr >= 0 ? `₹${cr.toFixed(1)} Cr` : `(₹${Math.abs(cr).toFixed(1)} Cr)`;
}
