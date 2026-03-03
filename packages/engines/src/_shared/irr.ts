// ─── Newton-Raphson IRR Solver ─────────────────────────────────────
// cashFlows[0] is typically negative (equity outlay).
// Returns annualized IRR as a decimal (e.g. 0.157 = 15.7%).

export function calcIRR(cashFlows: number[], guess = 0.10, maxIter = 200, tol = 1e-7): number {
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

    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
  }

  return Number.isFinite(rate) ? rate : NaN;
}

export function calcNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}
