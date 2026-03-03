// ─── Decision Engine: Gate-Based Recommendation ────────────────────
// Pure function: (DecisionInput) => DecisionOutput
// Takes Underwriter, Factor, MC, and Budget outputs; evaluates investment
// gates; returns verdict with confidence and risk flags.

import type {
  DecisionInput, DecisionOutput, GateCheck, RecommendationVerdict,
} from '@v3grand/core';

export function evaluate(input: DecisionInput): DecisionOutput {
  const { deal, proformaResult, factorResult, mcResult, budgetResult, currentRecommendation } = input;
  const fin = deal.financialAssumptions;
  const pf = proformaResult;

  // ── Gate checks ──
  const gates: GateCheck[] = [
    gate('IRR > WACC + 200bps',       pf.irr,            fin.wacc + 0.02,  pf.irr > fin.wacc + 0.02),
    gate('NPV > 0',                   pf.npv,            0,                pf.npv > 0),
    gate('Equity Multiple > 1.8x',    pf.equityMultiple, 1.8,              pf.equityMultiple > 1.8),
    gate('Avg DSCR > 1.3x',           pf.avgDSCR,        1.3,              pf.avgDSCR > 1.3),
    gate('IRR > Target IRR',          pf.irr,            fin.targetIRR,    pf.irr > fin.targetIRR),
    gate('Payback <= 8 years',        pf.paybackYear,    8,                pf.paybackYear <= 8),
  ];

  // Add MC gates if Monte Carlo results available
  if (mcResult) {
    gates.push(
      gate('P(NPV < 0) < 20%',       mcResult.probNpvNegative,  0.20,  mcResult.probNpvNegative < 0.20),
      gate('MC P10 IRR > 5%',         mcResult.irrDistribution.p10, 0.05, mcResult.irrDistribution.p10 > 0.05),
    );
  }

  // Add Factor gate if Factor score available
  if (factorResult) {
    gates.push(
      gate('Factor Score > 3.0',      factorResult.compositeScore, 3.0,  factorResult.compositeScore > 3.0),
    );
  }

  // Add Budget gate if in construction and budget data available
  if (budgetResult) {
    const budgetVariancePct = Math.abs(budgetResult.variancePct);
    gates.push(
      gate('Budget Variance < 10%',   budgetVariancePct, 0.10, budgetVariancePct < 0.10),
    );
  }

  // ── Verdict from pass rate ──
  const passCount = gates.filter(g => g.passed).length;
  const passRate = passCount / gates.length;

  let verdict: RecommendationVerdict;
  if (passRate >= 0.85)      verdict = 'INVEST';
  else if (passRate >= 0.70) verdict = 'HOLD';
  else if (passRate >= 0.50) verdict = 'DE-RISK';
  else if (passRate >= 0.30) verdict = 'EXIT';
  else                       verdict = 'DO-NOT-PROCEED';

  // ── Confidence (0-100) ──
  // Base: passRate * 80. Boost/penalize based on IRR headroom and MC spread.
  const irrHeadroom = pf.irr - fin.wacc;
  const headroomBonus = Math.min(20, Math.max(-20, irrHeadroom * 100));

  // MC spread adjustment: tighter distributions increase confidence
  let mcBonus = 0;
  if (mcResult) {
    const irrIQR = mcResult.irrDistribution.p75 - mcResult.irrDistribution.p25;
    mcBonus = Math.max(-10, 5 - irrIQR * 50); // Tight spread → positive bonus
  }

  const confidence = Math.round(Math.min(100, Math.max(0, passRate * 80 + headroomBonus + mcBonus)));

  // ── Flip detection ──
  const prevVerdict = currentRecommendation?.verdict ?? null;
  const isFlip = prevVerdict !== null && verdict !== prevVerdict;

  // ── Risk flags ──
  const riskFlags: string[] = [];
  if (pf.avgDSCR < 1.2) riskFlags.push('DSCR below comfort zone');
  if (pf.irr < fin.wacc) riskFlags.push('IRR below WACC');
  if (pf.paybackYear > 8) riskFlags.push('Long payback period');
  if (mcResult && mcResult.probNpvNegative > 0.15) riskFlags.push('High probability of negative NPV');
  if (mcResult && mcResult.probIrrBelowWacc > 0.25) riskFlags.push('High probability of IRR below WACC');
  if (factorResult && factorResult.compositeScore < 3.0) riskFlags.push('Low factor composite score');
  if (budgetResult && budgetResult.overallStatus === 'RED') riskFlags.push('Budget variance in RED zone');
  if (budgetResult && budgetResult.alerts.some(a => a.includes('BUDGET OVERRUN'))) riskFlags.push('Total budget overrun detected');

  // ── Explanation ──
  const failedGates = gates.filter(g => !g.passed).map(g => g.name);
  const explanation = failedGates.length === 0
    ? `All ${gates.length} investment gates pass. Base-case IRR of ${(pf.irr * 100).toFixed(1)}% exceeds WACC+200bps.` +
      (mcResult ? ` Monte Carlo P50 IRR: ${(mcResult.irrDistribution.p50 * 100).toFixed(1)}%.` : '') +
      (factorResult ? ` Factor composite: ${factorResult.compositeScore.toFixed(1)}/5.0.` : '') +
      ' Recommend proceeding.'
    : `${passCount}/${gates.length} gates pass. Failed: ${failedGates.join('; ')}. ` +
      `Base IRR ${(pf.irr * 100).toFixed(1)}% vs WACC ${(fin.wacc * 100).toFixed(1)}%. ` +
      (mcResult ? `P(NPV<0) = ${(mcResult.probNpvNegative * 100).toFixed(1)}%. ` : '') +
      `Verdict: ${verdict} at ${confidence} confidence.`;

  return { verdict, confidence, gateResults: gates, explanation, isFlip, riskFlags };
}

function gate(name: string, actual: number, threshold: number, passed: boolean): GateCheck {
  return { name, actual: Math.round(actual * 10000) / 10000, threshold, passed };
}
