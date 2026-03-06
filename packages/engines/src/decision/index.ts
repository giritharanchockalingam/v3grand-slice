// ─── Decision Engine: Gate-Based Recommendation ────────────────────
// Pure function: (DecisionInput) => DecisionOutput
// Takes Underwriter, Factor, MC, and Budget outputs; evaluates investment
// gates; returns verdict with confidence, risk flags, and investor-grade narrative.

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
    const budgetVariancePct = Math.abs(budgetResult.varianceToCurrent);
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
  const irrHeadroom = pf.irr - fin.wacc;
  const headroomBonus = Math.min(20, Math.max(-20, irrHeadroom * 100));

  let mcBonus = 0;
  if (mcResult) {
    const irrIQR = mcResult.irrDistribution.p75 - mcResult.irrDistribution.p25;
    mcBonus = Math.max(-10, 5 - irrIQR * 50);
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

  // ── Top Drivers (3 strongest factors supporting the verdict) ──
  const topDrivers = computeTopDrivers(gates, pf, fin, factorResult, mcResult);

  // ── Top Risks (3 most critical concerns) ──
  const topRisks = computeTopRisks(gates, pf, fin, riskFlags, mcResult, budgetResult);

  // ── Flip Conditions (what must change to flip the verdict) ──
  const flipConditions = computeFlipConditions(verdict, gates, pf, fin, mcResult, passRate);

  // ── Basic Explanation (gate summary) ──
  const failedGates = gates.filter(g => !g.passed).map(g => g.name);
  const explanation = failedGates.length === 0
    ? `All ${gates.length} investment gates pass. Base-case IRR of ${pct(pf.irr)} exceeds WACC+200bps.` +
      (mcResult ? ` Monte Carlo P50 IRR: ${pct(mcResult.irrDistribution.p50)}.` : '') +
      (factorResult ? ` Factor composite: ${factorResult.compositeScore.toFixed(1)}/5.0.` : '') +
      ' Recommend proceeding.'
    : `${passCount}/${gates.length} gates pass. Failed: ${failedGates.join('; ')}. ` +
      `Base IRR ${pct(pf.irr)} vs WACC ${pct(fin.wacc)}. ` +
      (mcResult ? `P(NPV<0) = ${pct(mcResult.probNpvNegative)}. ` : '') +
      `Verdict: ${verdict} at ${confidence} confidence.`;

  // ── Investor-Grade Narrative (2-3 sentence summary for non-technical audience) ──
  const narrative = composeNarrative(verdict, confidence, pf, fin, gates, mcResult, factorResult, budgetResult, riskFlags, isFlip, prevVerdict);

  return { verdict, confidence, gateResults: gates, explanation, isFlip, riskFlags, topDrivers, topRisks, flipConditions, narrative };
}

// ─── Helper: Build gate check ──
function gate(name: string, actual: number, threshold: number, passed: boolean): GateCheck {
  return { name, actual: Math.round(actual * 10000) / 10000, threshold, passed };
}

// ─── Helper: Format percentage ──
function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── Helper: Format currency in Cr ──
function crore(v: number): string {
  return `₹${(v / 10_000_000).toFixed(1)} Cr`;
}

// ─── Compute Top 3 Drivers ──
function computeTopDrivers(
  gates: GateCheck[],
  pf: DecisionInput['proformaResult'],
  fin: DecisionInput['deal']['financialAssumptions'],
  factorResult: DecisionInput['factorResult'],
  mcResult: DecisionInput['mcResult'],
): string[] {
  const drivers: { text: string; strength: number }[] = [];

  // Passed gates with quantified headroom
  const passedGates = gates.filter(g => g.passed);

  for (const g of passedGates) {
    let headroom = 0;
    if (g.threshold !== 0) {
      headroom = g.name.includes('<=') || g.name.includes('< ')
        ? (g.threshold - g.actual) / g.threshold  // lower-is-better gates
        : (g.actual - g.threshold) / g.threshold; // higher-is-better gates
    }
    drivers.push({ text: formatDriverText(g), strength: Math.abs(headroom) });
  }

  // IRR headroom as a standalone driver
  const irrHeadroom = pf.irr - fin.wacc;
  if (irrHeadroom > 0.02) {
    drivers.push({
      text: `IRR of ${pct(pf.irr)} provides ${((irrHeadroom) * 100).toFixed(0)}bps cushion above WACC`,
      strength: irrHeadroom * 5,
    });
  }

  // Factor score as driver
  if (factorResult && factorResult.compositeScore >= 3.5) {
    drivers.push({
      text: `Strong factor score of ${factorResult.compositeScore.toFixed(1)}/5.0 reflects favorable market and asset conditions`,
      strength: (factorResult.compositeScore - 3.0) / 2.0,
    });
  }

  // MC confidence as driver
  if (mcResult && mcResult.probNpvNegative < 0.10) {
    drivers.push({
      text: `Monte Carlo shows only ${pct(mcResult.probNpvNegative)} probability of negative NPV across 5,000 simulations`,
      strength: (0.20 - mcResult.probNpvNegative) * 5,
    });
  }

  // Sort by strength and take top 3
  drivers.sort((a, b) => b.strength - a.strength);
  return drivers.slice(0, 3).map(d => d.text);
}

