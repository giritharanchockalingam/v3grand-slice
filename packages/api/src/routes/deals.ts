// ─── Fastify Routes: Deal CRUD + Engine Triggers + Dashboard ────────
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DealDashboardView, RecommendationState, ProFormaOutput } from '@v3grand/core';
import { logger } from '@v3grand/core';
import {
  getDealById, updateDealAssumptions, updateDealActiveScenario,
  listDeals, listDealsByUser, checkDealAccess,
  getLatestEngineResult, getLatestRecommendation, getRecentAudit,
  getLatestEngineResultByScenario, getScenarioResults, getScenarioRecommendations,
  insertAuditEntry, getConstructionSummary,
} from '@v3grand/db';
import { recommendations } from '@v3grand/db';
import { eq, desc } from 'drizzle-orm';
import { recomputeDeal } from '../services/recompute.js';
import { authGuard, attachUser } from '../middleware/auth.js';

export async function dealRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── GET /deals ── (list deals this user has access to)
  app.get('/deals', { preHandler: authGuard }, async (req, reply) => {
    const user = (req as any).user;
    const deals = await listDealsByUser(db, user.userId);
    return deals;
  });

  // ── GET /deals/:id ── (with access check)
  app.get<{ Params: { id: string } }>('/deals/:id', { preHandler: authGuard }, async (req, reply) => {
    const user = (req as any).user;
    const access = await checkDealAccess(db, user.userId, req.params.id);
    if (!access) return reply.code(403).send({ error: 'No access to this deal' });

    const deal = await getDealById(db, req.params.id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });
    return deal;
  });

  // ── PATCH /deals/:id/assumptions ──
  // Update market or financial assumptions, then trigger recompute.
  app.patch<{
    Params: { id: string };
    Body: {
      marketAssumptions?: Record<string, unknown>;
      financialAssumptions?: Record<string, unknown>;
    };
  }>('/deals/:id/assumptions', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    // Merge patch into existing assumptions
    const updatedMarket = req.body.marketAssumptions
      ? { ...(deal.marketAssumptions as object), ...req.body.marketAssumptions }
      : undefined;
    const updatedFinancial = req.body.financialAssumptions
      ? { ...(deal.financialAssumptions as object), ...req.body.financialAssumptions }
      : undefined;

    await updateDealAssumptions(db, id, {
      marketAssumptions: updatedMarket,
      financialAssumptions: updatedFinancial,
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'assumptions', action: 'assumption.updated',
      entityType: 'deal', entityId: id,
      diff: { market: req.body.marketAssumptions, financial: req.body.financialAssumptions },
    });

    // Trigger recompute: Underwriter → Decision → persist (all scenarios)
    try {
      const result = await recomputeDeal(db, id, 'assumption.updated', user.userId);

      if (!result.ok || !result.proforma) {
        logger.warn('recompute.partial_failure', { dealId: id, trigger: 'assumption.updated' });
        return reply.code(207).send({
          message: 'Assumptions saved but recompute partially failed — prior results preserved',
          error: result.error,
          recommendation: result.recommendation,
          proforma: result.proforma ? {
            irr: result.proforma.irr,
            npv: result.proforma.npv,
            equityMultiple: result.proforma.equityMultiple,
          } : null,
        });
      }

      return {
        message: 'Assumptions updated and engines recomputed',
        recommendation: result.recommendation,
        proforma: {
          irr: result.proforma.irr,
          npv: result.proforma.npv,
          equityMultiple: result.proforma.equityMultiple,
        },
      };
    } catch (err) {
      logger.error('route.assumptions.recompute_crash', { dealId: id, error: String(err) });
      return reply.code(500).send({
        message: 'Assumptions saved but recompute failed',
        error: 'Engine cascade crashed — prior results preserved',
      });
    }
  });

  // ── POST /deals/:id/underwrite ──
  // Manual trigger: run Underwriter + Decision for all scenarios.
  app.post<{ Params: { id: string } }>('/deals/:id/underwrite', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    try {
      const result = await recomputeDeal(db, id, 'api.manual', user.userId);
      if (!result.ok) {
        return reply.code(207).send({ ...result, message: 'Recompute partially failed — prior results preserved' });
      }
      return result;
    } catch (err) {
      logger.error('route.underwrite.crash', { dealId: id, error: String(err) });
      return reply.code(500).send({ error: 'Engine cascade crashed', ok: false });
    }
  });

  // ── GET /deals/:id/dashboard ──
  // Aggregated view for the Deal Dashboard screen (base scenario).
  app.get<{ Params: { id: string } }>('/deals/:id/dashboard', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const [latestUW, latestRec, audit, constructionSummary] = await Promise.all([
      getLatestEngineResultByScenario(db, id, 'underwriter', 'base'),
      getLatestRecommendation(db, id),
      getRecentAudit(db, id, 15),
      getConstructionSummary(db, id),
    ]);

    // Fetch recommendation history (latest 10 versions)
    const recHistory = await db.select()
      .from(recommendations)
      .where(eq(recommendations.dealId, id))
      .orderBy(desc(recommendations.version))
      .limit(10);

    const latestProforma = latestUW
      ? (latestUW.output as unknown as ProFormaOutput)
      : null;

    const latestRecommendation: RecommendationState | null = latestRec
      ? {
          id: latestRec.id,
          dealId: latestRec.dealId,
          version: latestRec.version,
          timestamp: latestRec.createdAt.toISOString(),
          verdict: latestRec.verdict as RecommendationState['verdict'],
          confidence: latestRec.confidence,
          triggerEvent: latestRec.triggerEvent,
          proformaSnapshot: latestRec.proformaSnapshot as RecommendationState['proformaSnapshot'],
          gateResults: latestRec.gateResults as RecommendationState['gateResults'],
          explanation: latestRec.explanation,
          previousVerdict: latestRec.previousVerdict as RecommendationState['previousVerdict'],
          isFlip: latestRec.isFlip === 'true',
        }
      : null;

    const view: DealDashboardView = {
      deal: {
        id: dealRow.id,
        name: dealRow.name,
        assetClass: dealRow.assetClass as 'hotel',
        status: dealRow.status as DealDashboardView['deal']['status'],
        lifecyclePhase: dealRow.lifecyclePhase as DealDashboardView['deal']['lifecyclePhase'],
        currentMonth: dealRow.currentMonth,
      },
      property: dealRow.property as DealDashboardView['property'],
      partnership: dealRow.partnership as DealDashboardView['partnership'],
      latestRecommendation,
      latestProforma,
      constructionSummary: constructionSummary ?? null,
      recentAudit: audit.map(a => ({
        action: a.action,
        module: a.module,
        timestamp: a.timestamp.toISOString(),
        userId: a.userId,
      })),
      recommendationHistory: recHistory.map(r => ({
        version: r.version,
        verdict: r.verdict as RecommendationState['verdict'],
        confidence: r.confidence,
        timestamp: r.createdAt.toISOString(),
      })),
    };

    return view;
  });

  // ── GET /deals/:id/scenarios ──
  // Returns all 3 scenario results (bear, base, bull)
  app.get<{ Params: { id: string } }>('/deals/:id/scenarios', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const [uwResults, recResults] = await Promise.all([
      getScenarioResults(db, id, 'underwriter'),
      getScenarioRecommendations(db, id),
    ]);

    const formatProforma = (uw: any) => uw
      ? (uw.output as unknown as ProFormaOutput)
      : null;

    const formatRecommendation = (rec: any) => rec
      ? {
          id: rec.id,
          dealId: rec.dealId,
          version: rec.version,
          timestamp: rec.createdAt.toISOString(),
          verdict: rec.verdict as RecommendationState['verdict'],
          confidence: rec.confidence,
          triggerEvent: rec.triggerEvent,
          proformaSnapshot: rec.proformaSnapshot as RecommendationState['proformaSnapshot'],
          gateResults: rec.gateResults as RecommendationState['gateResults'],
          explanation: rec.explanation,
          previousVerdict: rec.previousVerdict as RecommendationState['previousVerdict'],
          isFlip: rec.isFlip === 'true',
        }
      : null;

    return {
      dealId: id,
      activeScenario: dealRow.activeScenarioKey,
      scenarios: {
        bear: {
          scenarioKey: 'bear',
          proforma: formatProforma(uwResults.bear),
          recommendation: formatRecommendation(recResults.bear),
        },
        base: {
          scenarioKey: 'base',
          proforma: formatProforma(uwResults.base),
          recommendation: formatRecommendation(recResults.base),
        },
        bull: {
          scenarioKey: 'bull',
          proforma: formatProforma(uwResults.bull),
          recommendation: formatRecommendation(recResults.bull),
        },
      },
    };
  });

  // ── PATCH /deals/:id/active-scenario ──
  // Set the active scenario (for promoting a scenario to current)
  app.patch<{
    Params: { id: string };
    Body: { scenarioKey: 'bear' | 'base' | 'bull' };
  }>('/deals/:id/active-scenario', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const { scenarioKey } = req.body;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    await updateDealActiveScenario(db, id, scenarioKey);
    
    await insertAuditEntry(db, {
      dealId: id,
      userId: user.userId,
      role: user.role,
      module: 'scenarios',
      action: 'scenario.promoted',
      entityType: 'deal',
      entityId: id,
      diff: { activeScenarioKey: scenarioKey },
    });

    return { message: 'Active scenario updated', activeScenarioKey: scenarioKey };
  });
}
