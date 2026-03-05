import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

export async function dealCreateRoutes(app: FastifyInstance, db: any, natsBus?: any) {
  // POST /deals - create a new deal
  app.post('/deals', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const user = (req as any).user;
    if (!['lead-investor', 'operator', 'admin', 'analyst'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions to create deals' });
    }

    const body = req.body as any;
    const dealId = crypto.randomUUID();

    // Insert deal with normalized columns
    await db.execute(`
      INSERT INTO deals (id, name, status, lifecycle_phase, current_month, version, snapshot, created_at, updated_at)
      VALUES ($1, $2, 'draft', 'pre-investment', 0, 1, $3, NOW(), NOW())
    `, [dealId, body.name, JSON.stringify(body)]);

    // Grant creator access
    await db.execute(`
      INSERT INTO deal_access (id, user_id, deal_id, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [crypto.randomUUID(), user.id, dealId, user.role]);

    // Emit event
    if (natsBus) {
      await natsBus.publish({ type: 'deal.created', dealId, payload: { name: body.name, createdBy: user.id } });
    }

    return reply.code(201).send({ id: dealId, name: body.name, status: 'draft' });
  });

  // PATCH /deals/:id - update deal status/lifecycle
  app.patch('/deals/:id', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string; lifecyclePhase?: string };

    // If setting status to 'active', require at least one risk
    if (body.status === 'active') {
      const risks = await db.execute(`SELECT COUNT(*) as count FROM risks WHERE deal_id = $1`, [id]);
      const riskCount = Number(risks[0]?.count ?? 0);
      if (riskCount === 0) {
        return reply.code(400).send({ error: 'Cannot activate deal without at least one risk entry' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (body.status) { updates.push(`status = $${paramIdx++}`); values.push(body.status); }
    if (body.lifecyclePhase) { updates.push(`lifecycle_phase = $${paramIdx++}`); values.push(body.lifecyclePhase); }
    updates.push(`version = version + 1`);
    updates.push(`updated_at = NOW()`);
    values.push(id);

    await db.execute(`UPDATE deals SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);

    return reply.send({ ok: true });
  });
}
