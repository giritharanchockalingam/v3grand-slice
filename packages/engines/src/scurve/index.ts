// ─── S-Curve Engine: CAPEX Cash-Flow Distribution ──────────────────
// Pure function: (SCurveInput) => SCurveOutput
// Distributes CAPEX line items across months using various curve shapes.
// Supports: linear, s-curve (logistic), front-loaded (Beta 2,5), back-loaded (Beta 5,2).

import type { SCurveInput, SCurveOutput } from '@v3grand/core';

export function distribute(input: SCurveInput): SCurveOutput {
  const { items, totalMonths } = input;
  const monthly = new Array(totalMonths).fill(0);

  for (const item of items) {
    const span = item.endMonth - item.startMonth;
    if (span <= 0) continue;

    // Generate raw weights for each month in the item's span
    const weights: number[] = [];
    let totalWeight = 0;

    for (let m = item.startMonth; m < item.endMonth && m < totalMonths; m++) {
      const t = (m - item.startMonth) / span; // 0..1 progress
      let weight: number;

      switch (item.curveType) {
        case 's-curve':
          weight = sCurveWeight(t, span);
          break;
        case 'linear':
          weight = 1 / span;
          break;
        case 'front-loaded':
          weight = betaPdfWeight(t, 2, 5, span);
          break;
        case 'back-loaded':
          weight = betaPdfWeight(t, 5, 2, span);
          break;
        default:
          weight = 1 / span;
      }

      weights.push(weight);
      totalWeight += weight;
    }

    // Normalize weights so they sum to 1, then distribute amount
    if (totalWeight > 0) {
      let monthIdx = 0;
      for (let m = item.startMonth; m < item.endMonth && m < totalMonths; m++) {
        monthly[m] += item.amount * (weights[monthIdx] / totalWeight);
        monthIdx++;
      }
    }
  }

  // Build cumulative
  const cumulative: number[] = [];
  let runningTotal = 0;
  for (let m = 0; m < totalMonths; m++) {
    runningTotal += monthly[m];
    cumulative.push(runningTotal);
  }

  const totalAmount = monthly.reduce((a, b) => a + b, 0);

  return {
    monthlyCashflows: monthly.map(v => Math.round(v)),
    cumulativeCashflows: cumulative.map(v => Math.round(v)),
    totalAmount: Math.round(totalAmount),
  };
}

/**
 * S-curve (logistic) weight.
 * Uses the derivative of the logistic function: f(t) = 1/(1 + exp(-k*(t-0.5)))
 * The derivative f'(t) gives the bell-shaped spending intensity.
 * k controls steepness; k=12 gives a good S-curve shape.
 */
function sCurveWeight(t: number, span: number): number {
  const k = 12;
  const midpoint = 0.5;
  const expTerm = Math.exp(-k * (t - midpoint));
  // Derivative of logistic: k * exp(-k(t-0.5)) / (1 + exp(-k(t-0.5)))^2
  return (k * expTerm) / Math.pow(1 + expTerm, 2);
}

/**
 * Beta distribution PDF weight for front-loaded and back-loaded curves.
 * Uses the Beta PDF: f(t; a, b) = t^(a-1) * (1-t)^(b-1) / B(a,b)
 * We don't need the exact normalizing constant since we normalize ourselves.
 */
function betaPdfWeight(t: number, a: number, b: number, span: number): number {
  // Avoid edge cases at t=0 and t=1
  const tClamped = Math.max(0.001, Math.min(0.999, t));
  return Math.pow(tClamped, a - 1) * Math.pow(1 - tClamped, b - 1);
}
