// ─── Unified Deal Evaluation Types ──────────────────────────────────
// Generic evaluation pipeline: DealEvaluationInput → Engine → DealEvaluationOutput
// Sector-specific logic (hotel, retail, office, etc.) sits behind AssetPlugin.

// ── Decision Verdicts ──

export type EvaluationVerdict = 'APPROVE' | 'CONDITIONAL' | 'DEFER' | 'REJECT';

// ── WACC / Hurdle ──

export interface WACCInputs {
  riskFreeRate: number;         // e.g. 0.065 = 6.5%
  equityRiskPremium: number;    // e.g. 0.08
  betaLevered: number;          // e.g. 1.2
  costOfDebt: number;           // pre-tax, e.g. 0.095
  taxRate: number;              // corporate tax, e.g. 0.25
  debtWeight: number;           // D/(D+E), e.g. 0.6
  equityWeight: number;         // E/(D+E), e.g. 0.4
  countryRiskPremium: number;   // e.g. 0.02
  sizeRiskPremium: number;      // e.g. 0.015
}

export interface WACCOutput {
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  wacc: number;
  hurdleRate: number;           // WACC + spread
  hurdleSpreadBps: number;      // basis points above WACC
}

// ── Capital Structure Option ──

export interface CapitalStructureOption {
  label: string;                // e.g. "Conservative (40% Debt)"
  debtPct: number;              // e.g. 0.40
  equityPct: number;            // e.g. 0.60
  interestRate: number;
  tenorYears: number;
  irr: number;                  // computed
  npv: number;                  // computed
  dscr: number;                 // computed
  equityMultiple: number;       // computed
  paybackYears: number;         // computed
}

// ── Risk Matrix ──

export type RiskLikelihood = 1 | 2 | 3 | 4 | 5;
export type RiskImpact = 1 | 2 | 3 | 4 | 5;
export type EvalRiskCategory =
  | 'market' | 'construction' | 'regulatory' | 'financial'
  | 'operational' | 'environmental' | 'political' | 'execution';

export interface RiskItem {
  id: string;
  name: string;
  category: EvalRiskCategory;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  score: number;                // likelihood × impact
  mitigationStrategy: string;
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;
  residualScore: number;
  owner: string;
}

export interface RiskMatrixOutput {
  risks: RiskItem[];
  overallRiskScore: number;     // weighted average
  riskRating: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  topRisks: RiskItem[];         // top 5 by score
  mitigationImpact: number;     // % reduction from mitigation
}

// ── Operating Model Comparison ──

export interface OperatingModelOption {
  label: string;                // e.g. "Brand (Marriott Courtyard)"
  type: 'brand' | 'independent' | 'soft-brand' | 'franchise';
  // Fee structure
  baseMgmtFeePct: number;      // % of total revenue
  incentiveFeePct: number;     // % of GOP
  brandFeePct: number;         // loyalty/distribution, % of room revenue
  reservationFeePct: number;   // % of room revenue
  // Impact on operations
  occupancyPremium: number;    // additional occupancy vs independent
  adrPremium: number;          // additional ADR vs independent
  setupCostCr: number;         // brand key money / conversion cost
  // Computed
  netRevenuePctAfterFees: number;
  ebitdaMargin: number;
  tenYearNOI: number;
  irr: number;
  recommendation: string;
}

// ── Sensitivity Analysis ──

export interface SensitivityAxis {
  parameter: string;            // e.g. 'occupancy', 'adr', 'exitCapRate'
  label: string;
  values: number[];             // e.g. [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
  unit: 'pct' | 'currency' | 'multiple' | 'bps';
}

export interface SensitivityCell {
  rowValue: number;
  colValue: number;
  irr: number;
  npv: number;
  verdict: EvaluationVerdict;
}

export interface SensitivityMatrix {
  rowAxis: SensitivityAxis;
  colAxis: SensitivityAxis;
  cells: SensitivityCell[][];
  baseCase: { row: number; col: number };
}

// ── Scenario ──

export interface ScenarioAssumptions {
  label: string;                // 'Bear' | 'Base' | 'Bull'
  probability: number;          // e.g. 0.25
  occupancyStabilized: number;
  adrStabilized: number;
  revenueGrowthRate: number;
  opexGrowthRate: number;
  exitCapRate: number;
  exitMultiple: number;
  constructionCostOverrun: number; // e.g. 0.10 = 10% overrun
}

