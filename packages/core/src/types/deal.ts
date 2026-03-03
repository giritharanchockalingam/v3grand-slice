// ─── Core Domain Types (Vertical Slice) ───────────────────────────
// Only the entities needed for: Deal → Underwriter → Decision → Dashboard

export type DealStatus = 'draft' | 'active' | 'on-hold' | 'closed';
export type LifecyclePhaseId = 'pre-development' | 'construction' | 'pre-opening';
export type AssetClass = 'hotel';

export interface Deal {
  id: string;
  name: string;
  assetClass: AssetClass;
  status: DealStatus;
  lifecyclePhase: LifecyclePhaseId;
  currentMonth: number;
  version: number;
  property: Property;
  partnership: Partnership;
  marketAssumptions: MarketAssumptions;
  financialAssumptions: FinancialAssumptions;
  capexPlan: CapexPlan;
  opexModel: OpexModel;
  scenarios: ScenarioSet;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  location: {
    city: string;
    state: string;
    country: string;
    distanceToAirportKm: number;
  };
  keys: { phase1: number; phase2: number; total: number };
  starRating: 3 | 4 | 5;
}

export interface Partnership {
  structure: 'jv' | 'sole' | 'syndication';
  partners: Partner[];
}

export interface Partner {
  id: string;
  name: string;
  equityPct: number;
  role: 'lead-investor' | 'co-investor' | 'operator' | 'lender';
  commitmentCr: number;
}

export interface MarketAssumptions {
  occupancyRamp: number[];       // year 0..9
  adrBase: number;               // INR, year-1 blended ADR
  adrStabilized: number;         // INR, stabilized ADR
  adrGrowthRate: number;         // annual growth, e.g. 0.05
  revenueMix: { rooms: number; fb: number; banquet: number; other: number };
}

export interface FinancialAssumptions {
  wacc: number;
  riskFreeRate: number;
  equityRatio: number;
  debtRatio: number;
  debtInterestRate: number;
  debtTenorYears: number;
  exitMultiple: number;
  taxRate: number;
  inflationRate: number;
  managementFeePct: number;
  incentiveFeePct: number;
  ffAndEReservePct: number;
  targetIRR: number;
}

export interface CapexPlan {
  phase1: { totalBudgetCr: number; items: CapexLineItem[] };
  phase2: { totalBudgetCr: number; items: CapexLineItem[] };
  contingencyPct: number;
}

export interface CapexLineItem {
  id: string;
  costCode: string;
  description: string;
  category: string;
  budgetAmount: number;
}

export interface OpexModel {
  departments: USALIDepartment[];
}

export interface USALIDepartment {
  name: string;
  costPctOfRevenue: number;
  fixedFloorMonthly: number;
}

export interface Scenario {
  id: string;
  name: 'bear' | 'base' | 'bull';
  probability: number;
  occupancyStabilized: number;
  adrStabilized: number;
  ebitdaMargin: number;
  phase2Trigger: boolean;
}

export interface ScenarioSet {
  bear: Scenario;
  base: Scenario;
  bull: Scenario;
  [key: string]: Scenario | undefined;
}
