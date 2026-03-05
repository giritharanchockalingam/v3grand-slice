// ─── IAIP: Reports — IC memo generate (FEATURE E) ───────────────────
// POST /reports/ic-memo/generate — build IC memo payload.

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDealById, getLatestRecommendationByScenario, getLatestEngineResultByScenario, getRecentAudit, listAssumptionsByDeal } from '@v3grand/db';
import { authGuard } from '../middleware/auth.js';

export async function reportsRoutes(app: FastifyInstance, db: PostgresJsDatabase) {
  app.post<{
    Body: { dealId: string; scenarioKey?: string; includeAuditTrail?: boolean };
  }>('/reports/ic-memo/generate', { preHandler: authGuard }, async (req, reply) => {
    const user = (req as any).user;
    const { dealId, scenarioKey = 'base', includeAuditTrail = true } = req.body || {};
    if (!dealId) return reply.code(400).send({ error: 'dealId required' });

    const deal = await getDealById(db, dealId);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const sk = (scenarioKey === 'bear' || scenarioKey === 'bull' ? scenarioKey : 'base') as 'bear' | 'base' | 'bull';
    const [rec, proformaResult, audit, assumptionList] = await Promise.all([
      getLatestRecommendationByScenario(db, dealId, sk),
      getLatestEngineResultByScenario(db, dealId, 'underwriter', sk),
      includeAuditTrail ? getRecentAudit(db, dealId, 50) : Promise.resolve([]),
      listAssumptionsByDeal(db, dealId),
    ]);

    const proforma = proformaResult?.output as Record<string, unknown> | undefined;
    const captureContext = (deal as any).captureContext;
    const gateResults = Array.isArray((rec as any)?.gateResults) ? (rec as any).gateResults : [];
    const memo = {
      title: `Investment Committee Memo — ${deal.name}`,
      dealId,
      scenarioKey,
      generatedAt: new Date().toISOString(),
      generatedBy: user.name || user.userId,
      thesis: captureContext?.strategicIntent || 'Investment opportunity under review.',
      market: {
        assetClass: deal.assetClass,
        lifecyclePhase: deal.lifecyclePhase,
        property: deal.property,
      },
      outputs: proforma ? {
        irr: proforma.irr,
        npv: proforma.npv,
        equityMultiple: proforma.equityMultiple,
        paybackYear: proforma.paybackYear,
        dscr: proforma.avgDSCR,
      } : null,
      recommendation: rec ? { verdict: rec.verdict, confidence: rec.confidence, explanation: rec.explanation } : null,
      boardCriteria: gateResults.map((g: any) => ({ name: g.name, threshold: g.threshold, actual: g.actual, passed: g.passed })),
      assumptions: assumptionList.map((a: any) => ({ key: a.assumptionKey, value: a.value, status: a.status, source: a.source })),
      auditTrail: includeAuditTrail ? audit : undefined,
    };

    return {
      reportId: `${dealId}-ic-memo-${Date.now()}`,
      generatedAt: memo.generatedAt,
      memo,
      hint: 'Export to PDF/Doc from UI using this payload.',
    };
  });
}
