/**
 * ─── Event Subscribers ────────────────────────────────────────────────
 * Registers event subscribers that trigger appropriate engine recomputes.
 * Engine trigger matrix:
 *   - assumption.updated → full recompute cascade
 *   - change-order.approved → budget engine + recompute
 *   - milestone.delayed → decision engine (risk flags)
 *   - macro.refreshed → factor engine + recompute
 *   - budget.actual.updated → budget engine
 */

import type { DomainEvent, EventEnvelope } from '@v3grand/core';
import { EVENT_TYPES } from '@v3grand/core';
import { getEventEmitter } from './event-emitter';

/**
 * Mock engine execution functions (replace with actual implementations)
 */
interface EngineResult {
  engineType: string;
  dealId: string;
  resultId: string;
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
  duration: number;
}

async function runBudgetEngine(dealId: string): Promise<EngineResult> {
  const startTime = Date.now();
  console.log(`[Engine] running budget engine for deal ${dealId}`);
  try {
    // TODO: implement actual budget engine logic
    // - recalculate budget variance
    // - regenerate budget reports
    // - check budget thresholds
    return {
      engineType: 'budget',
      dealId,
      resultId: `budget-${Date.now()}`,
      status: 'success',
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      engineType: 'budget',
      dealId,
      resultId: `budget-${Date.now()}`,
      status: 'failed',
      errorMessage: String(err),
      duration: Date.now() - startTime,
    };
  }
}

async function runDecisionEngine(dealId: string): Promise<EngineResult> {
  const startTime = Date.now();
  console.log(`[Engine] running decision engine for deal ${dealId}`);
  try {
    // TODO: implement actual decision engine logic
    // - evaluate risk flags
    // - generate decision recommendations
    // - update covenant breach assessments
    return {
      engineType: 'decision',
      dealId,
      resultId: `decision-${Date.now()}`,
      status: 'success',
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      engineType: 'decision',
      dealId,
      resultId: `decision-${Date.now()}`,
      status: 'failed',
      errorMessage: String(err),
      duration: Date.now() - startTime,
    };
  }
}

async function runFactorEngine(dealId: string): Promise<EngineResult> {
  const startTime = Date.now();
  console.log(`[Engine] running factor engine for deal ${dealId}`);
  try {
    // TODO: implement actual factor engine logic
    // - refresh macro factors
    // - recalculate weightings
    // - update factor dependencies
    return {
      engineType: 'factor',
      dealId,
      resultId: `factor-${Date.now()}`,
      status: 'success',
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      engineType: 'factor',
      dealId,
      resultId: `factor-${Date.now()}`,
      status: 'failed',
      errorMessage: String(err),
      duration: Date.now() - startTime,
    };
  }
}

