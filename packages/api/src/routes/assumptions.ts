// ─── IAIP: Assumption governance (FEATURE E — AGAT) ─────────────────
// GET/PATCH/POST for deal assumptions; workflow: draft → reviewed → approved → locked.

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  listAssumptionsByDeal,
  getAssumption,
  upsertAssumption,
  updateAssumptionStatus,
  getDealById,
  checkDealAccess,
  insertAuditEntry,
} from '@v3grand/db';
import { authGuard } from '../middleware/auth.js';

const VALID_STATUSES = ['draft', 'reviewed', 'approved', 'locked'] as const;

export async function assumptionRoutes(app: FastifyInstance, db: PostgresJsDatabase) {
  app.get<{ Params: { id: string } }>('/deals/:id/assumptions', { preHandler: authGuard }, async (req, reply) => {
    const user = (req as any).user;
    const access = await checkDealAccess(db, user.userId, req.params.id);
    if (!access) return reply.code(403).send({ error: 'No access to this deal' });
    const list = await listAssumptionsByDeal(db, req.params.id);
    return { assumptions: list };
  });

  app.patch<{
    Params: { id: string; key: string };
    Body: { value?: unknown; unit?: string; rationale?: string; source?: string; confidence?: number; status?: string };
  }>('/deals/:id/assumptions/:key', { preHandler: authGuard }, async (req, reply) => {
    const { id, key } = req.params;
    const user = (req as any).user;
    const access = await checkDealAccess(db, user.userId, id);
    if (!access) return reply.code(403).send({ error: 'No access to this deal' });
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });
    const existing = await getAssumption(db, id, key);
    const body = req.body || {};
    if (body.status && !VALID_STATUSES.includes(body.status as any)) {
      return reply.code(400).send({ error: 'Invalid status', valid: VALID_STATUSES });
    }
    if (existing?.status === 'locked') {
      return reply.code(400).send({ error: 'Assumption is locked for IC' });
    }
    const row = await upsertAssumption(db, id, {
      assumptionKey: key,
      value: body.value !== undefined ? body.value : (existing as any)?.value,
      unit: body.unit ?? existing?.unit,
      owner: user.name || user.userId,
      rationale: body.rationale !== undefined ? body.rationale : existing?.rationale ?? undefined,
      source: body.source !== undefined ? body.source : existing?.source ?? undefined,
      confidence: body.confidence !== undefined ? body.confidence : existing?.confidence != null ? Number(existing.confidence) : undefined,
      status: body.status ? (body.status as 'draft' | 'reviewed' | 'approved' | 'locked') : (existing?.status ?? 'draft'),
    });
    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'assumptions', action: 'assumption.updated',
      entityType: 'assumption', entityId: row.id,
      diff: { key, value: body.value, status: body.status },
    });
    return row;
  });

  app.post<{
    Params: { id: string; key: string };
    Body: { status: string; note?: string };
  }>('/deals/:id/assumptions/:key/approve', { preHandler: authGuard }, async (req, reply) => {
    const { id, key } = req.params;
    const user = (req as any).user;
    const access = await checkDealAccess(db, user.userId, id);
    if (!access) return reply.code(403).send({ error: 'No access to this deal' });
    const existing = await getAssumption(db, id, key);
    if (!existing) return reply.code(404).send({ error: 'Assumption not found' });
    if (existing.status === 'locked') return reply.code(400).send({ error: 'Assumption is locked' });
    const status = (req.body?.status || 'approved') as 'draft' | 'reviewed' | 'approved' | 'locked';
    if (!VALID_STATUSES.includes(status)) return reply.code(400).send({ error: 'Invalid status', valid: VALID_STATUSES });
    const row = await updateAssumptionStatus(db, id, key, status, user.name || user.userId);
    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'assumptions', action: 'assumption.approve',
      entityType: 'assumption', entityId: existing.id,
      diff: { key, status, note: req.body?.note },
    });
    return row;
  });
}
