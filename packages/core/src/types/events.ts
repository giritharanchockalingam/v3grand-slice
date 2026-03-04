// ─── Domain Events (slice scope) ───────────────────────────────────

export type EventSource = 'api' | 'workflow' | 'system';

export type DomainEvent =
  // Assumption Events
  | { type: 'assumption.updated'; dealId: string; userId: string;
      field: string; oldValue: unknown; newValue: unknown }
  // Macro Events
  | { type: 'macro.refreshed'; macroIndicators: Record<string, number> }
  // Phase & Milestone Events
  | { type: 'phase.advanced'; dealId: string; fromPhase: string; toPhase: string; userId: string }
  | { type: 'milestone.completed'; dealId: string; milestoneId: string; actualDate: string; userId: string }
  | { type: 'milestone.delayed'; dealId: string; milestoneId: string; newTargetDate: string; userId: string }
  // Budget Events
  | { type: 'budget.actual.updated'; dealId: string; costCode: string;
      spentAmount: number; previousSpent: number; asOfMonth: number; userId: string }
  // Construction Events
  | { type: 'rfi.created'; dealId: string; rfiId: string; rfiNumber: string; userId: string }
  | { type: 'rfi.resolved'; dealId: string; rfiId: string; answer: string; userId: string }
  | { type: 'change-order.submitted'; dealId: string; coId: string;
      coNumber: string; amount: number; userId: string }
  | { type: 'change-order.approved'; dealId: string; coId: string;
      coNumber: string; amount: number; approvedBy: string; userId: string }
  // Risk Events
  | { type: 'risk.escalated'; dealId: string; riskId: string; riskTitle: string;
      newScore: number; previousScore: number; userId: string }
  // Decision Events
  | { type: 'recommendation.changed'; dealId: string; recommendationId: string;
      from: string; to: string; version: number; confidence: number; userId: string }
  // Engine Events
  | { type: 'engine.completed'; dealId: string; engineName: string;
      version: number; durationMs: number; success: boolean; error?: string };

export interface EventEnvelope<T extends DomainEvent = DomainEvent> {
  id: string;
  timestamp: string;
  source: EventSource;
  payload: T;
}
