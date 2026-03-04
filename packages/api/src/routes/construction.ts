// ─── Construction Management Routes
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger } from '@v3grand/core';
import { getDealById, getBudgetLinesByDeal, createBudgetLine, updateBudgetLine, getChangeOrdersByDeal, createChangeOrder, approveChangeOrder, getChangeOrderById, getRFIsByDeal, createRFI, answerRFI, getRFIById, getMilestonesByDeal, createMilestone, updateMilestone, getMilestoneById, getConstructionSummary, insertAuditEntry } from '@v3grand/db';
import { authGuard, attachUser } from '../middleware/auth.js';
import { recomputeDeal } from '../services/recompute.js';
import { emitDealEvent } from '../sse-hub.js';
import type { NatsEventBus } from '../nats-event-bus.js';

export async function constructionRoutes(app: FastifyInstance, db: PostgresJsDatabase, natsBus?: NatsEventBus | null) {

  // ── GET /deals/:id/construction/dashboard ──
  app.get<{ Params: { id: string } }>('/deals/:id/construction/dashboard', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });
    const [budgetLines, changeOrders, rfis, milestones, summary] = await Promise.all([
      getBudgetLinesByDeal(db, id), getChangeOrdersByDeal(db, id), getRFIsByDeal(db, id), getMilestonesByDeal(db, id), getConstructionSummary(db, id),
    ]);
    return { budgetLines, changeOrders, rfis, milestones, summary };
  });

  // ── POST /deals/:id/construction/change-orders ──
  app.post<{
    Params: { id: string };
    Body: { budgetLineId: string; title: string; description: string; amount: number };
  }>('/deals/:id/construction/change-orders', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const { budgetLineId, title, description, amount } = req.body;
    if (!budgetLineId || !title || amount == null) {
      return reply.code(400).send({ error: 'budgetLineId, title, and amount are required' });
    }

    // Auto-generate CO number
    const existingCOs = await getChangeOrdersByDeal(db, id);
    const coNumber = `CO-${String(existingCOs.length + 1).padStart(3, '0')}`;

    const co = await createChangeOrder(db, {
      dealId: id,
      budgetLineId,
      coNumber,
      title,
      description: description ?? '',
      amount,
      requestedBy: user.email ?? user.userId,
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'change-order.created',
      entityType: 'change_order', entityId: co.id,
      diff: { coNumber, title, amount },
    });

    emitDealEvent(id, 'construction.co.created', { coNumber, title, amount });

    return co;
  });

  // ── PATCH /deals/:id/construction/change-orders/:coId/approve ──
  app.patch<{
    Params: { id: string; coId: string };
  }>('/deals/:id/construction/change-orders/:coId/approve', { preHandler: authGuard }, async (req, reply) => {
    const { id, coId } = req.params;
    const user = (req as any).user;

    // Only lead-investor and operator can approve COs
    if (!['lead-investor', 'operator'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions to approve change orders' });
    }

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const existing = await getChangeOrderById(db, coId);
    if (!existing) return reply.code(404).send({ error: 'Change order not found' });
    if (existing.status === 'approved') return reply.code(400).send({ error: 'Change order already approved' });
    if (existing.status === 'rejected') return reply.code(400).send({ error: 'Change order was rejected' });

    const co = await approveChangeOrder(db, coId, user.email ?? user.userId);

    // Update the budget line with the approved CO amount
    const budgetLine = await getBudgetLinesByDeal(db, id);
    const targetLine = budgetLine.find(l => l.id === co.budgetLineId);
    if (targetLine) {
      const newApprovedCOs = parseFloat(targetLine.approvedCOs as string) + parseFloat(co.amount as string);
      const newCurrentBudget = parseFloat(targetLine.originalAmount as string) + newApprovedCOs;
      await updateBudgetLine(db, targetLine.id, {
        approvedCOs: newApprovedCOs,
        currentBudget: newCurrentBudget,
      });
    }

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'change-order.approved',
      entityType: 'change_order', entityId: co.id,
      diff: { coNumber: co.coNumber, amount: co.amount },
    });

    // Trigger recompute after budget change
    try {
      await recomputeDeal(db, id, 'change-order.approved', user.userId);
    } catch (err) {
      logger.error('construction.recompute_after_co.failed', { dealId: id, error: String(err) });
      // CO is already approved — don't fail the request, just log
    }

    if (natsBus) {
      await natsBus.publish({
        type: 'change-order.approved',
        dealId: id,
        coId,
        coNumber: co.coNumber,
        amount: parseFloat(co.amount as string),
        approvedBy: user.userId,
        userId: user.userId,
      });
    }

    return co;
  });

  // ── POST /deals/:id/construction/rfis ──
  app.post<{
    Params: { id: string };
    Body: { subject: string; question: string };
  }>('/deals/:id/construction/rfis', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const { subject, question } = req.body;
    if (!subject || !question) {
      return reply.code(400).send({ error: 'subject and question are required' });
    }

    // Auto-generate RFI number
    const existingRFIs = await getRFIsByDeal(db, id);
    const rfiNumber = `RFI-${String(existingRFIs.length + 1).padStart(3, '0')}`;

    const rfi = await createRFI(db, {
      dealId: id,
      rfiNumber,
      subject,
      question,
      raisedBy: user.email ?? user.userId,
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'rfi.created',
      entityType: 'rfi', entityId: rfi.id,
      diff: { rfiNumber, subject },
    });

    return rfi;
  });

  // ── GET /deals/:id/construction/milestones ──
  app.get<{ Params: { id: string } }>('/deals/:id/construction/milestones', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const milestoneList = await getMilestonesByDeal(db, id);
    return { dealId: id, milestones: milestoneList };
  });

  // ── POST /deals/:id/construction/milestones ──
  app.post<{
    Params: { id: string };
    Body: {
      name: string;
      description: string;
      targetDate: string;
      status?: string;
      percentComplete?: number;
      dependencies?: string[];
    };
  }>('/deals/:id/construction/milestones', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const { name, description, targetDate, status, percentComplete, dependencies } = req.body;
    if (!name || !description || !targetDate) {
      return reply.code(400).send({ error: 'name, description, and targetDate are required' });
    }

    const milestone = await createMilestone(db, {
      dealId: id,
      name,
      description,
      targetDate,
      status: status ?? 'not-started',
      percentComplete: percentComplete ?? 0,
      dependencies: dependencies ?? [],
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'milestone.created',
      entityType: 'milestone', entityId: milestone.id,
      diff: { name, targetDate, status: status ?? 'not-started' },
    });

    return milestone;
  });

  // ── PATCH /deals/:id/construction/milestones/:milestoneId ──
  app.patch<{
    Params: { id: string; milestoneId: string };
    Body: {
      actualDate?: string;
      status?: string;
      percentComplete?: number;
    };
  }>('/deals/:id/construction/milestones/:milestoneId', { preHandler: authGuard }, async (req, reply) => {
    const { id, milestoneId } = req.params;
    const user = (req as any).user;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const existing = await getMilestoneById(db, milestoneId);
    if (!existing) return reply.code(404).send({ error: 'Milestone not found' });
    if (existing.dealId !== id) return reply.code(400).send({ error: 'Milestone does not belong to this deal' });

    const updates: Record<string, unknown> = {};
    if (req.body.actualDate !== undefined) updates.actualDate = req.body.actualDate;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.percentComplete !== undefined) updates.percentComplete = req.body.percentComplete;

    const updated = await updateMilestone(db, milestoneId, updates);

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'milestone.updated',
      entityType: 'milestone', entityId: milestoneId,
      diff: updates,
    });

    // Trigger recompute if in construction phase and milestone status changed
    if (deal.lifecyclePhase === 'construction' && req.body.status !== undefined) {
      try {
        await recomputeDeal(db, id, 'milestone.updated', user.userId);
      } catch (err) {
        logger.error('construction.recompute_after_milestone.failed', { dealId: id, error: String(err) });
      }
    }

    return updated;
  });

  // ── GET /deals/:id/construction/budget-lines ──
  app.get<{ Params: { id: string } }>('/deals/:id/construction/budget-lines', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const lines = await getBudgetLinesByDeal(db, id);
    return { dealId: id, budgetLines: lines };
  });

  // ── PATCH /deals/:id/construction/budget-lines/:lineId ──
  app.patch<{
    Params: { id: string; lineId: string };
    Body: {
      actualSpend?: number;
      commitments?: number;
      forecast?: number;
    };
  }>('/deals/:id/construction/budget-lines/:lineId', { preHandler: authGuard }, async (req, reply) => {
    const { id, lineId } = req.params;
    const user = (req as any).user;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const existing = await getBudgetLinesByDeal(db, id);
    const line = existing.find(l => l.id === lineId);
    if (!line) return reply.code(404).send({ error: 'Budget line not found' });

    const updates: Record<string, unknown> = {};
    if (req.body.actualSpend !== undefined) updates.actualSpend = String(req.body.actualSpend);
    if (req.body.commitments !== undefined) updates.commitments = String(req.body.commitments);
    if (req.body.forecast !== undefined) {
      // forecast is a calculated field, we can use it to update commitments or actualSpend
      updates.commitments = String(req.body.forecast);
    }

    const updated = await updateBudgetLine(db, lineId, updates);

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'construction', action: 'budget-line.updated',
      entityType: 'budget_line', entityId: lineId,
      diff: updates,
    });

    // Trigger recompute if in construction phase
    if (deal.lifecyclePhase === 'construction') {
      try {
        await recomputeDeal(db, id, 'budget-line.updated', user.userId);
      } catch (err) {
        logger.error('construction.recompute_after_budget_line.failed', { dealId: id, error: String(err) });
      }
    }

    return updated;
  });
}