export interface ScenarioResult {
  label: string;
  probability: number;
  irr: number;
  npv: number;
  equityMultiple: number;
  paybackYears: number;
  dscr: number;
  ebitdaMarginStabilized: number;
  exitValue: number;
  verdict: EvaluationVerdict;
}

// ── Lite Alternative Model ──

export interface LiteAlternativeInput {
  description: string;          // e.g. "Lease the land, no hotel development"
  annualIncome: number;
  growthRate: number;
  investmentRequired: number;
  durationYears: number;
}

export interface LiteAlternativeResult {
  description: string;
  irr: number;
  npv: number;
  totalReturn: number;
  riskRating: 'LOW' | 'MODERATE' | 'HIGH';
  comparisonToBase: {
    irrDelta: number;
    npvDelta: number;
    riskDelta: string;          // narrative
  };
}

// ── Year Projection (generic, sector-neutral core) ──

export interface EvaluationYearProjection {
  year: number;
  revenue: number;
  operatingExpenses: number;
  ebitda: number;
  ebitdaMargin: number;
  debtService: number;
  fcfe: number;
  dscr: number;
  // Sector-specific fields are in sectorMetrics
  sectorMetrics: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN INPUT / OUTPUT
// ═══════════════════════════════════════════════════════════════════════

export interface DealEvaluationInput {
  // ── Identity ──
  dealId: string;
  dealName: string;
  assetClass: string;           // 'hotel' | 'retail' | 'office' | 'industrial' ...
  location: {
    city: string;
    state: string;
    country: string;
  };

  // ── Investment Size ──
  totalProjectCost: number;     // INR
  landCost: number;
  constructionCost: number;
  softCosts: number;            // design, permits, legal, etc.
  preOpeningCost: number;
  contingencyPct: number;

  // ── Capital Structure ──
  equityPct: number;            // e.g. 0.40
  debtPct: number;              // e.g. 0.60
  interestRate: number;
  debtTenorYears: number;
  gracePeriodYears: number;

  // ── WACC / Hurdle ──
  waccInputs: WACCInputs;

  // ── Time Horizon ──
  projectionYears: number;      // typically 10
  constructionMonths: number;
  stabilizationYear: number;    // year occupancy/revenue stabilizes

  // ── Scenarios ──
  scenarios: {
    bear: ScenarioAssumptions;
    base: ScenarioAssumptions;
    bull: ScenarioAssumptions;
  };

  // ── Exit Assumptions ──
  exitCapRate: number;
  exitMultiple: number;
  exitYear: number;             // typically = projectionYears

  // ── Tax & Inflation ──
  taxRate: number;
  inflationRate: number;

  // ── Risk Register ──
  risks: Omit<RiskItem, 'score' | 'residualScore'>[];

  // ── Operating Model Options ──
  operatingModelOptions: Omit<OperatingModelOption, 'netRevenuePctAfterFees' | 'ebitdaMargin' | 'tenYearNOI' | 'irr' | 'recommendation'>[];

  // ── Lite Alternatives ──
  liteAlternatives: LiteAlternativeInput[];

  // ── Capital Structure Options (for comparison) ──
  capitalStructureOptions: Omit<CapitalStructureOption, 'irr' | 'npv' | 'dscr' | 'equityMultiple' | 'paybackYears'>[];

  // ── Sensitivity Configuration ──
  sensitivityConfig?: {
    rowParam: string;
    rowValues: number[];
    colParam: string;
    colValues: number[];
  };

  // ── Sector-Specific Plugin Data ──
  // This is where the hotel (or other sector) specific inputs go.
  // The AssetPlugin interprets this blob.
  sectorInputs: Record<string, unknown>;
}

export interface DealEvaluationOutput {
  // ── Core Metrics (base case) ──
  irr: number;
  npv: number;
  equityMultiple: number;
  paybackYears: number;
  avgDSCR: number;
  ebitdaMarginStabilized: number;
  exitValue: number;

  // ── WACC ──
  wacc: WACCOutput;

  // ── Year-by-Year Projections ──
  projections: EvaluationYearProjection[];
  cashFlows: number[];          // year 0 (negative) + years 1..N

  // ── Scenario Analysis ──
  scenarioResults: {
    bear: ScenarioResult;
    base: ScenarioResult;
    bull: ScenarioResult;
  };
  probabilityWeightedIRR: number;
  probabilityWeightedNPV: number;

  // ── Capital Structure Comparison ──
  capitalStructureComparison: CapitalStructureOption[];

  // ── Risk Assessment ──
  riskMatrix: RiskMatrixOutput;

  // ── Operating Model Comparison ──
  operatingModelComparison: OperatingModelOption[];

