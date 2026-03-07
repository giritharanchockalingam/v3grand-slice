// ─── Newton-Raphson IRR Solver ─────────────────────────────────────
// cashFlows[0] is typically negative (equity outlay).
// Returns annualized IRR as a decimal (e.g. 0.157 = 15.7%).

export function calcIRR(cashFlows: number[], guess = 0.10, maxIter = 200, tol = 1e-7): number {
  // Guard: if no sign change in cash flows, IRR is undefined
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  if (!hasPositive || !hasNegative) return NaN;

  let rate = guess;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dNpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(dNpv) < 1e-12) break; // avoid divide-by-zero
    const newRate = rate - npv / dNpv;

    // Clamp rate to prevent divergence (IRR outside [-0.99, 2.0] is unrealistic)
    const clampedRate = Math.max(-0.99, Math.min(2.0, newRate));
    if (Math.abs(clampedRate - rate) < tol) {
      rate = clampedRate;
      break; // converged — fall through to verification
    }
    rate = clampedRate;
  }

  // Verify convergence: if the NPV at the found rate is not close to zero, solver failed
  if (!Number.isFinite(rate)) return NaN;
  const verifyNpv = calcNPV(cashFlows, rate);
  if (Math.abs(verifyNpv) > Math.abs(cashFlows[0]) * 0.01) return NaN;
  return rate;
}

export function calcNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}