function formatDriverText(g: GateCheck): string {
  if (g.name.includes('IRR > WACC'))     return `Base IRR of ${pct(g.actual)} clears WACC+200bps hurdle (${pct(g.threshold)})`;
  if (g.name.includes('NPV'))            return `Positive NPV of ${crore(g.actual)} confirms value creation`;
  if (g.name.includes('Equity Multiple'))return `${g.actual.toFixed(2)}x equity multiple exceeds ${g.threshold}x minimum`;
  if (g.name.includes('DSCR'))           return `Average DSCR of ${g.actual.toFixed(2)}x provides adequate debt coverage`;
  if (g.name.includes('Target IRR'))     return `IRR of ${pct(g.actual)} beats target return of ${pct(g.threshold)}`;
  if (g.name.includes('Payback'))        return `Capital recovery in year ${g.actual} within the ${g.threshold}-year threshold`;
  if (g.name.includes('P(NPV'))          return `Low downside risk: only ${pct(g.actual)} chance of capital loss`;
  if (g.name.includes('MC P10'))         return `Even in the worst 10% of scenarios, IRR is ${pct(g.actual)}`;
  if (g.name.includes('Factor'))         return `Factor composite score of ${g.actual.toFixed(1)} reflects strong fundamentals`;
  if (g.name.includes('Budget'))         return `Construction budget variance at ${pct(g.actual)}, well within tolerance`;
  return `${g.name}: actual ${g.actual.toFixed(2)} vs threshold ${g.threshold.toFixed(2)}`;
}

// ─── Compute Top 3 Risks ──
function computeTopRisks(
  gates: GateCheck[],
  pf: DecisionInput['proformaResult'],
  fin: DecisionInput['deal']['financialAssumptions'],
  riskFlags: string[],
  mcResult: DecisionInput['mcResult'],
  budgetResult: DecisionInput['budgetResult'],
): string[] {
  const risks: { text: string; severity: number }[] = [];

  // Failed gates as risks
  const failedGates = gates.filter(g => !g.passed);
  for (const g of failedGates) {
    let shortfall = 0;
    if (g.threshold !== 0) {
      shortfall = g.name.includes('<=') || g.name.includes('< ')
        ? (g.actual - g.threshold) / g.threshold
        : (g.threshold - g.actual) / g.threshold;
    }
    risks.push({ text: formatRiskText(g), severity: Math.abs(shortfall) });
  }

  // DSCR tightness (even if passing)
  if (pf.avgDSCR < 1.4 && pf.avgDSCR >= 1.3) {
    risks.push({
      text: `DSCR of ${pf.avgDSCR.toFixed(2)}x is passing but thin — limited buffer against revenue shortfall`,
      severity: 0.3,
    });
  }

  // MC tail risk
  if (mcResult && mcResult.probIrrBelowWacc > 0.15) {
    risks.push({
      text: `${pct(mcResult.probIrrBelowWacc)} probability that returns fall below cost of capital in Monte Carlo simulation`,
      severity: mcResult.probIrrBelowWacc,
    });
  }

  // MC spread risk
  if (mcResult) {
    const spread = mcResult.irrDistribution.p90 - mcResult.irrDistribution.p10;
    if (spread > 0.15) {
      risks.push({
        text: `Wide return uncertainty: P10-P90 IRR range of ${((spread) * 100).toFixed(0)}bps indicates high sensitivity to assumptions`,
        severity: spread,
      });
    }
  }

  // Budget overrun risk
  if (budgetResult && budgetResult.overallStatus !== 'GREEN') {
    const varPct = Math.abs(budgetResult.varianceToCurrent);
    risks.push({
      text: `Construction budget ${budgetResult.overallStatus === 'RED' ? 'significantly' : 'moderately'} over — ${pct(varPct)} variance threatens returns`,
      severity: budgetResult.overallStatus === 'RED' ? 0.9 : 0.5,
    });
  }

  // Payback duration
  if (pf.paybackYear > 7) {
    risks.push({
      text: `Extended capital lockup of ${pf.paybackYear} years increases exposure to market cycle risk`,
      severity: (pf.paybackYear - 6) * 0.2,
    });
  }

  // Sort by severity and take top 3
  risks.sort((a, b) => b.severity - a.severity);
  return risks.slice(0, 3).map(r => r.text);
}

