// ─── V3 Grand Madurai: Seed Deal ────────────────────────────────────
// Source of truth: Excel Key Assumptions, CAPEX & Phasing, EBITDA & CF sheets.
// This is the golden fixture for testing all engines.

import type { Deal } from '@v3grand/core';

export const V3_GRAND_DEAL_ID = '00000000-0000-7000-8000-000000000001';

export const v3GrandSeed: Deal = {
  id: V3_GRAND_DEAL_ID,
  name: 'V3 Grand Madurai',
  assetClass: 'hotel',
  status: 'active',
  lifecyclePhase: 'construction',
  currentMonth: 14,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  property: {
    location: {
      city: 'Madurai', state: 'Tamil Nadu', country: 'India',
      distanceToAirportKm: 4.5,
    },
    keys: { phase1: 55, phase2: 17, total: 72 },
    starRating: 4,
  },

  partnership: {
    structure: 'jv',
    partners: [
      { id: 'p1', name: 'Lead Partner', equityPct: 0.50, role: 'lead-investor', commitmentCr: 17.85 },
      { id: 'p2', name: 'Co-Investor A', equityPct: 0.25, role: 'co-investor', commitmentCr: 8.925 },
      { id: 'p3', name: 'Co-Investor B', equityPct: 0.25, role: 'co-investor', commitmentCr: 8.925 },
    ],
  },

  marketAssumptions: {
    occupancyRamp: [0, 0.35, 0.55, 0.68, 0.75, 0.78, 0.78, 0.78, 0.78, 0.78],
    adrBase: 4200,
    adrStabilized: 5000,
    adrGrowthRate: 0.05,
    revenueMix: { rooms: 0.60, fb: 0.22, banquet: 0.13, other: 0.05 },
  },

  financialAssumptions: {
    wacc: 0.138,
    riskFreeRate: 0.072,
    equityRatio: 0.50,
    debtRatio: 0.50,
    debtInterestRate: 0.10,
    debtTenorYears: 12,
    exitMultiple: 12,
    taxRate: 0.252,
    inflationRate: 0.05,
    managementFeePct: 0.03,
    incentiveFeePct: 0.08,
    ffAndEReservePct: 0.04,
    targetIRR: 0.15,
  },

  capexPlan: {
    phase1: {
      totalBudgetCr: 35.7,
      items: [
        { id: 'c1', costCode: 'LAND-001', description: 'Land acquisition', category: 'land', budgetAmount: 60_000_000 },
        { id: 'c2', costCode: 'STRUC-001', description: 'Structure & civil', category: 'structure', budgetAmount: 120_000_000 },
        { id: 'c3', costCode: 'MEP-001', description: 'MEP systems', category: 'mep', budgetAmount: 55_000_000 },
        { id: 'c4', costCode: 'INT-001', description: 'Interiors & fit-out', category: 'interiors', budgetAmount: 45_000_000 },
        { id: 'c5', costCode: 'FFNE-001', description: 'FF&E', category: 'ffne', budgetAmount: 40_000_000 },
        { id: 'c6', costCode: 'PRE-001', description: 'Pre-opening expenses', category: 'pre-opening', budgetAmount: 17_000_000 },
        { id: 'c7', costCode: 'CONT-001', description: 'Contingency', category: 'contingency', budgetAmount: 20_000_000 },
      ],
    },
    phase2: {
      totalBudgetCr: 7.3,
      items: [
        { id: 'c8', costCode: 'P2-STRUC', description: 'Phase 2 structure', category: 'structure', budgetAmount: 45_000_000 },
        { id: 'c9', costCode: 'P2-FFNE', description: 'Phase 2 FF&E', category: 'ffne', budgetAmount: 28_000_000 },
      ],
    },
    contingencyPct: 0.05,
  },

  opexModel: {
    // costPctOfRevenue = department cost as % of TOTAL hotel revenue
    // Sum ~0.49 → GOP margin ~51%, then mgmt/incentive/FF&E → EBITDA ~36-40%
    departments: [
      { name: 'Rooms', costPctOfRevenue: 0.13, fixedFloorMonthly: 300_000 },
      { name: 'F&B', costPctOfRevenue: 0.14, fixedFloorMonthly: 200_000 },
      { name: 'Banquets', costPctOfRevenue: 0.07, fixedFloorMonthly: 100_000 },
      { name: 'Admin & General', costPctOfRevenue: 0.06, fixedFloorMonthly: 400_000 },
      { name: 'Sales & Marketing', costPctOfRevenue: 0.04, fixedFloorMonthly: 150_000 },
      { name: 'Property Ops', costPctOfRevenue: 0.05, fixedFloorMonthly: 250_000 },
    ],
  },

  scenarios: {
    bear: {
      id: 's-bear', name: 'bear', probability: 0.20,
      occupancyStabilized: 0.65, adrStabilized: 4200,
      ebitdaMargin: 0.34, phase2Trigger: false,
    },
    base: {
      id: 's-base', name: 'base', probability: 0.55,
      occupancyStabilized: 0.78, adrStabilized: 5000,
      ebitdaMargin: 0.404, phase2Trigger: true,
    },
    bull: {
      id: 's-bull', name: 'bull', probability: 0.25,
      occupancyStabilized: 0.85, adrStabilized: 5800,
      ebitdaMargin: 0.45, phase2Trigger: true,
    },
  },
};