  // ── Lite Alternative Comparison ──
  liteAlternativeResults: LiteAlternativeResult[];

  // ── Sensitivity ──
  sensitivityMatrix: SensitivityMatrix | null;

  // ── Decision ──
  verdict: EvaluationVerdict;
  confidence: number;           // 0-100
  decisionDrivers: string[];    // top 3-5 reasons
  decisionRisks: string[];      // top 3-5 concerns
  flipConditions: string[];     // what must change
  narrative: string;            // 2-4 sentence investor summary
  icScorecard: ICScorecard;

  // ── Computation Meta ──
  computedAt: string;
  durationMs: number;
}

// ── IC Scorecard (Investment Committee) ──

export interface ICScorecard {
  overallScore: number;         // 1-10
  sections: ICSection[];
  recommendation: EvaluationVerdict;
  conditions: string[];         // conditions for CONDITIONAL verdict
  nextSteps: string[];
}

export interface ICSection {
  name: string;                 // e.g. "Financial Returns", "Market Opportunity", "Risk Profile"
  score: number;                // 1-10
  weight: number;               // 0-1
  summary: string;
  flags: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// ASSET PLUGIN INTERFACE
// ═══════════════════════════════════════════════════════════════════════

export interface AssetPlugin<TSectorInputs = Record<string, unknown>> {
  /** Unique identifier, e.g. 'hotel', 'retail', 'office' */
  assetClass: string;

  /** Human-readable label */
  label: string;

  /** Validate sector-specific inputs and return errors */
  validateInputs(sectorInputs: TSectorInputs): string[];

  /** Compute year-by-year revenue and opex from sector inputs + scenario */
  computeProjections(
    sectorInputs: TSectorInputs,
    scenario: ScenarioAssumptions,
    years: number,
    inflationRate: number,
  ): { revenue: number[]; opex: number[]; sectorMetrics: Record<string, number>[] };

  /** Compute operating model comparison */
  computeOperatingModels(
    sectorInputs: TSectorInputs,
    baseRevenue: number[],
    baseOpex: number[],
    options: DealEvaluationInput['operatingModelOptions'],
  ): OperatingModelOption[];

  /** Return sector-specific sections for the IC scorecard */
  getICSections(
    sectorInputs: TSectorInputs,
    projections: EvaluationYearProjection[],
  ): ICSection[];

  /** Return the default sensitivity axes for this sector */
  getDefaultSensitivityAxes(sectorInputs: TSectorInputs): {
    rowParam: string;
    rowLabel: string;
    rowValues: number[];
    colParam: string;
    colLabel: string;
    colValues: number[];
    unit: SensitivityAxis['unit'];
  };

  /** Get sector-specific input field definitions (for UI form generation) */
  getInputSchema(): SectorInputField[];
}

// ── Sector Input Field (for dynamic form generation) ──

export type SectorFieldType = 'number' | 'currency' | 'percentage' | 'select' | 'toggle' | 'slider' | 'text' | 'array';

export interface SectorInputField {
  key: string;
  label: string;
  section: string;              // group name in UI
  type: SectorFieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  tooltip?: string;
  required?: boolean;
}

// ── Hotel-Specific Sector Inputs ──

export interface HotelSectorInputs {
  // Property
  totalKeys: number;
  phase2Keys: number;
  starRating: 3 | 4 | 5;
  roomTypes: { name: string; count: number; sqft: number; adrPremium: number }[];
  amenities: string[];

  // Revenue
  adrBase: number;
  adrStabilized: number;
  adrGrowthRate: number;
  occupancyRamp: number[];       // year 0..N
  occupancyStabilized: number;
  revenueMix: { rooms: number; fb: number; banquet: number; spa: number; other: number };
  seasonality: { month: number; multiplier: number }[];

  // Market
  compSet: { name: string; keys: number; adr: number; occ: number; revpar: number }[];
  anchorTenants: { name: string; mouRooms: number; mouRate: number; confidence: number }[];
  marketSupplyGrowthPct: number;
  marketDemandGrowthPct: number;

  // Operating
  managementFeePct: number;
  incentiveFeePct: number;
  ffAndEReservePct: number;
  departmentalCostPct: number;  // total dept cost as % of revenue
  undistributedCostPct: number;

  // Operating model choice
  selectedOperatingModel: 'brand' | 'independent' | 'soft-brand';
  brandName?: string;

  // Phase 2
  phase2TriggerOccupancy: number;
  phase2TriggerYear: number;
}
