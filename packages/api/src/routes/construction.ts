// ─── Construction Management Routes
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDealById, getBudgetLinesByDeal, createBudgetLine, updateBudgetLine, getChangeOrdersByDeal, createChangeOrder, approveChangeOrder, getChangeOrderById, getRFIsByDeal, createRFI, answerRFI, getRFIById, getMilestonesByDeal, createMilestone, updateMilestone, getMilestoneById, getConstructionSummary, insertAuditEntry } from '@v3grand/db';
import { authGuard, attachUser } from '../middleware/auth.js';
import { recomputeDeal } from '../services/recompute.js';

export async function constructionRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── GET /deals/:id/construction/dashboard ──
  app.get<{ Params: { id: string } }>('/deals/:id/construction/dashboard', { preHandler: attachUser }, async (req, reply) => {
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
    await recomputeDeal(db, id, 'change-order.approved', user.userId);

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
}
