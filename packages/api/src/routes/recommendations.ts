import type { FastifyInstance } from 'fastify';

export async function recommendationRoutes(app: FastifyInstance, db: any) {
  // GET /deals/:id/recommendations/history
  app.get('/deals/:id/recommendations/history', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db.execute(
      `SELECT id, deal_id, version, scenario, verdict, confidence,
              gate_results, proforma_snapshot, created_at
       FROM recommendations
       WHERE deal_id = $1
       ORDER BY version DESC`,
      [id]
    );
    return rows.map((r: any) => ({
      version: r.version,
      scenario: r.scenario,
      verdict: r.verdict,
      confidence: r.confidence,
      irr: r.proforma_snapshot?.irr,
      npv: r.proforma_snapshot?.npv,
      equityMultiple: r.proforma_snapshot?.equityMultiple,
      gateResults: r.gate_results,
      createdAt: r.created_at,
    }));
  });
}
