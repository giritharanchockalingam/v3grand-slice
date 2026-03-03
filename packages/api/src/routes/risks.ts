// ─── Risk Register Routes ───────────────────────────────────────────
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  getDealById, getRisksByDeal, getRiskById, createRisk, updateRisk,
  getRiskSummary, insertAuditEntry,
} from '@v3grand/db';
import { authGuard } from '../middleware/auth.js';

export async function riskRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── GET /deals/:id/risks ──
  app.get<{ Params: { id: string } }>('/deals/:id/risks', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const [allRisks, summary] = await Promise.all([
      getRisksByDeal(db, id),
      getRiskSummary(db, id),
    ]);
    return { risks: allRisks, summary };
  });

  // ── POST /deals/:id/risks ──
  app.post<{
    Params: { id: string };
    Body: {
      title: string;
      description: string;
      category: string;
      likelihood: string;
      impact: string;
      mitigation?: string;
      owner?: string;
    };
  }>('/deals/:id/risks', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const { title, description, category, likelihood, impact, mitigation, owner } = req.body;
    if (!title || !description || !category || !likelihood || !impact) {
      return reply.code(400).send({ error: 'title, description, category, likelihood, and impact are required' });
    }

    const risk = await createRisk(db, {
      dealId: id,
      title,
      description,
      category,
      likelihood,
      impact,
      mitigation,
      owner,
      createdBy: user.email ?? user.userId,
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'risk', action: 'risk.created',
      entityType: 'risk', entityId: risk.id,
      diff: { title, category, likelihood, impact },
    });

    return risk;
  });

  // ── PATCH /deals/:id/risks/:riskId ──
  app.patch<{
    Params: { id: string; riskId: string };
    Body: {
      status?: string;
      mitigation?: string;
      likelihood?: string;
      impact?: string;
      owner?: string;
    };
  }>('/deals/:id/risks/:riskId', { preHandler: authGuard }, async (req, reply) => {
    const { id, riskId } = req.params;
    const user = (req as any).user;

    const existing = await getRiskById(db, riskId);
    if (!existing) return reply.code(404).send({ error: 'Risk not found' });
    if (existing.dealId !== id) return reply.code(400).send({ error: 'Risk does not belong to this deal' });

    const updates: Record<string, unknown> = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.mitigation) updates.mitigation = req.body.mitigation;
    if (req.body.likelihood) updates.likelihood = req.body.likelihood;
    if (req.body.impact) updates.impact = req.body.impact;
    if (req.body.owner) updates.owner = req.body.owner;

    const updated = await updateRisk(db, riskId, updates);

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'risk', action: 'risk.updated',
      entityType: 'risk', entityId: riskId,
      diff: updates,
    });

    return updated;
  });
}
