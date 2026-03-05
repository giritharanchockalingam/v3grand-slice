import type { FastifyInstance } from 'fastify';

export async function alertRoutes(app: FastifyInstance, db: any) {
  // GET /deals/:id/alerts
  app.get('/deals/:id/alerts', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db.execute(
      `SELECT * FROM alerts WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]
    );
    return rows;
  });

  // POST /deals/:id/alerts
  app.post('/deals/:id/alerts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { type, severity, message, metadata } = req.body as any;
    const alertId = crypto.randomUUID();

    await db.execute(
      `INSERT INTO alerts (id, deal_id, type, severity, message, metadata, acknowledged, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
      [alertId, id, type, severity, message, JSON.stringify(metadata ?? {})]
    );

    return reply.code(201).send({ id: alertId });
  });

  // PATCH /deals/:id/alerts/:alertId/acknowledge
  app.patch('/deals/:id/alerts/:alertId/acknowledge', { preHandler: [app.authenticate] }, async (req) => {
    const { alertId } = req.params as { alertId: string };
    await db.execute(
      `UPDATE alerts SET acknowledged = true, acknowledged_at = NOW() WHERE id = $1`, [alertId]
    );
    return { ok: true };
  });
}
