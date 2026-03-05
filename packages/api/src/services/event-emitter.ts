/**
 * ─── Event Emitter Service ────────────────────────────────────────────
 * High-level typed service for emitting domain events.
 * Wraps NATS event bus with fallback to in-process if unavailable.
 */

import { randomUUID } from 'node:crypto';
import type {
  EventEnvelope,
  DomainEvent,
  AssumptionUpdatedPayload,
  EngineCompletedPayload,
  RecommendationChangedPayload,
  MacroRefreshedPayload,
  PhaseAdvancedPayload,
  MilestoneCompletedPayload,
  MilestoneDelayedPayload,
  BudgetActualUpdatedPayload,
  RFICreatedPayload,
  RFIResolvedPayload,
  ChangeOrderSubmittedPayload,
  ChangeOrderApprovedPayload,
  ChangeOrderRejectedPayload,
  RiskEscalatedPayload,
  CovenantBreachedPayload,
} from '@v3grand/core';
import { EVENT_TYPES } from '@v3grand/core';

/**
 * In-process event bus fallback
 */
interface InProcessEventBus {
  publish(event: DomainEvent, envelope: EventEnvelope): Promise<void>;
  handlers: ((event: DomainEvent, envelope: EventEnvelope) => Promise<void>)[];
}

const inProcessBus: InProcessEventBus = {
  publish: async (event: DomainEvent, envelope: EventEnvelope) => {
    // Run all registered handlers asynchronously
    for (const handler of inProcessBus.handlers) {
      try {
        await handler(event, envelope);
      } catch (err) {
        console.error('[InProcessEventBus] handler error:', err);
      }
    }
  },
  handlers: [],
};

/**
 * EventEmitterService: type-safe event emission with NATS/in-process fallback
 */
export class EventEmitterService {
  private natsEventBus: any = null;
  private idempotencyPrefix = '';

  constructor(natsEventBus?: any) {
    this.natsEventBus = natsEventBus || null;
    this.idempotencyPrefix = randomUUID().substring(0, 8);
  }

  /**
   * Generate idempotency key for event
   */
  private generateIdempotencyKey(dealId: string, eventType: string): string {
    return `${this.idempotencyPrefix}-${dealId}-${eventType}-${Date.now()}`;
  }

  /**
   * Wrap payload in EventEnvelope
   */
  private createEnvelope(
    dealId: string,
    eventType: string,
    payload: unknown
  ): EventEnvelope {
    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: eventType,
      source: 'event-emitter',
      dealId,
      payload,
      version: 1,
    };
  }

  /**
   * Internal emit: tries NATS first, falls back to in-process
   */
  private async emitEvent(
    dealId: string,
    eventType: string,
    payload: unknown
  ): Promise<void> {
    const envelope = this.createEnvelope(dealId, eventType, payload);
    const event: DomainEvent = {
      type: eventType,
      dealId,
      ...payload,
    };

    if (this.natsEventBus && this.natsEventBus.isReady?.()) {
      try {
        const idempotencyKey = this.generateIdempotencyKey(dealId, eventType);
        await this.natsEventBus.publish(event, idempotencyKey);
        console.log(`[EventEmitter] published ${eventType} for deal ${dealId}`);
      } catch (err) {
        console.error(
          `[EventEmitter] NATS publish failed, falling back to in-process:`,
          err
        );
        await inProcessBus.publish(event, envelope);
      }
    } else {
      await inProcessBus.publish(event, envelope);
    }
  }

  /**
   * Register a subscriber for all events (used by event-subscribers)
   */
  registerSubscriber(
    handler: (event: DomainEvent, envelope: EventEnvelope) => Promise<void>
  ): void {
    if (this.natsEventBus && this.natsEventBus.subscribe) {
      this.natsEventBus.subscribe(handler).catch((err: any) => {
        console.error('[EventEmitter] failed to register NATS subscriber:', err);
        // Fall back to in-process
        inProcessBus.handlers.push(handler);
      });
    } else {
      inProcessBus.handlers.push(handler);
    }
  }

  /**
   * ─── Assumption Events ─────────────────────────────────────────────
   */
  async assumptionUpdated(
    dealId: string,
    payload: AssumptionUpdatedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.ASSUMPTION_UPDATED, payload);
  }

  /**
   * ─── Engine Events ────────────────────────────────────────────────
   */
  async engineCompleted(
    dealId: string,
    payload: EngineCompletedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.ENGINE_COMPLETED, payload);
  }

  /**
   * ─── Recommendation Events ───────────────────────────────────────
   */
  async recommendationChanged(
    dealId: string,
    payload: RecommendationChangedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.RECOMMENDATION_CHANGED, payload);
  }

  /**
   * ─── Macro Events ────────────────────────────────────────────────
   */
  async macroRefreshed(
    dealId: string,
    payload: MacroRefreshedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.MACRO_REFRESHED, payload);
  }

  /**
   * ─── Phase Events ────────────────────────────────────────────────
   */
  async phaseAdvanced(
    dealId: string,
    payload: PhaseAdvancedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.PHASE_ADVANCED, payload);
  }

  /**
   * ─── Milestone Events ────────────────────────────────────────────
   */
  async milestoneCompleted(
    dealId: string,
    payload: MilestoneCompletedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.MILESTONE_COMPLETED, payload);
  }

  async milestoneDelayed(
    dealId: string,
    payload: MilestoneDelayedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.MILESTONE_DELAYED, payload);
  }

  /**
   * ─── Budget Events ───────────────────────────────────────────────
   */
  async budgetActualUpdated(
    dealId: string,
    payload: BudgetActualUpdatedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.BUDGET_ACTUAL_UPDATED, payload);
  }

  /**
   * ─── RFI Events ──────────────────────────────────────────────────
   */
  async rfiCreated(dealId: string, payload: RFICreatedPayload): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.RFI_CREATED, payload);
  }

  async rfiResolved(
    dealId: string,
    payload: RFIResolvedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.RFI_RESOLVED, payload);
  }

  /**
   * ─── Change Order Events ──────────────────────────────────────────
   */
  async changeOrderSubmitted(
    dealId: string,
    payload: ChangeOrderSubmittedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.CHANGE_ORDER_SUBMITTED, payload);
  }

  async changeOrderApproved(
    dealId: string,
    payload: ChangeOrderApprovedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.CHANGE_ORDER_APPROVED, payload);
  }

  async changeOrderRejected(
    dealId: string,
    payload: ChangeOrderRejectedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.CHANGE_ORDER_REJECTED, payload);
  }

  /**
   * ─── Risk & Covenant Events ────────────────────────────────────────
   */
  async riskEscalated(
    dealId: string,
    payload: RiskEscalatedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.RISK_ESCALATED, payload);
  }

  async covenantBreached(
    dealId: string,
    payload: CovenantBreachedPayload
  ): Promise<void> {
    await this.emitEvent(dealId, EVENT_TYPES.COVENANT_BREACHED, payload);
  }
}

/**
 * Singleton instance
 */
let instance: EventEmitterService | null = null;

export function initializeEventEmitter(natsEventBus?: any): EventEmitterService {
  if (!instance) {
    instance = new EventEmitterService(natsEventBus);
  }
  return instance;
}

export function getEventEmitter(): EventEmitterService {
  if (!instance) {
    instance = new EventEmitterService();
  }
  return instance;
}
