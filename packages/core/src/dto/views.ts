// ─── View DTO for Deal Dashboard (thin slice) ─────────────────────
import type {
  Deal, RecommendationState, ProFormaOutput, AuditLogEntry,
  FactorScoreOutput, MCOutput, BudgetAnalysisOutput, BudgetLineVariance,
} from '../index.js';
import type { ConstructionSummary } from '../types/construction.js';

export interface PropertySummary {
  location: Deal['property']['location'];
  keys: Deal['property']['keys'];
  starRating: Deal['property']['starRating'];
  grossBUA: Deal['property']['grossBUA'];
}

export interface ProFormaSnapshot {
  scenarioKey: string;
  years: Array<{
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
  }>;
  irr: number;
  npv: number;
  equityMultiple: number;
  paybackYear: number;
}

export interface MCSummary {
  p50Irr: number;
  probNpvNeg: number;
  probIrrBelowWacc: number;
}

export interface FactorSummary {
  compositeScore: number;
  impliedDiscountRate: number;
  impliedCapRate: number;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalForecast: number;
  varianceToCurrent: number;
  overallStatus: 'GREEN' | 'AMBER' | 'RED';
}

export interface ConstructionProgress {
  pctComplete: number;
  daysAheadBehind: number;
  openRFIs: number;
  pendingChangeOrders: number;
}

export interface RecentEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
}

export interface DealDashboardView {
  deal: Pick<Deal, 'id' | 'name' | 'assetClass' | 'status' | 'lifecyclePhase' | 'currentMonth' | 'version'>;
  property: PropertySummary | Record<string, unknown>;
  partnership: Deal['partnership'] | Record<string, unknown>;
  latestRecommendation: RecommendationState | null;
  latestProforma: (ProFormaSnapshot & {
    avgDSCR?: number;
    exitValue?: number;
    totalInvestment?: number;
    equityInvestment?: number;
  }) | null;
  // Full engine outputs (raw from DB)
  latestMC: Record<string, any> | null;
  latestFactor: Record<string, any> | null;
  latestBudget: Record<string, any> | null;
  latestSCurve: Record<string, any> | null;
  budgetSummary: {
    overallStatus?: string;
    varianceToCurrent?: number;
    alerts?: string[];
  } | null;
  constructionProgress: {
    totalBudget?: number;
    actualSpend?: number;
    commitments?: number;
    approvedCOs?: number;
    variance?: number;
    completionPct?: number;
  } | null;
  recentEvents: Array<RecentEvent & { module?: string; severity?: string; userId?: string; diff?: unknown }>;
  recommendationHistory: Array<{
    version: number;
    verdict: string;
    confidence: number;
    timestamp: string;
    scenarioKey?: string;
    explanation?: string;
    previousVerdict?: string | null;
    isFlip?: boolean;
    gateResults?: Array<{ name: string; passed: boolean }>;
  }>;
  // Decision intelligence (from latest decision engine result)
  decisionInsight: {
    narrative: string;
    topDrivers: string[];
    topRisks: string[];
    flipConditions: string[];
    riskFlags: string[];
  } | null;
  // Assumptions passthrough
  marketAssumptions?: Record<string, any> | null;
  financialAssumptions?: Record<string, any> | null;
  capexPlan?: Record<string, any> | null;
}

// ─── Scenario Explorer View ────────────────────────────────────────

export interface ScenarioComparisonRow {
  metric: string;
  bear: number | string;
  base: number | string;
  bull: number | string;
  format: 'percent' | 'currency' | 'multiple' | 'years' | 'number';
}

export interface ScenarioData {
  key: 'bear' | 'base' | 'bull';
  name: string;
  probability: number;
  proforma: ProFormaOutput | null;
}

export interface ScenarioExplorerView {
  dealId: string;
  scenarios: ScenarioData[];
  mcSummary: MCOutput | null;
  factorSummary: FactorScoreOutput | null;
  comparisonTable: ScenarioComparisonRow[];
}

// ─── Budget Tracker View ───────────────────────────────────────────

export interface TopVariance {
  costCode: string;
  description: string;
  budgetAmount: number;
  spentAmount: number;
  varianceToCurrent: number;
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface RFISummary {
  open: number;
  closed: number;
  total: number;
}

export interface ChangeOrderSummary {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  pendingAmount: number;
  approvedAmount: number;
}

export interface BudgetTrackerView {
  dealId: string;
  asOfMonth: number;
  summary: BudgetAnalysisOutput;
  sCurveChart: Array<{
    month: number;
    planned: number;
    actual: number;
    forecast: number;
    cumulativePlanned: number;
    cumulativeActual: number;
    cumulativeForecast: number;
  }>;
  topVariances: TopVariance[];
  rfis: RFISummary;
  changeOrders: ChangeOrderSummary;
  riskExposure: Array<{
    riskId: string;
    title: string;
    costExposureCr: number;
    probability: number;
    impact: number;
    status: string;
  }>;
}