function formatRiskText(g: GateCheck): string {
  if (g.name.includes('IRR > WACC'))     return `IRR of ${pct(g.actual)} falls short of WACC+200bps hurdle (${pct(g.threshold)}) — inadequate risk-adjusted return`;
  if (g.name.includes('NPV'))            return `Negative NPV of ${crore(g.actual)} — project destroys value at current assumptions`;
  if (g.name.includes('Equity Multiple'))return `Equity multiple of ${g.actual.toFixed(2)}x below ${g.threshold}x minimum — insufficient capital appreciation`;
  if (g.name.includes('DSCR'))           return `DSCR of ${g.actual.toFixed(2)}x below ${g.threshold}x — debt service coverage is insufficient`;
  if (g.name.includes('Target IRR'))     return `IRR of ${pct(g.actual)} misses the ${pct(g.threshold)} target return — doesn't meet fund mandate`;
  if (g.name.includes('Payback'))        return `Payback in year ${g.actual} exceeds ${g.threshold}-year limit — capital tied up too long`;
  if (g.name.includes('P(NPV'))          return `${pct(g.actual)} probability of capital loss exceeds ${pct(g.threshold)} comfort level`;
  if (g.name.includes('MC P10'))         return `Tail risk concern: P10 IRR of ${pct(g.actual)} is below ${pct(g.threshold)} minimum`;
  if (g.name.includes('Factor'))         return `Factor score of ${g.actual.toFixed(1)} signals weak market or asset conditions`;
  if (g.name.includes('Budget'))         return `Budget variance of ${pct(g.actual)} exceeds ${pct(g.threshold)} tolerance — cost overrun risk`;
  return `${g.name} failed: actual ${g.actual.toFixed(2)} vs required ${g.threshold.toFixed(2)}`;
}

// ─── Compute Flip Conditions ──
function computeFlipConditions(
  verdict: RecommendationVerdict,
  gates: GateCheck[],
  pf: DecisionInput['proformaResult'],
  fin: DecisionInput['deal']['financialAssumptions'],
  mcResult: DecisionInput['mcResult'],
  passRate: number,
): string[] {
  const conditions: string[] = [];

  if (verdict === 'INVEST') {
    // Already best verdict — show what could degrade it
    conditions.push(`Maintain IRR above ${pct(fin.wacc + 0.02)} (currently ${pct(pf.irr)} with ${((pf.irr - fin.wacc - 0.02) * 100).toFixed(0)}bps cushion)`);
    if (mcResult) {
      conditions.push(`Keep P(NPV<0) below 20% (currently ${pct(mcResult.probNpvNegative)})`);
    }
    conditions.push(`Verdict is secure while ≥${Math.ceil(gates.length * 0.85)} of ${gates.length} gates pass (currently ${gates.filter(g => g.passed).length})`);
  } else {
    // Show what must improve to reach the next better verdict
    const failedGates = gates.filter(g => !g.passed);
    const nextTarget = getNextBetterVerdict(verdict);
    const nextThreshold = getPassRateForVerdict(nextTarget);
    const gatesNeeded = Math.ceil(gates.length * nextThreshold) - gates.filter(g => g.passed).length;

    if (gatesNeeded > 0) {
      conditions.push(`Need ${gatesNeeded} more gate${gatesNeeded > 1 ? 's' : ''} to pass for ${nextTarget} (requires ${Math.ceil(nextThreshold * 100)}% pass rate)`);
    }

    // Specific actionable improvements
    for (const g of failedGates.slice(0, 3)) {
      conditions.push(formatFlipAction(g, pf, fin));
    }
  }

  return conditions.slice(0, 4);
}

