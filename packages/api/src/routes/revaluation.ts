import type { FastifyInstance } from 'fastify';
import { recomputeDeal } from '../services/recompute.js';

export async function revaluationRoutes(app: FastifyInstance, db: any) {
  // POST /deals/:id/revalue - advance month and full recompute
  app.post('/deals/:id/revalue', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user;
    if (!['lead-investor', 'admin', 'analyst'].includes(user.role)) {
      return reply.code(403).send({ error: 'Only analysts and admins can run revaluations' });
    }

    const { id } = req.params as { id: string };

    // Advance current_month
    await db.execute(
      `UPDATE deals SET current_month = current_month + 1, updated_at = NOW() WHERE id = $1`, [id]
    );

    // Run full recompute cascade
    const result = await recomputeDeal(db, id, 'revaluation', user.email);

    // Create audit log entry
    await db.execute(
      `INSERT INTO audit_log (id, deal_id, user_id, module, action, diff, created_at)
       VALUES ($1, $2, $3, 'revaluation', 'month.advanced', $4, NOW())`,
      [crypto.randomUUID(), id, user.id, JSON.stringify({ trigger: 'manual', by: user.email })]
    );

    return { ok: true, month: result };
  });
}
