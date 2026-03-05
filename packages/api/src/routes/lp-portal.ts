import type { FastifyInstance } from 'fastify';

export async function lpPortalRoutes(app: FastifyInstance, db: any) {
  // GET /lp/dashboard - LP dashboard overview
  app.get('/lp/dashboard', { preHandler: [app.authenticate] }, async (req) => {
    const user = (req as any).user;
    if (!['lp', 'investor', 'admin'].includes(user.role)) {
      return { error: 'LP access required' };
    }

    const deals = await db.execute(
      `SELECT d.id, d.property_name, d.lifecycle_phase, d.current_month,
              r.verdict, r.confidence, r.irr, r.npv, r.equity_multiple
       FROM deals d
       LEFT JOIN LATERAL (
         SELECT verdict, confidence,
                (proforma_snapshot->>'irr')::numeric AS irr,
                (proforma_snapshot->>'npv')::numeric AS npv,
                (proforma_snapshot->>'equityMultiple')::numeric AS equity_multiple
         FROM recommendations
         WHERE deal_id = d.id
         ORDER BY version DESC LIMIT 1
       ) r ON true
       WHERE d.id IN (
         SELECT deal_id FROM deal_investors WHERE investor_id = $1
       )
       ORDER BY d.created_at DESC`,
      [user.id]
    );

    return {
      investorId: user.id,
      portfolio: deals,
      summary: {
        totalDeals: deals.length,
        averageIRR: deals.length > 0
          ? deals.reduce((s: number, d: any) => s + (d.irr || 0), 0) / deals.length
          : 0,
        totalNPV: deals.reduce((s: number, d: any) => s + (d.npv || 0), 0),
      },
    };
  });

  // GET /lp/deals/:id/quarterly-report
  app.get('/lp/deals/:id/quarterly-report', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const deal = await db.execute(
      `SELECT d.*, r.verdict, r.confidence, r.gate_results, r.proforma_snapshot
       FROM deals d
       LEFT JOIN LATERAL (
         SELECT verdict, confidence, gate_results, proforma_snapshot
         FROM recommendations WHERE deal_id = d.id ORDER BY version DESC LIMIT 1
       ) r ON true
       WHERE d.id = $1`, [id]
    );

    if (!deal.length) return { error: 'Deal not found' };

    const alerts = await db.execute(
      `SELECT level, message, created_at FROM alerts
       WHERE deal_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC LIMIT 10`, [id]
    );

    const budgetSummary = await db.execute(
      `SELECT
         SUM(original_amount) AS total_budget,
         SUM(actual_spend) AS total_spend,
         SUM(commitments) AS total_commitments
       FROM budget_lines WHERE deal_id = $1`, [id]
    );

    return {
      deal: deal[0],
      quarterlyAlerts: alerts,
      budgetSummary: budgetSummary[0] || {},
      generatedAt: new Date().toISOString(),
    };
  });

  // GET /lp/capital-calls - Capital call history
  app.get('/lp/capital-calls', { preHandler: [app.authenticate] }, async (req) => {
    const user = (req as any).user;
    const calls = await db.execute(
      `SELECT cc.*, d.property_name
       FROM capital_calls cc
       JOIN deals d ON cc.deal_id = d.id
       WHERE cc.investor_id = $1
       ORDER BY cc.call_date DESC`, [user.id]
    );
    return { capitalCalls: calls };
  });

  // GET /lp/distributions - Distribution history
  app.get('/lp/distributions', { preHandler: [app.authenticate] }, async (req) => {
    const user = (req as any).user;
    const distributions = await db.execute(
      `SELECT dist.*, d.property_name
       FROM distributions dist
       JOIN deals d ON dist.deal_id = d.id
       WHERE dist.investor_id = $1
       ORDER BY dist.distribution_date DESC`, [user.id]
    );
    return { distributions };
  });
}
