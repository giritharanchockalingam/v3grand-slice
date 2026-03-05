import type { FastifyInstance } from 'fastify';

export async function portfolioRoutes(app: FastifyInstance, db: any) {
  // GET /portfolio/overview - Multi-deal portfolio summary
  app.get('/portfolio/overview', { preHandler: [app.authenticate] }, async (req) => {
    const deals = await db.execute(
      `SELECT d.id, d.property_name, d.lifecycle_phase, d.current_month, d.total_cost_paisa,
              r.verdict, r.confidence,
              (r.proforma_snapshot->>'irr')::numeric AS irr,
              (r.proforma_snapshot->>'npv')::numeric AS npv,
              (r.proforma_snapshot->>'equityMultiple')::numeric AS equity_multiple,
              (r.proforma_snapshot->>'avgDSCR')::numeric AS avg_dscr
       FROM deals d
       LEFT JOIN LATERAL (
         SELECT verdict, confidence, proforma_snapshot
         FROM recommendations WHERE deal_id = d.id ORDER BY version DESC LIMIT 1
       ) r ON true
       ORDER BY d.created_at DESC`
    );

    const totalAUM = deals.reduce((s: number, d: any) => s + (d.total_cost_paisa || 0), 0);
    const weightedIRR = deals.reduce((s: number, d: any) => {
      const weight = (d.total_cost_paisa || 0) / (totalAUM || 1);
      return s + (d.irr || 0) * weight;
    }, 0);

    const byVerdict = deals.reduce((acc: Record<string, number>, d: any) => {
      const v = d.verdict || 'UNKNOWN';
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});

    const byPhase = deals.reduce((acc: Record<string, number>, d: any) => {
      const p = d.lifecycle_phase || 'Unknown';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    return {
      portfolio: {
        totalDeals: deals.length,
        totalAUM,
        weightedIRR,
        averageConfidence: deals.length > 0
          ? deals.reduce((s: number, d: any) => s + (d.confidence || 0), 0) / deals.length
          : 0,
        byVerdict,
        byPhase,
      },
      deals: deals.map((d: any) => ({
        id: d.id,
        propertyName: d.property_name,
        phase: d.lifecycle_phase,
        currentMonth: d.current_month,
        verdict: d.verdict,
        confidence: d.confidence,
        irr: d.irr,
        npv: d.npv,
        equityMultiple: d.equity_multiple,
        dscr: d.avg_dscr,
      })),
    };
  });

  // GET /portfolio/risk-heatmap - Cross-deal risk view
  app.get('/portfolio/risk-heatmap', { preHandler: [app.authenticate] }, async (req) => {
    const risks = await db.execute(
      `SELECT d.id AS deal_id, d.property_name,
              r.gate_results, r.verdict, r.confidence
       FROM deals d
       LEFT JOIN LATERAL (
         SELECT gate_results, verdict, confidence
         FROM recommendations WHERE deal_id = d.id ORDER BY version DESC LIMIT 1
       ) r ON true`
    );

    return {
      heatmap: risks.map((r: any) => {
        const gates = r.gate_results || [];
        const failedGates = Array.isArray(gates) ? gates.filter((g: any) => !g.passed) : [];
        return {
          dealId: r.deal_id,
          propertyName: r.property_name,
          verdict: r.verdict,
          confidence: r.confidence,
          failedGateCount: failedGates.length,
          totalGateCount: Array.isArray(gates) ? gates.length : 0,
          riskLevel: failedGates.length === 0 ? 'LOW'
            : failedGates.length <= 2 ? 'MEDIUM'
            : failedGates.length <= 4 ? 'HIGH'
            : 'CRITICAL',
          failedGateNames: failedGates.map((g: any) => g.name),
        };
      }),
    };
  });

  // GET /portfolio/comparison - Side-by-side deal comparison
  app.get('/portfolio/comparison', { preHandler: [app.authenticate] }, async (req) => {
    const { dealIds } = req.query as { dealIds?: string };
    if (!dealIds) return { error: 'Provide dealIds as comma-separated query param' };

    const ids = dealIds.split(',').map(id => id.trim());
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

    const deals = await db.execute(
      `SELECT d.id, d.property_name, d.lifecycle_phase,
              r.verdict, r.confidence, r.gate_results, r.proforma_snapshot
       FROM deals d
       LEFT JOIN LATERAL (
         SELECT verdict, confidence, gate_results, proforma_snapshot
         FROM recommendations WHERE deal_id = d.id ORDER BY version DESC LIMIT 1
       ) r ON true
       WHERE d.id IN (${placeholders})`, ids
    );

    return {
      comparison: deals.map((d: any) => ({
        id: d.id,
        propertyName: d.property_name,
        phase: d.lifecycle_phase,
        verdict: d.verdict,
        confidence: d.confidence,
        metrics: d.proforma_snapshot || {},
        gatePassRate: Array.isArray(d.gate_results)
          ? d.gate_results.filter((g: any) => g.passed).length / d.gate_results.length
          : 0,
      })),
    };
  });
}
