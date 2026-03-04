// ─── Engine I/O Types ──────────────────────────────────────────────
import type { Deal, FinancialAssumptions } from './deal.js';
import type { BudgetLine, ChangeOrder, RFI, Milestone } from './construction.js';

// ── Underwriter ──

export interface ProFormaInput {
  deal: Deal;
  scenarioKey: 'bear' | 'base' | 'bull';
  overrides?: Partial<FinancialAssumptions>;
}

export interface YearProjection {
  year: number;
  occupancy: number;
  adr: number;
  revpar: number;
  roomRevenue: number;
  totalRevenue: number;
  departmentalProfit: number;
  undistributedExpenses: number;
  gop: number;
  gopMargin: number;
  ebitda: number;
  ebitdaMargin: number;
  debtService: number;
  fcfe: number;
}

export interface ProFormaOutput {
  scenarioKey: string;
  years: YearProjection[];
  totalInvestment: number;
  equityInvestment: number;
  debtDrawdown: number;
  cashFlows: number[];         // year 0 (negative) + years 1-10
  irr: number;
  npv: number;
  equityMultiple: number;
  paybackYear: number;
  avgDSCR: number;
  exitValue: number;
}

// ── Decision ──

export type RecommendationVerdict =
  | 'INVEST' | 'HOLD' | 'DE-RISK' | 'EXIT' | 'DO-NOT-PROCEED';

export interface GateCheck {
  name: string;
  passed: boolean;
  actual: number;
  threshold: number;
}

export interface DecisionInput {
  deal: Deal;
  proformaResult: ProFormaOutput;
  factorResult?: FactorScoreOutput | null;
  mcResult?: MCOutput | null;
  budgetResult?: BudgetAnalysisOutput | null;
  currentRecommendation?: RecommendationState | null;
}

export interface DecisionOutput {
  verdict: RecommendationVerdict;
  confidence: number;
  gateResults: GateCheck[];
  explanation: string;
  isFlip: boolean;
  riskFlags: string[];
  topDrivers: string[];       // top 3 factors supporting the verdict
  topRisks: string[];          // top 3 risk concerns
  flipConditions: string[];    // what must change to flip the verdict
  narrative: string;           // investor-grade 2-3 sentence summary
}

// ── Recommendation (persisted) ──

export interface RecommendationState {
  id: string;
  dealId: string;
  version: number;
  timestamp: string;
  verdict: RecommendationVerdict;
  confidence: number;
  triggerEvent: string;
  factorSnapshot?: {
    compositeScore: number;
    impliedDiscountRate: number;
    impliedCapRate: number;
  };
  proformaSnapshot: {
    irr: number;
    npv: number;
    equityMultiple: number;
    dscr: number;
  };
  mcSnapshot?: {
    p10Irr: number;
    p50Irr: number;
    p90Irr: number;
    probNpvNeg: number;
  };
  gateResults: GateCheck[];
  explanation: string;
  previousVerdict: RecommendationVerdict | null;
  isFlip: boolean;
}

// ── EngineResult (versioned row) ──

export interface EngineResult {
  id: string;
  dealId: string;
  engineName: 'underwriter' | 'decision' | 'factor' | 'montecarlo' | 'budget' | 'scurve';
  version: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  triggeredBy: string;
  createdAt: string;
}

// ── AuditLog ──

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  dealId: string;
  userId: string;
  role: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown> | null;
}

// ── Factor Engine ──

export interface MacroIndicators {
  repoRate: number;          // e.g. 0.065 = 6.5%
  cpi: number;               // e.g. 0.05 = 5%
  gdpGrowthRate: number;     // e.g. 0.065
  bondYield10Y: number;      // e.g. 0.072
  hotelSupplyGrowthPct: number; // local market supply growth
}

export interface FactorDetail {
  name: string;
  domain: 'global' | 'local' | 'asset' | 'sponsor';
  score: number;       // 1-5
  weight: number;      // 0-1
  rationale: string;
}

export interface FactorScoreInput {
  deal: Deal;
  macroIndicators?: MacroIndicators;
}

export interface DomainScoreDetail {
  score: number;         // 1.0 - 5.0
  weight: number;        // 0-1, sum of all = 1.0
  factors: FactorDetail[];
}

export interface FactorScoreOutput {
  compositeScore: number;        // 1.0 - 5.0
  impliedDiscountRate: number;   // discount rate derived from composite score
  impliedCapRate: number;        // cap rate derived from composite score
  domainScores: {
    global: DomainScoreDetail;
    local: DomainScoreDetail;
    asset: DomainScoreDetail;
    sponsor: DomainScoreDetail;
  };
}

// ── Monte Carlo ──

export interface MCInput {
  deal: Deal;
  iterations?: number;   // default 5000
  seed?: number;         // for deterministic runs
}

export interface PercentileSet {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  mean: number;
  stdDev: number;
}

export interface MCOutput {
  iterations: number;
  irrDistribution: PercentileSet;
  npvDistribution: PercentileSet;
  probNpvNegative: number;
  probIrrBelowWacc: number;
  probPhase2Trigger: number;
  sensitivityRanking: { parameter: string; correlation: number }[];
  histogram: { bucketMin: number; bucketMax: number; count: number }[];
}

// ── Budget Variance ──

export interface BudgetAnalysisInput {
  deal: Deal;
  budgetLines: BudgetLine[];
  changeOrders: ChangeOrder[];
  rfis: RFI[];
  milestones: Milestone[];
  asOfMonth: number;
}

export interface BudgetLineVariance {
  costCode: string;
  description: string;
  category: string;
  originalBudget: number;
  approvedCOs: number;
  currentBudget: number;
  actualSpend: number;
  commitments: number;
  forecast: number;
  variance: number;
  variancePct: number;
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface BudgetVarianceByCategory {
  category: string;
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  totalForecast: number;
  variancePct: number;
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface BudgetVarianceByCostCode {
  costCode: string;
  description: string;
  totalBudget: number;
  totalSpent: number;
  variancePct: number;
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface SCurveDataPoint {
  month: number;
  planned: number;
  actual: number;
  forecast: number;
  cumulativePlanned: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}

export interface BudgetAnalysisOutput {
  asOfMonth: number;
  totalBudget: number;
  totalCommitted: number;
  totalSpent: number;
  totalForecast: number;
  varianceToOriginal: number;
  varianceToCurrent: number;
  byCategory: BudgetVarianceByCategory[];
  byCostCode: BudgetVarianceByCostCode[];
  sCurveData: SCurveDataPoint[];
  lineVariances?: BudgetLineVariance[];
  alerts: string[];
  overallStatus: 'GREEN' | 'AMBER' | 'RED';
}

// ── S-Curve ──

export interface SCurveItem {
  id: string;
  costCode: string;
  amount: number;
  startMonth: number;
  endMonth: number;
  curveType: 's-curve' | 'linear' | 'front-loaded' | 'back-loaded';
}

export interface SCurveInput {
  items: SCurveItem[];
  totalMonths: number;
}

export interface SCurveOutput {
  monthlyCashflows: number[];
  cumulativeCashflows: number[];
  totalAmount: number;
}