async function runRiskEngine(dealId: string): Promise<EngineResult> {
  const startTime = Date.now();
  console.log(`[Engine] running risk engine for deal ${dealId}`);
  try {
    // TODO: implement actual risk engine logic
    // - assess risk scores
    // - escalate flagged risks
    // - evaluate risk mitigations
    return {
      engineType: 'risk',
      dealId,
      resultId: `risk-${Date.now()}`,
      status: 'success',
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      engineType: 'risk',
      dealId,
      resultId: `risk-${Date.now()}`,
      status: 'failed',
      errorMessage: String(err),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Full recompute cascade: budget → decision → risk
 */
async function runFullRecomputeCascade(dealId: string): Promise<void> {
  const emitter = getEventEmitter();

  try {
    // 1. Run budget engine
    const budgetResult = await runBudgetEngine(dealId);
    await emitter.engineCompleted(dealId, budgetResult);

    // 2. Run decision engine
    const decisionResult = await runDecisionEngine(dealId);
    await emitter.engineCompleted(dealId, decisionResult);

    // 3. Run risk engine
    const riskResult = await runRiskEngine(dealId);
    await emitter.engineCompleted(dealId, riskResult);

    console.log(
      `[Subscribers] full recompute cascade completed for deal ${dealId}`
    );
  } catch (err) {
    console.error(
      `[Subscribers] full recompute cascade failed for deal ${dealId}:`,
      err
    );
  }
}

/**
 * ─── Event Subscriber Handlers ─────────────────────────────────────────
 */

async function handleAssumptionUpdated(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  console.log(
    `[Subscriber] assumption.updated received for deal ${envelope.dealId}`
  );
  // Full recompute cascade: budget → decision → risk
  await runFullRecomputeCascade(envelope.dealId);
}

async function handleChangeOrderApproved(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  console.log(
    `[Subscriber] change-order.approved received for deal ${envelope.dealId}`
  );
  // Run budget engine + full recompute
  const emitter = getEventEmitter();

  try {
    const budgetResult = await runBudgetEngine(envelope.dealId);
    await emitter.engineCompleted(envelope.dealId, budgetResult);

    // Then cascade
    await runFullRecomputeCascade(envelope.dealId);
  } catch (err) {
    console.error(
      `[Subscribers] change order approved handling failed:`,
      err
    );
  }
}

async function handleMilestoneDelayed(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  console.log(
    `[Subscriber] milestone.delayed received for deal ${envelope.dealId}`
  );
  // Decision engine (risk flags)
  const emitter = getEventEmitter();

  try {
    const decisionResult = await runDecisionEngine(envelope.dealId);
    await emitter.engineCompleted(envelope.dealId, decisionResult);
  } catch (err) {
    console.error(
      `[Subscribers] milestone delayed handling failed:`,
      err
    );
  }
}

async function handleMacroRefreshed(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  console.log(
    `[Subscriber] macro.refreshed received for deal ${envelope.dealId}`
  );
  // Factor engine + full recompute cascade
  const emitter = getEventEmitter();

  try {
    const factorResult = await runFactorEngine(envelope.dealId);
    await emitter.engineCompleted(envelope.dealId, factorResult);

    // Then full cascade
    await runFullRecomputeCascade(envelope.dealId);
  } catch (err) {
    console.error(
      `[Subscribers] macro refreshed handling failed:`,
      err
    );
  }
}

async function handleBudgetActualUpdated(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  console.log(
    `[Subscriber] budget.actual.updated received for deal ${envelope.dealId}`
  );
  // Budget engine only
  const emitter = getEventEmitter();

  try {
    const budgetResult = await runBudgetEngine(envelope.dealId);
    await emitter.engineCompleted(envelope.dealId, budgetResult);
  } catch (err) {
    console.error(
      `[Subscribers] budget actual updated handling failed:`,
      err
    );
  }
}

/**
 * Main router: dispatch events to appropriate subscribers
 */
async function eventSubscriberRouter(
  event: DomainEvent,
  envelope: EventEnvelope
): Promise<void> {
  try {
    switch (envelope.type) {
      case EVENT_TYPES.ASSUMPTION_UPDATED:
        await handleAssumptionUpdated(event, envelope);
        break;

      case EVENT_TYPES.CHANGE_ORDER_APPROVED:
        await handleChangeOrderApproved(event, envelope);
        break;

      case EVENT_TYPES.MILESTONE_DELAYED:
        await handleMilestoneDelayed(event, envelope);
        break;

      case EVENT_TYPES.MACRO_REFRESHED:
        await handleMacroRefreshed(event, envelope);
        break;

      case EVENT_TYPES.BUDGET_ACTUAL_UPDATED:
        await handleBudgetActualUpdated(event, envelope);
        break;

      // Other events: no-op (could log for debugging)
      default:
        console.log(
          `[Subscriber] unhandled event type: ${envelope.type} for deal ${envelope.dealId}`
        );
    }
  } catch (err) {
    console.error(`[Subscriber] router error for event ${envelope.type}:`, err);
  }
}

/**
 * Initialize subscribers: register the router with the event emitter
 */
export function initializeEventSubscribers(): void {
  const emitter = getEventEmitter();
  emitter.registerSubscriber(eventSubscriberRouter);
  console.log('[Subscribers] initialized event subscriber router');
}
