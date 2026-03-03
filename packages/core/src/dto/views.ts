// ─── View DTO for Deal Dashboard (thin slice) ─────────────────────
import type {
  Deal, RecommendationState, ProFormaOutput, AuditLogEntry,
  FactorScoreOutput, MCOutput, BudgetAnalysisOutput, BudgetLineVariance,
} from '../index.js';
import type { ConstructionSummary } from '../types/construction.js';

export interface DealDashboardView {
  deal: Pick<Deal, 'id' | 'name' | 'assetClass' | 'status' | 'lifecyclePhase' | 'currentMonth'>;
  property: Deal['property'];
  partnership: Deal['partnership'];
  latestRecommendation: RecommendationState | null;
  latestProforma: ProFormaOutput | null;
  constructionSummary: ConstructionSummary | null;
  recentAudit: Pick<AuditLogEntry, 'action' | 'module' | 'timestamp' | 'userId'>[];
  recommendationHistory: Pick<RecommendationState, 'version' | 'verdict' | 'confidence' | 'timestamp'>[];
}

// ─── Scenario Explorer View ────────────────────────────────────────

export interface ScenarioComparisonRow {
  metric: string;
  bear: number | string;
  base: number | string;
  bull: number | string;
  format: 'percent' | 'currency' | 'multiple' | 'years' | 'number';
}

export interface ScenarioExplorerView {
  dealId: string;
  activeScenarioKey: string;
  scenarios: {
    bear: ProFormaOutput | null;
    base: ProFormaOutput | null;
    bull: ProFormaOutput | null;
  };
  comparisonTable: ScenarioComparisonRow[];
  factorSummary: FactorScoreOutput | null;
  mcSummary: MCOutput | null;
}

// ─── Budget Tracker View ───────────────────────────────────────────

export interface BudgetTrackerView {
  dealId: string;
  summary: {
    totalBudget: number;
    totalSpent: number;
    totalCommitted: number;
    totalForecast: number;
    variancePct: number;
    overallStatus: 'GREEN' | 'AMBER' | 'RED';
  };
  topVariances: BudgetLineVariance[];
  sCurveChart: {
    month: number;
    planned: number;
    actual: number;
    forecast: number;
  }[];
  rfiCount: { open: number; closed: number; total: number };
  changeOrderCount: { pending: number; approved: number; rejected: number; total: number };
}
