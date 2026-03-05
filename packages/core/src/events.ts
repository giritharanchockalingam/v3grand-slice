/**
 * ─── Event Bus Types & Constants ────────────────────────────────────────
 * Defines all domain events, event envelope structure, and type-safe payloads
 */

/**
 * EventEnvelope wraps all domain events with metadata
 */
export interface EventEnvelope<T = unknown> {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  dealId: string;
  payload: T;
  version: number;
}

/**
 * ─── Event Type Constants ───────────────────────────────────────────────
 */
export const EVENT_TYPES = {
  // Assumption Events
  ASSUMPTION_UPDATED: 'assumption.updated',

  // Engine Events
  ENGINE_COMPLETED: 'engine.completed',

  // Recommendation Events
  RECOMMENDATION_CHANGED: 'recommendation.changed',

  // Macro Events
  MACRO_REFRESHED: 'macro.refreshed',

  // Phase Events
  PHASE_ADVANCED: 'phase.advanced',

  // Milestone Events
  MILESTONE_COMPLETED: 'milestone.completed',
  MILESTONE_DELAYED: 'milestone.delayed',

  // Budget Events
  BUDGET_ACTUAL_UPDATED: 'budget.actual.updated',

  // RFI Events
  RFI_CREATED: 'rfi.created',
  RFI_RESOLVED: 'rfi.resolved',

  // Change Order Events
  CHANGE_ORDER_SUBMITTED: 'change-order.submitted',
  CHANGE_ORDER_APPROVED: 'change-order.approved',
  CHANGE_ORDER_REJECTED: 'change-order.rejected',

  // Risk & Covenant Events
  RISK_ESCALATED: 'risk.escalated',
  COVENANT_BREACHED: 'covenant.breached',
} as const;

/**
 * ─── Event Payload Types ───────────────────────────────────────────────
 */

export interface AssumptionUpdatedPayload {
  assumptionId: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changeTimestamp: string;
}

export interface EngineCompletedPayload {
  engineType: 'budget' | 'decision' | 'factor' | 'risk';
  duration: number;
  resultId: string;
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}

export interface RecommendationChangedPayload {
  recommendationId: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  oldStatus: string;
  newStatus: string;
}

export interface MacroRefreshedPayload {
  macroId: string;
  factors: Record<string, number>;
  refreshedAt: string;
  source: string;
}

export interface PhaseAdvancedPayload {
  phase: 'Pre-Investment' | 'Construction' | 'Operations';
  previousPhase?: string;
  transitionDate: string;
  reason: string;
}

export interface MilestoneCompletedPayload {
  milestoneId: string;
  name: string;
  completedDate: string;
  variance?: number;
}

export interface MilestoneDelayedPayload {
  milestoneId: string;
  name: string;
  originalDate: string;
  revisedDate: string;
  reason: string;
  riskFlags?: string[];
}

export interface BudgetActualUpdatedPayload {
  budgetCategoryId: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  updatedAt: string;
}

export interface RFICreatedPayload {
  rfiId: string;
  title: string;
  createdDate: string;
  dueDate: string;
  assignee: string;
}

export interface RFIResolvedPayload {
  rfiId: string;
  resolvedDate: string;
  resolvedBy: string;
  response: string;
}

export interface ChangeOrderSubmittedPayload {
  changeOrderId: string;
  title: string;
  estimatedCost: number;
  submittedDate: string;
  submittedBy: string;
  description: string;
}

export interface ChangeOrderApprovedPayload {
  changeOrderId: string;
  approvedDate: string;
  approvedBy: string;
  finalCost: number;
  effectiveDate: string;
}

export interface ChangeOrderRejectedPayload {
  changeOrderId: string;
  rejectedDate: string;
  rejectedBy: string;
  reason: string;
}

export interface RiskEscalatedPayload {
  riskId: string;
  name: string;
  oldSeverity: string;
  newSeverity: string;
  escalationReason: string;
  escalatedAt: string;
}

export interface CovenantBreachedPayload {
  covenantId: string;
  name: string;
  threshold: number;
  currentValue: number;
  breachDate: string;
  remediationRequired: boolean;
}

/**
 * ─── Union Type for All Events ─────────────────────────────────────────
 */
export type DomainEventPayload =
  | AssumptionUpdatedPayload
  | EngineCompletedPayload
  | RecommendationChangedPayload
  | MacroRefreshedPayload
  | PhaseAdvancedPayload
  | MilestoneCompletedPayload
  | MilestoneDelayedPayload
  | BudgetActualUpdatedPayload
  | RFICreatedPayload
  | RFIResolvedPayload
  | ChangeOrderSubmittedPayload
  | ChangeOrderApprovedPayload
  | ChangeOrderRejectedPayload
  | RiskEscalatedPayload
  | CovenantBreachedPayload;

/**
 * Base domain event (used internally)
 */
export interface DomainEvent {
  type: string;
  dealId: string;
  [key: string]: unknown;
}
