// ─── Approval Workflow Routes ────────────────────────────────────────
// G-11/F-2: Four-eyes maker-checker workflow API endpoints.

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { authGuard, requireRole } from '../middleware/auth.js';
import {
  createPendingAction, reviewPendingAction, listPendingActions,
} from '../services/approval.js';
import { insertAuditEntry } from '@v3grand/db';

export async function approvalRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── GET /deals/:id/approvals ── (list pending actions for a deal)
  app.get<{ Params: { id: string } }>(
    '/deals/:id/approvals',
    { preHandler: authGuard },
    async (req) => {
      const pending = await listPendingActions(db, req.params.id);
      return { dealId: req.params.id, pending };
    },
  );

  // ── POST /deals/:id/approvals ── (create a pending action)
  app.post<{
    Params: { id: string };
    Body: {
      actionType: string;
      payload: Record<string, unknown>;
      materiality?: 'low' | 'medium' | 'high';
    };
  }>(
    '/deals/:id/approvals',
    { preHandler: authGuard },
    async (req) => {
      const user = (req as any).user;
      const action = await createPendingAction(db, {
        dealId: req.params.id,
        actionType: req.body.actionType,
        initiatorId: user.userId,
        initiatorRole: user.role,
        payload: req.body.payload,
        materiality: req.body.materiality,
      });

      await insertAuditEntry(db, {
        dealId: req.params.id,
        userId: user.userId,
        role: user.role,
        module: 'approvals',
        action: 'approval.requested',
        entityType: 'pending_action',
        entityId: action.id,
        diff: { actionType: req.body.actionType, materiality: action.materiality },
      });

      return { action };
    },
  );

  // ── POST /approvals/:id/review ── (approve or reject a pending action)
  app.post<{
    Params: { id: string };
    Body: { decision: 'APPROVED' | 'REJECTED'; note?: string };
  }>(
    '/approvals/:id/review',
    { preHandler: authGuard },
    async (req, reply) => {
      const user = (req as any).user;
      const result = await reviewPendingAction(db, {
        actionId: req.params.id,
        reviewerId: user.userId,
        reviewerRole: user.role,
        decision: req.body.decision,
        note: req.body.note,
      });

      if (!result.ok) {
        return reply.code(403).send({ error: result.error });
      }

      // Log the review
      if (result.action) {
        await insertAuditEntry(db, {
          dealId: result.action.dealId,
          userId: user.userId,
          role: user.role,
          module: 'approvals',
          action: `approval.${req.body.decision.toLowerCase()}`,
          entityType: 'pending_action',
          entityId: req.params.id,
          diff: { decision: req.body.decision, note: req.body.note },
        });
      }

      return result;
    },
  );
}