function getNextBetterVerdict(v: RecommendationVerdict): RecommendationVerdict {
  switch (v) {
    case 'DO-NOT-PROCEED': return 'EXIT';
    case 'EXIT': return 'DE-RISK';
    case 'DE-RISK': return 'HOLD';
    case 'HOLD': return 'INVEST';
    default: return 'INVEST';
  }
}

function getPassRateForVerdict(v: RecommendationVerdict): number {
  switch (v) {
    case 'INVEST': return 0.85;
    case 'HOLD': return 0.70;
    case 'DE-RISK': return 0.50;
    case 'EXIT': return 0.30;
    default: return 0;
  }
}

function formatFlipAction(g: GateCheck, pf: any, fin: any): string {
  if (g.name.includes('IRR > WACC'))     return `Increase IRR from ${pct(g.actual)} to above ${pct(g.threshold)} (close ${((g.threshold - g.actual) * 100).toFixed(0)}bps gap)`;
  if (g.name.includes('NPV'))            return `Turn NPV positive (currently ${crore(g.actual)}) through revenue uplift or cost reduction`;
  if (g.name.includes('Equity Multiple'))return `Raise equity multiple from ${g.actual.toFixed(2)}x to above ${g.threshold}x`;
  if (g.name.includes('DSCR'))           return `Improve DSCR from ${g.actual.toFixed(2)}x to above ${g.threshold}x via revenue growth or debt restructuring`;
  if (g.name.includes('Target IRR'))     return `Close the ${((g.threshold - g.actual) * 100).toFixed(0)}bps gap between IRR (${pct(g.actual)}) and target (${pct(g.threshold)})`;
  if (g.name.includes('Payback'))        return `Reduce payback from year ${g.actual} to within ${g.threshold} years through accelerated cash flows`;
  if (g.name.includes('P(NPV'))          return `Reduce downside risk: lower P(NPV<0) from ${pct(g.actual)} to below ${pct(g.threshold)}`;
  if (g.name.includes('MC P10'))         return `Improve tail-risk IRR from ${pct(g.actual)} to above ${pct(g.threshold)}`;
  if (g.name.includes('Factor'))         return `Address weak market/asset factors to raise composite score above ${g.threshold.toFixed(1)}`;
  if (g.name.includes('Budget'))         return `Contain construction costs to bring variance below ${pct(g.threshold)}`;
  return `Improve ${g.name} from ${g.actual.toFixed(2)} to meet threshold of ${g.threshold.toFixed(2)}`;
}

