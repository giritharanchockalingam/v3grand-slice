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

export interface GeoLocation {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  distanceToAirportKm: number;
}

export interface LandArea {
  sqft: number;
  acres: number;
}

export interface GrossBUA {
  phase1Sqft: number;
  phase2Sqft: number;
  totalSqft: number;
}

export interface RoomType {
  name: string;
  count: number;
  sqft: number;
  adrPremium: number;  // multiplier vs base ADR
}

export interface Property {
  location: GeoLocation;
  landArea: LandArea;
  grossBUA: GrossBUA;
  keys: { phase1: number; phase2: number; total: number };
  roomTypes: RoomType[];
  amenities: string[];
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

export interface Segment {
  name: string;
  pctMix: number;           // % of room nights
  adrPremium: number;       // multiplier vs base ADR
  seasonality: number[];    // 12 monthly multipliers
}

export interface Seasonality {
  month: number;            // 1-12
  multiplier: number;       // e.g., 0.8 for off-season, 1.2 for peak
}

export interface CompSet {
  name: string;
  keys: number;
  adr: number;
  occ: number;
  revpar: number;
}

export interface MarketAssumptions {
  segments: Segment[];
  occupancyRamp: number[];       // year 0..9
  adrBase: number;               // INR, year-1 blended ADR
  adrStabilized: number;         // INR, stabilized ADR
  adrGrowthRate: number;         // annual growth, e.g. 0.05
  revenueMix: { rooms: number; fb: number; banquet: number; other: number };
  seasonality: Seasonality[];    // 12 monthly multipliers
  compSet: CompSet[];
}

export interface FinancialAssumptions {
  wacc: number;
  riskFreeRate: number;
  equityRatio: number;
  debtRatio: number;
  debtInterestRate: number;
  debtTenorYears: number;
  exitCapRate: number;
  exitMultiple: number;
  taxRate: number;
  inflationRate: number;
  managementFeePct: number;
  incentiveFeePct: number;
  ffAndEReservePct: number;
  workingCapitalDays: number;
  targetIRR: number;
  targetEquityMultiple: number;
  targetDSCR: number;
}

export type CapexCategory = 'land' | 'structure' | 'mep' | 'interiors' | 'ffne' | 'pre-opening' | 'contingency';
export type CapexCurveType = 's-curve' | 'linear' | 'front-loaded' | 'back-loaded';

export interface CapexLineItem {
  id: string;
  costCode: string;
  description: string;
  category: CapexCategory;
  budgetAmount: number;
  committedAmount: number;
  spentAmount: number;
  forecastAmount: number;
  startMonth: number;
  endMonth: number;
  curveType: CapexCurveType;
}

export interface CapexPhase {
  totalBudgetCr: number;
  items: CapexLineItem[];
}

export interface CapexPlan {
  phase1: CapexPhase;
  phase2: CapexPhase;
  contingencyPct: number;
}

export interface FixedCharge {
  name: string;
  monthlyAmountCr: number;
}

export interface USALIDepartment {
  name: string;
  costPctOfRevenue: number;
  fixedVarSplit: { fixed: number; variable: number };  // both as %, sum to 1.0
  fixedFloorMonthly: number;
  gmSavingsPct: number;
}

export interface OpexModel {
  departments: USALIDepartment[];
  undistributed: USALIDepartment[];
  fixedCharges: FixedCharge[];
}

export interface Scenario {
  id: string;
  name: 'bear' | 'base' | 'bull';
  probability: number;
  occupancyStabilized: number;
  adrStabilized: number;
  ebitdaMargin: number;
  mouRealizationPct: number;  // MOU conversion %, 0-1
  phase2Trigger: boolean;
}

export interface ScenarioSet {
  bear: Scenario;
  base: Scenario;
  bull: Scenario;
  [key: string]: Scenario | undefined;
}
