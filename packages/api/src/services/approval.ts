// ─── Four-Eyes / Maker-Checker Approval Workflow ────────────────────
// G-11/F-2: Critical actions require approval from a different user/role.
//
// Materiality tiers:
//   LOW    → Auto-approved (logged only)
//   MEDIUM → Requires peer review (any user with same or higher role, different person)
//   HIGH   → Requires senior review (admin or lead-investor role, different person)
//
// Actions covered:
//   assumption.update  → MEDIUM (HIGH if IRR impact > 200bps)
//   scenario.promote   → HIGH
//   revalue            → MEDIUM
//   deal.status        → HIGH
//   deal.delete        → HIGH

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, gt } from 'drizzle-orm';
import { pendingActions } from '@v3grand/db';
import { logger } from '@v3grand/core';

// ── Types ──

export interface CreatePendingActionInput {
  dealId: string;
  actionType: string;
  initiatorId: string;
  initiatorRole: string;
  payload: Record<string, unknown>;
  materiality?: 'low' | 'medium' | 'high';
}

export interface ReviewActionInput {
  actionId: string;
  reviewerId: string;
  reviewerRole: string;
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}

export type PendingActionRow = typeof pendingActions.$inferSelect;

// ── Materiality Rules ──

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  analyst: 1,
  'lead-investor': 2,
  admin: 3,
};

const ACTION_DEFAULT_MATERIALITY: Record<string, 'low' | 'medium' | 'high'> = {
  'assumption.update': 'medium',
  'scenario.promote': 'high',
  'revalue': 'medium',
  'deal.status': 'high',
  'deal.delete': 'high',
};

const EXPIRY_DAYS = 7;

/**
 * Determine materiality for an action.
 * Can be overridden by caller, otherwise uses defaults.
 */
export function assessMateriality(
  actionType: string,
  payload: Record<string, unknown>,
): 'low' | 'medium' | 'high' {
  // Custom materiality escalation: if assumption change impacts IRR by >200bps, escalate to HIGH
  if (actionType === 'assumption.update' && payload.estimatedIrrImpact) {
    const impact = Math.abs(payload.estimatedIrrImpact as number);
    if (impact > 0.02) return 'high';
  }

  return ACTION_DEFAULT_MATERIALITY[actionType] ?? 'medium';
}

/**
 * Check whether the reviewer is authorized to approve this action.
 * Rules:
 *  1. Reviewer must be a different person than initiator
 *  2. For MEDIUM materiality: reviewer role >= initiator role
 *  3. For HIGH materiality: reviewer must be admin or lead-investor
 */
export function canReview(
  action: PendingActionRow,
  reviewerId: string,
  reviewerRole: string,
): { allowed: boolean; reason?: string } {
  // Rule 1: Different person
  if (action.initiatorId === reviewerId) {
    return { allowed: false, reason: 'Cannot review your own action (segregation of duties)' };
  }

  // Rule 2: Role hierarchy for MEDIUM
  if (action.materiality === 'medium') {
    const reviewerLevel = ROLE_HIERARCHY[reviewerRole] ?? 0;
    const initiatorLevel = ROLE_HIERARCHY[action.initiatorRole] ?? 0;
    if (reviewerLevel < initiatorLevel) {
      return { allowed: false, reason: `Reviewer role (${reviewerRole}) must be >= initiator role (${action.initiatorRole})` };
    }
  }

  // Rule 3: Senior review for HIGH
  if (action.materiality === 'high') {
    if (reviewerRole !== 'admin' && reviewerRole !== 'lead-investor') {
      return { allowed: false, reason: 'HIGH materiality actions require admin or lead-investor approval' };
    }
  }

  // Check expiry
  if (action.expiresAt && new Date(action.expiresAt) < new Date()) {
    return { allowed: false, reason: 'This pending action has expired' };
  }

  return { allowed: true };
}

/**
 * Create a pending action requiring approval.
 * For LOW materiality, auto-approves and returns the action.
 */
export async function createPendingAction(
  db: PostgresJsDatabase,
  input: CreatePendingActionInput,
): Promise<PendingActionRow> {
  const materiality = input.materiality ?? assessMateriality(input.actionType, input.payload);
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // For LOW materiality, auto-approve
  const status = materiality === 'low' ? 'APPROVED' : 'PENDING';

  const [row] = await db.insert(pendingActions).values({
    dealId: input.dealId,
    actionType: input.actionType,
    status,
    initiatorId: input.initiatorId,
    initiatorRole: input.initiatorRole,
    payload: input.payload,
    materiality,
    expiresAt,
    ...(status === 'APPROVED' ? {
      reviewerId: 'system',
      reviewerRole: 'system',
      reviewedAt: new Date(),
      reviewNote: 'Auto-approved (LOW materiality)',
    } : {}),
  }).returning();

  logger.info('approval.created', {
    actionId: row.id,
    dealId: input.dealId,
    actionType: input.actionType,
    materiality,
    status,
    initiator: input.initiatorId,
  });

  return row;
}

/**
 * Review (approve or reject) a pending action.
 * Validates segregation of duties and role hierarchy before allowing review.
 */
export async function reviewPendingAction(
  db: PostgresJsDatabase,
  input: ReviewActionInput,
): Promise<{ ok: boolean; action?: PendingActionRow; error?: string }> {
  // Fetch the pending action
  const [action] = await db.select()
    .from(pendingActions)
    .where(and(
      eq(pendingActions.id, input.actionId),
      eq(pendingActions.status, 'PENDING'),
    ))
    .limit(1);

  if (!action) {
    return { ok: false, error: 'Pending action not found or already reviewed' };
  }

  // Check authorization
  const authCheck = canReview(action, input.reviewerId, input.reviewerRole);
  if (!authCheck.allowed) {
    logger.warn('approval.review_denied', {
      actionId: input.actionId,
      reviewer: input.reviewerId,
      reason: authCheck.reason,
    });
    return { ok: false, error: authCheck.reason };
  }

  // Update the action
  const [updated] = await db.update(pendingActions)
    .set({
      status: input.decision,
      reviewerId: input.reviewerId,
      reviewerRole: input.reviewerRole,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    })
    .where(eq(pendingActions.id, input.actionId))
    .returning();

  logger.info('approval.reviewed', {
    actionId: input.actionId,
    dealId: action.dealId,
    actionType: action.actionType,
    decision: input.decision,
    reviewer: input.reviewerId,
    initiator: action.initiatorId,
  });

  return { ok: true, action: updated };
}

/**
 * List pending actions for a deal (for the approval queue UI).
 */
export async function listPendingActions(
  db: PostgresJsDatabase,
  dealId: string,
): Promise<PendingActionRow[]> {
  return db.select()
    .from(pendingActions)
    .where(and(
      eq(pendingActions.dealId, dealId),
      eq(pendingActions.status, 'PENDING'),
      gt(pendingActions.expiresAt, new Date()),
    ))
    .orderBy(pendingActions.createdAt);
}

/**
 * Check if an action type requires approval for this deal.
 * Returns true if the action must go through the four-eyes workflow.
 */
export function requiresApproval(actionType: string): boolean {
  const materiality = ACTION_DEFAULT_MATERIALITY[actionType];
  return materiality === 'medium' || materiality === 'high';
}