// ─── Compose CFO-Grade Narrative ──────────────────────────────────
function composeNarrative(
  verdict: RecommendationVerdict,
  confidence: number,
  pf: DecisionInput['proformaResult'],
  fin: DecisionInput['deal']['financialAssumptions'],
  gates: GateCheck[],
  mcResult: DecisionInput['mcResult'],
  factorResult: DecisionInput['factorResult'],
  budgetResult: DecisionInput['budgetResult'],
  riskFlags: string[],
  isFlip: boolean,
  prevVerdict: RecommendationVerdict | null,
): string {
  const passCount = gates.filter(g => g.passed).length;
  const totalGates = gates.length;
  const failedGates = gates.filter(g => !g.passed);
  const parts: string[] = [];

  // Opening: verdict context with gate specificity
  if (isFlip && prevVerdict) {
    parts.push(`This deal has migrated from ${prevVerdict} to ${verdict} — a material shift driven by changes in the underlying return and risk metrics.`);
  } else {
    switch (verdict) {
      case 'INVEST':
        parts.push(`This deal clears ${passCount} of ${totalGates} investment gates at ${confidence}% confidence, supporting capital deployment.`);
        break;
      case 'HOLD':
        parts.push(`${totalGates - passCount} of ${totalGates} investment gate${totalGates - passCount > 1 ? 's' : ''} remain unmet${failedGates.length > 0 ? ` (${failedGates.slice(0, 2).map(g => g.name).join(', ')})` : ''}, warranting continued monitoring before capital commitment.`);
        break;
      case 'DE-RISK':
        parts.push(`The deal passes only ${passCount} of ${totalGates} gates, with failures in ${failedGates.slice(0, 3).map(g => g.name).join(', ')}. Structural improvements are required before this is investable.`);
        break;
      case 'EXIT':
        parts.push(`Investment gates fail at ${passCount}/${totalGates} passing, indicating material downside risk that is not compensated by the return profile.`);
        break;
      case 'DO-NOT-PROCEED':
        parts.push(`Fundamental criteria unmet at ${passCount}/${totalGates} gates. Capital deployment is not supportable at current terms and structure.`);
        break;
    }
  }

  // Return profile with spread analysis
  const irrVsWacc = pf.irr - fin.wacc;
  const irrVsTarget = pf.irr - fin.targetIRR;
  const bpsOverWacc = Math.round(irrVsWacc * 10000);
  const bpsOverTarget = Math.round(irrVsTarget * 10000);

  if (irrVsWacc > 0) {
    parts.push(`Base-case IRR of ${pct(pf.irr)} clears the ${pct(fin.wacc)} WACC by ${bpsOverWacc}bps — ${pf.equityMultiple.toFixed(2)}x equity multiple, payback year ${pf.paybackYear}, DSCR ${pf.avgDSCR.toFixed(2)}x.`);
  } else {
    parts.push(`Base-case IRR of ${pct(pf.irr)} falls ${Math.abs(bpsOverWacc)}bps short of WACC (${pct(fin.wacc)}) — value destruction on a risk-adjusted basis. EM ${pf.equityMultiple.toFixed(2)}x, payback year ${pf.paybackYear}, DSCR ${pf.avgDSCR.toFixed(2)}x.`);
  }

  // Target IRR context (only if different from WACC)
  if (Math.abs(fin.targetIRR - fin.wacc) > 0.005) {
    if (irrVsTarget >= 0) {
      parts.push(`Exceeds target IRR of ${pct(fin.targetIRR)} by ${bpsOverTarget}bps.`);
    } else {
      parts.push(`Falls ${Math.abs(bpsOverTarget)}bps below the ${pct(fin.targetIRR)} target IRR.`);
    }
  }

  // DSCR covenant analysis
  if (pf.avgDSCR < 1.3) {
    parts.push(`DSCR of ${pf.avgDSCR.toFixed(2)}x is below the 1.30x covenant floor — debt serviceability is at risk under stress.`);
  }

  // Monte Carlo: probabilistic context with distribution
  if (mcResult) {
    const pNeg = mcResult.probNpvNegative;
    const p10 = mcResult.irrDistribution?.p10;
    const p50 = mcResult.irrDistribution?.p50;

    if (pNeg < 0.10) {
      parts.push(`Monte Carlo: ${pct(pNeg)} probability of capital loss across 5,000 scenarios — downside well-contained.`);
    } else if (pNeg < 0.25) {
      parts.push(`Monte Carlo flags moderate tail risk: ${pct(pNeg)} probability of negative NPV.`);
    } else {
      parts.push(`Monte Carlo reveals significant downside: ${pct(pNeg)} probability of capital loss — this is a primary factor in the conservative positioning.`);
    }

    if (typeof p10 === 'number' && typeof p50 === 'number') {
      parts.push(`IRR P10/P50: ${pct(p10)}/${pct(p50)}.`);
    }
  } else if (riskFlags.length > 0) {
    parts.push(`Key risk factors: ${riskFlags.slice(0, 3).join(', ').toLowerCase()}.`);
  }

  // Factor score
  if (factorResult && typeof factorResult.compositeScore === 'number') {
    const score = factorResult.compositeScore;
    if (score < 3.0) {
      parts.push(`Market factor score of ${score.toFixed(1)}/5.0 is below institutional grade, indicating structural headwinds.`);
    }
  }

  // Budget execution risk
  if (budgetResult) {
    if (budgetResult.overallStatus === 'RED') {
      parts.push(`Construction budget is in RED — cost overruns are actively compressing the return profile.`);
    } else if (budgetResult.overallStatus === 'AMBER') {
      parts.push(`Budget at AMBER status — monitoring for potential return compression.`);
    }
  }

  return parts.join(' ');
}

export { evaluate as evaluateDecision };
