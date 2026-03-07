// ─── Underwriter Engine: 10-Year Hotel Pro Forma ───────────────────
// Pure function: (ProFormaInput) => ProFormaOutput
// No I/O, no database, no framework dependencies.

import type { ProFormaInput, ProFormaOutput, YearProjection } from '@v3grand/core';
import { calcIRR, calcNPV } from '../_shared/irr.js';

export function buildProForma(input: ProFormaInput): ProFormaOutput {
  const { deal, scenarioKey, overrides } = input;
  const fin = { ...deal.financialAssumptions, ...(overrides ?? {}) };
  const scenario = deal.scenarios[scenarioKey];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioKey}`);

  const mkt = deal.marketAssumptions;
  const phase1Keys = deal.property.keys.phase1;
  const phase2Keys = deal.property.keys.phase2;

  // ── Total investment ──
  const phase2Active = scenario.phase2Trigger;
  const totalInvCr = deal.capexPlan.phase1.totalBudgetCr
    + (phase2Active ? deal.capexPlan.phase2.totalBudgetCr : 0);
  const totalInvestment = totalInvCr * 1e7; // Crore → INR
  const equityInvestment = totalInvestment * fin.equityRatio;
  const debtDrawdown = totalInvestment - equityInvestment;

  // ── Debt service (level annuity) ──
  const r = fin.debtInterestRate;
  const n = fin.debtTenorYears;
  const annuityFactor = r > 0 ? (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 1 / n;
  const annualDebtService = debtDrawdown * annuityFactor;

  // ── Outstanding debt schedule (for exit equity calc) ──
  let outstandingDebt = debtDrawdown;
  const debtByYear: number[] = [outstandingDebt];
  for (let y = 1; y <= 10; y++) {
    const interest = outstandingDebt * r;
    const principal = annualDebtService - interest;
    outstandingDebt = Math.max(0, outstandingDebt - principal);
    debtByYear.push(outstandingDebt);
  }

  // ── Opex cost rate (sum of departmental costs as % of revenue) ──
  const totalOpexPct = deal.opexModel.departments.reduce(
    (sum, dept) => sum + dept.costPctOfRevenue, 0
  );

  // ── Year-by-year projection ──
  const years: YearProjection[] = [];
  const STABILIZATION_YEAR = 5; // occupancy stabilizes by year 5
  const PHASE2_START_YEAR = 4;  // Phase 2 keys come online year 4

  for (let y = 1; y <= 10; y++) {
    // Keys available this year
    const keys = phase1Keys + (phase2Active && y >= PHASE2_START_YEAR ? phase2Keys : 0);

    // Occupancy: ramp from array (0-indexed), cap at scenario stabilized
    const rampOcc = mkt.occupancyRamp[y - 1] ?? mkt.occupancyRamp[mkt.occupancyRamp.length - 1];
    const occupancy = Math.min(rampOcc, scenario.occupancyStabilized);

    // ADR: starts at base, grows toward stabilized, then inflation
    let adr: number;
    if (y <= STABILIZATION_YEAR) {
      const t = y / STABILIZATION_YEAR;
      adr = mkt.adrBase + (scenario.adrStabilized - mkt.adrBase) * t;
    } else {
      adr = scenario.adrStabilized * Math.pow(1 + fin.inflationRate, y - STABILIZATION_YEAR);
    }

    const revpar = occupancy * adr;
    const roomRevenue = revpar * keys * 365;
    const totalRevenue = roomRevenue / mkt.revenueMix.rooms; // rooms as fraction of total

    // Costs — if opex departments are defined, compute bottom-up;
    // otherwise fall back to the scenario's explicit EBITDA margin.
    let gop: number, gopMargin: number, ebitda: number, ebitdaMargin: number;
    if (totalOpexPct > 0) {
      // Bottom-up: departmental costs → GOP → management fees → EBITDA
      const departmentalCost = totalRevenue * totalOpexPct;
      gop = totalRevenue - departmentalCost;
      gopMargin = totalRevenue > 0 ? gop / totalRevenue : 0;
      const mgmtFee = totalRevenue * fin.managementFeePct;
      const incentiveFee = gop * fin.incentiveFeePct;
      const ffneReserve = totalRevenue * fin.ffAndEReservePct;
      ebitda = gop - mgmtFee - incentiveFee - ffneReserve;
      ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;
    } else {
      // Top-down: use scenario's explicit EBITDA margin when opex is not modelled
      ebitdaMargin = scenario.ebitdaMargin;
      ebitda = totalRevenue * ebitdaMargin;
      // Approximate GOP as EBITDA + management/incentive/FF&E so downstream is consistent
      gopMargin = ebitdaMargin + fin.managementFeePct + fin.ffAndEReservePct;
      gop = totalRevenue * gopMargin;
    }

    // After-tax free cash flow to equity
    // Interest expense based on outstanding debt at start of year (declining balance)
    const interestExpense = debtByYear[y - 1] * r;
    const taxableIncome = ebitda - interestExpense;
    const tax = Math.max(0, taxableIncome * fin.taxRate);
    const fcfe = ebitda - tax - annualDebtService;

    years.push({
      year: y, occupancy, adr: Math.round(adr), revpar: Math.round(revpar),
      roomRevenue: Math.round(roomRevenue),
      totalRevenue: Math.round(totalRevenue),
      departmentalProfit: Math.round(gop),
      undistributedExpenses: Math.round(gop - gop),
      gop: Math.round(gop), gopMargin: round4(gopMargin),
      ebitda: Math.round(ebitda), ebitdaMargin: round4(ebitdaMargin),
      debtService: Math.round(annualDebtService),
      fcfe: Math.round(fcfe),
    });
  }

  // ── Cash-flow array for IRR/NPV ──
  const exitEbitda = years[9].ebitda;
  const exitValue = exitEbitda * fin.exitMultiple;
  const exitEquity = exitValue - debtByYear[10];
  const cashFlows = [
    -equityInvestment,
    ...years.slice(0, 9).map(y => y.fcfe),
    years[9].fcfe + exitEquity,
  ];

  const rawIrr = calcIRR(cashFlows);
  const irr = Number.isNaN(rawIrr) ? 0 : rawIrr;
  const npv = calcNPV(cashFlows, fin.wacc);
  const totalPositiveCF = cashFlows.filter(cf => cf > 0).reduce((a, b) => a + b, 0);
  const equityMultiple = equityInvestment > 0 ? totalPositiveCF / equityInvestment : 0;

  // Payback year: first year where cumulative FCFE >= equity invested
  let cumCF = 0;
  let paybackYear = 10;
  for (let i = 1; i < cashFlows.length; i++) {
    cumCF += cashFlows[i];
    if (cumCF >= equityInvestment) { paybackYear = i; break; }
  }

  // Average DSCR (guard against zero debt service → Infinity)
  const avgDSCR = annualDebtService > 0
    ? years
        .filter((_, i) => i < n)
        .map(y => y.ebitda / annualDebtService)
        .reduce((a, b) => a + b, 0) / Math.min(n, years.length)
    : 0;

  return {
    scenarioKey,
    years,
    totalInvestment: Math.round(totalInvestment),
    equityInvestment: Math.round(equityInvestment),
    debtDrawdown: Math.round(debtDrawdown),
    cashFlows: cashFlows.map(Math.round),
    irr: round4(irr),
    npv: Math.round(npv),
    equityMultiple: round4(equityMultiple),
    paybackYear,
    avgDSCR: round4(avgDSCR),
    exitValue: Math.round(exitValue),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
