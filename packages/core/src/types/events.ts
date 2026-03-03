// ─── Domain Events (slice scope) ───────────────────────────────────

export type DomainEvent =
  | { type: 'assumption.updated'; dealId: string; userId: string;
      field: string; oldValue: unknown; newValue: unknown }
  | { type: 'engine.completed'; dealId: string; engineName: string;
      version: number; durationMs: number }
  | { type: 'recommendation.changed'; dealId: string;
      from: string; to: string; version: number };

export interface EventEnvelope<T extends DomainEvent = DomainEvent> {
  id: string;
  timestamp: string;
  source: string;
  payload: T;
}
