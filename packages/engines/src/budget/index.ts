// ─── Budget Variance Engine: Construction Cost Analysis ────────────
// Pure function: (BudgetAnalysisInput) => BudgetAnalysisOutput
// Aggregates budget lines, computes variances, and generates alerts.

import type {
  BudgetAnalysisInput, BudgetAnalysisOutput, BudgetLineVariance,
} from '@v3grand/core';

export function analyzeBudget(input: BudgetAnalysisInput): BudgetAnalysisOutput {
  const { budgetLines, changeOrders, rfis, milestones } = input;

  // ── Aggregate per-line variances ──
  const lineVariances: BudgetLineVariance[] = budgetLines.map(line => {
    const originalBudget = Number(line.originalAmount);
    const approvedCOs = Number(line.approvedCOs);
    const currentBudget = Number(line.currentBudget);
    const actualSpend = Number(line.actualSpend);
    const commitments = Number(line.commitments);

    // Forecast = actuals + remaining commitments + estimated remaining
    const forecast = Math.max(actualSpend, commitments);
    const variance = forecast - currentBudget;
    const variancePct = currentBudget > 0 ? variance / currentBudget : 0;

    let status: 'GREEN' | 'AMBER' | 'RED';
    const absVariancePct = Math.abs(variancePct);
    if (absVariancePct > 0.20) status = 'RED';
    else if (absVariancePct > 0.10) status = 'AMBER';
    else status = 'GREEN';

    return {
      costCode: line.costCode,
      description: line.description,
      category: line.category,
      originalBudget,
      approvedCOs,
      currentBudget,
      actualSpend,
      commitments,
      forecast,
      variance: Math.round(variance),
      variancePct: round4(variancePct),
      status,
    };
  });

  // ── Totals ──
  const totalBudget = lineVariances.reduce((s, l) => s + l.currentBudget, 0);
  const totalSpent = lineVariances.reduce((s, l) => s + l.actualSpend, 0);
  const totalCommitted = lineVariances.reduce((s, l) => s + l.commitments, 0);
  const totalForecast = lineVariances.reduce((s, l) => s + l.forecast, 0);
  const varianceToOriginal = totalForecast - totalBudget;
  const variancePct = totalBudget > 0 ? varianceToOriginal / totalBudget : 0;

  // ── Alerts ──
  const alerts: string[] = [];

  // Line-level alerts
  for (const line of lineVariances) {
    if (line.status === 'RED') {
      alerts.push(`RED: ${line.costCode} (${line.description}) variance of ${(line.variancePct * 100).toFixed(1)}% exceeds 20% threshold`);
    } else if (line.status === 'AMBER') {
      alerts.push(`AMBER: ${line.costCode} (${line.description}) variance of ${(line.variancePct * 100).toFixed(1)}% exceeds 10% threshold`);
    }
  }

  // Portfolio-level alerts
  if (totalForecast > totalBudget * 1.05) {
    alerts.push(`BUDGET OVERRUN: Total forecast (${formatCr(totalForecast)}) exceeds budget by more than 5%`);
  }
  if (totalCommitted > totalBudget * 0.95 && totalSpent < totalCommitted * 0.50) {
    alerts.push(`CASH FLOW RISK: High commitments (${(totalCommitted / totalBudget * 100).toFixed(0)}% committed) but low spend (${(totalSpent / totalCommitted * 100).toFixed(0)}% of committed)`);
  }

  // Pending change orders (draft or submitted, not yet approved)
  const pendingCOs = changeOrders.filter(co => co.status === 'draft' || co.status === 'submitted');
  if (pendingCOs.length > 0) {
    const pendingAmount = pendingCOs.reduce((s, co) => s + Number(co.amount), 0);
    alerts.push(`${pendingCOs.length} pending change order(s) totaling ${formatCr(pendingAmount)}`);
  }

  // Open RFIs
  const openRFIs = rfis.filter(r => r.status === 'open');
  if (openRFIs.length > 3) {
    alerts.push(`${openRFIs.length} open RFIs — may indicate design coordination issues`);
  }

  // Delayed milestones
  const delayedMilestones = milestones.filter(m =>
    m.status !== 'completed' && m.targetDate && new Date(m.targetDate) < new Date()
  );
  if (delayedMilestones.length > 0) {
    alerts.push(`${delayedMilestones.length} milestone(s) past target date: ${delayedMilestones.map(m => m.name).join(', ')}`);
  }

  // ── Overall status ──
  let overallStatus: 'GREEN' | 'AMBER' | 'RED';
  if (lineVariances.some(l => l.status === 'RED') || Math.abs(variancePct) > 0.10) {
    overallStatus = 'RED';
  } else if (lineVariances.some(l => l.status === 'AMBER') || Math.abs(variancePct) > 0.05) {
    overallStatus = 'AMBER';
  } else {
    overallStatus = 'GREEN';
  }

  return {
    asOfMonth: input.asOfMonth,
    totalBudget: Math.round(totalBudget),
    totalCommitted: Math.round(totalCommitted),
    totalSpent: Math.round(totalSpent),
    totalForecast: Math.round(totalForecast),
    varianceToOriginal: Math.round(varianceToOriginal),
    varianceToCurrent: round4(variancePct),
    byCategory: [],
    byCostCode: [],
    sCurveData: [],
    lineVariances,
    alerts,
    overallStatus,
  };
}

function formatCr(amount: number): string {
  return `₹${(amount / 1e7).toFixed(2)} Cr`;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
