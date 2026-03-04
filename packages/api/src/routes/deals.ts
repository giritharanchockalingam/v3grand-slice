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
  createDeal, updateDealCurrentMonth,
  getRecommendationHistory, getEngineResultHistory,
  grantDealAccess,
} from '@v3grand/db';
import { recommendations } from '@v3grand/db';
import { eq, desc } from 'drizzle-orm';
import { recomputeDeal } from '../services/recompute.js';
import { requiresApproval, createPendingAction } from '../services/approval.js';
import { authGuard, attachUser, requireRole } from '../middleware/auth.js';
import type { NatsEventBus } from '../nats-event-bus.js';

export async function dealRoutes(app: FastifyInstance, db: PostgresJsDatabase, natsBus?: NatsEventBus | null) {

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

    // ── G-11/F-2: Four-eyes approval for material assumption changes ──
    // Check if this change requires approval (based on materiality classification).
    // LOW materiality changes are auto-approved; MEDIUM/HIGH go through review.
    if (requiresApproval('assumption.update')) {
      try {
        const result = await createPendingAction(db, {
          dealId: id,
          actionType: 'assumption.update',
          initiatorId: user.userId,
          initiatorRole: user.role,
          payload: {
            marketAssumptions: req.body.marketAssumptions,
            financialAssumptions: req.body.financialAssumptions,
          },
        });

        // If status is PENDING, the action requires review before proceeding
        if (result.status === 'PENDING') {
          return reply.code(202).send({
            message: 'Assumption change requires approval — pending review',
            approvalId: result.id,
            materiality: result.materiality,
            expiresAt: result.expiresAt,
          });
        }
        // If AUTO_APPROVED (LOW materiality), fall through to apply changes immediately
      } catch (err) {
        logger.warn('deals.assumptions.approval_check_failed', { dealId: id, error: String(err) });
        // On approval service failure, fall through to apply changes directly (fail-open for availability)
      }
    }

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

      if (natsBus) {
        await natsBus.publish({
          type: 'assumption.updated',
          dealId: id,
          userId: user.userId,
          field: 'assumptions',
          oldValue: undefined,
          newValue: req.body,
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

    // Fetch ALL engine results in parallel — not just underwriter
    const [latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestSCurveResult, latestDecisionResult, audit, constructionSummary] = await Promise.all([
      getLatestEngineResultByScenario(db, id, 'underwriter', 'base'),
      getLatestRecommendation(db, id),
      getLatestEngineResult(db, id, 'montecarlo'),
      getLatestEngineResult(db, id, 'factor'),
      getLatestEngineResult(db, id, 'budget'),
      getLatestEngineResult(db, id, 'scurve'),
      getLatestEngineResult(db, id, 'decision'),
      getRecentAudit(db, id, 50),
      getConstructionSummary(db, id),
    ]);

    // Fetch recommendation history (latest 20 versions)
    const recHistory = await db.select()
      .from(recommendations)
      .where(eq(recommendations.dealId, id))
      .orderBy(desc(recommendations.version))
      .limit(20);

    const latestProforma = latestUW
      ? (() => {
          const output = latestUW.output as unknown as ProFormaOutput;
          return {
            scenarioKey: output.scenarioKey,
            years: output.years,
            irr: output.irr,
            npv: output.npv,
            equityMultiple: output.equityMultiple,
            avgDSCR: output.avgDSCR,
            paybackYear: output.paybackYear,
            exitValue: output.exitValue,
            totalInvestment: output.totalInvestment,
            equityInvestment: output.equityInvestment,
          };
        })()
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

    // Extract real MC output
    const latestMC = latestMCResult
      ? (latestMCResult.output as any)
      : null;

    // Extract real Factor output
    const latestFactor = latestFactorResult
      ? (latestFactorResult.output as any)
      : null;

    // Extract real Budget output
    const latestBudget = latestBudgetResult
      ? (latestBudgetResult.output as any)
      : null;

    // Extract real S-Curve output
    const latestSCurve = latestSCurveResult
      ? (latestSCurveResult.output as any)
      : null;

    // Build construction progress from summary
    const constructionProgress = constructionSummary
      ? {
          totalBudget: constructionSummary.totalBudget,
          actualSpend: constructionSummary.totalActualSpend,
          commitments: constructionSummary.totalCommitments,
          approvedCOs: constructionSummary.totalApprovedCOs,
          variance: constructionSummary.budgetVariance,
          completionPct: constructionSummary.completionPct,
        }
      : null;

    // Transform audit entries into meaningful events with severity
    const recentEvents = audit.map(a => {
      let severity: 'info' | 'warning' | 'critical' = 'info';
      if (a.action.includes('failed') || a.action.includes('crash')) severity = 'critical';
      else if (a.action.includes('flip') || a.action.includes('overrun') || a.action.includes('delayed')) severity = 'warning';

      return {
        id: a.id,
        type: a.action,
        timestamp: a.timestamp.toISOString(),
        description: `${a.module}: ${a.action}`,
        module: a.module,
        severity,
        userId: a.userId,
        diff: a.diff,
      };
    });

    const view = {
      deal: {
        id: dealRow.id,
        name: dealRow.name,
        assetClass: dealRow.assetClass as 'hotel',
        status: dealRow.status,
        lifecyclePhase: dealRow.lifecyclePhase,
        currentMonth: dealRow.currentMonth,
        version: dealRow.version,
      },
      property: dealRow.property,
      partnership: dealRow.partnership,
      marketAssumptions: dealRow.marketAssumptions,
      financialAssumptions: dealRow.financialAssumptions,
      capexPlan: dealRow.capexPlan,
      latestRecommendation,
      latestProforma,
      latestMC,
      latestFactor,
      latestBudget,
      latestSCurve,
      budgetSummary: latestBudget ? {
        overallStatus: latestBudget.overallStatus,
        varianceToCurrent: latestBudget.varianceToCurrent,
        alerts: latestBudget.alerts ?? [],
      } : null,
      constructionProgress,
      decisionInsight: latestDecisionResult
        ? (() => {
            const d = latestDecisionResult.output as any;
            return {
              narrative: d.narrative ?? '',
              topDrivers: d.topDrivers ?? [],
              topRisks: d.topRisks ?? [],
              flipConditions: d.flipConditions ?? [],
              riskFlags: d.riskFlags ?? [],
            };
          })()
        : null,
      recentEvents,
      recommendationHistory: recHistory.map(r => ({
        version: r.version,
        verdict: r.verdict as RecommendationState['verdict'],
        confidence: r.confidence,
        timestamp: r.createdAt.toISOString(),
        scenarioKey: r.scenarioKey,
        explanation: r.explanation,
        previousVerdict: r.previousVerdict,
        isFlip: r.isFlip === 'true',
        gateResults: r.gateResults,
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

    // ── G-11/F-2: Four-eyes approval for scenario promotions ──
    if (requiresApproval('scenario.promote')) {
      try {
        const result = await createPendingAction(db, {
          dealId: id,
          actionType: 'scenario.promote',
          initiatorId: user.userId,
          initiatorRole: user.role,
          payload: { scenarioKey },
        });

        if (result.status === 'PENDING') {
          return reply.code(202).send({
            message: 'Scenario promotion requires approval — pending review',
            approvalId: result.id,
            materiality: result.materiality,
            expiresAt: result.expiresAt,
          });
        }
      } catch (err) {
        logger.warn('deals.scenario.approval_check_failed', { dealId: id, error: String(err) });
      }
    }

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

  // ── POST /deals ──
  // Create a new deal — accepts minimal (name + assetClass) or full payload
  app.post<{
    Body: {
      name: string;
      assetClass: string;
      property?: unknown;
      partnership?: unknown;
      marketAssumptions?: unknown;
      financialAssumptions?: unknown;
      capexPlan?: unknown;
      opexModel?: unknown;
      scenarios?: unknown;
    };
  }>('/deals', { preHandler: requireRole('lead-investor', 'admin') }, async (req, reply) => {
    const user = (req as any).user;
    const { name, assetClass } = req.body;

    if (!name || !assetClass) {
      return reply.code(400).send({ error: 'name and assetClass are required' });
    }

    // Default seed template for new deals (overridden by provided values)
    const defaults = {
      property: {
        location: { city: '', state: '', country: 'India', latitude: 0, longitude: 0, distanceToAirportKm: 0 },
        landArea: { sqft: 0, acres: 0 },
        grossBUA: { phase1Sqft: 0, phase2Sqft: 0, totalSqft: 0 },
        keys: { phase1: 0, phase2: 0, total: 0 },
        roomTypes: [],
        amenities: [],
        starRating: 5,
      },
      partnership: {
        structure: 'jv',
        partners: [{ id: 'lead', name: user.email ?? user.userId, equityPct: 1, role: 'lead-investor', commitmentCr: 0 }],
      },
      marketAssumptions: {
        segments: [{ name: 'Domestic Business', pctMix: 0.4, adrPremium: 1.0, seasonality: [1,1,1,0.8,0.7,0.6,0.6,0.7,0.8,1,1.2,1.3] }],
        occupancyRamp: [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72],
        adrBase: 5500, adrStabilized: 7000, adrGrowthRate: 0.05,
        revenueMix: { rooms: 0.55, fb: 0.25, banquet: 0.12, other: 0.08 },
        seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, multiplier: 1.0 })),
        compSet: [],
      },
      financialAssumptions: {
        wacc: 0.12, riskFreeRate: 0.065, equityRatio: 0.4, debtRatio: 0.6,
        debtInterestRate: 0.095, debtTenorYears: 15, exitCapRate: 0.08, exitMultiple: 8,
        taxRate: 0.25, inflationRate: 0.05, managementFeePct: 0.03, incentiveFeePct: 0.10,
        ffAndEReservePct: 0.04, workingCapitalDays: 30,
        targetIRR: 0.18, targetEquityMultiple: 2.5, targetDSCR: 1.2,
      },
      capexPlan: {
        phase1: { totalBudgetCr: 0, items: [] },
        phase2: { totalBudgetCr: 0, items: [] },
        contingencyPct: 0.10,
      },
      opexModel: {
        departments: [], undistributed: [], fixedCharges: [],
      },
      scenarios: {
        bear: { id: 'bear', name: 'bear', probability: 0.25, occupancyStabilized: 0.58, adrStabilized: 5800, ebitdaMargin: 0.28, mouRealizationPct: 0.6, phase2Trigger: false },
        base: { id: 'base', name: 'base', probability: 0.50, occupancyStabilized: 0.72, adrStabilized: 7000, ebitdaMargin: 0.35, mouRealizationPct: 0.75, phase2Trigger: true },
        bull: { id: 'bull', name: 'bull', probability: 0.25, occupancyStabilized: 0.82, adrStabilized: 8200, ebitdaMargin: 0.42, mouRealizationPct: 0.9, phase2Trigger: true },
      },
    };

    // ── Normalize revenue mix keys (form sends "foodBeverage", engine expects "fb") ──
    const rawMarket = req.body.marketAssumptions as any;
    let normalizedMarket = rawMarket ?? defaults.marketAssumptions;
    if (rawMarket?.revenueMix?.foodBeverage !== undefined) {
      normalizedMarket = {
        ...rawMarket,
        revenueMix: {
          rooms: rawMarket.revenueMix.rooms ?? 0.55,
          fb: rawMarket.revenueMix.foodBeverage,
          banquet: rawMarket.revenueMix.banquet ?? 0.12,
          other: rawMarket.revenueMix.other ?? 0.08,
        },
      };
    }

    // ── Auto-estimate CAPEX if not provided (₹1 Cr per key for 4-star, scale by star rating) ──
    const property = (req.body.property ?? defaults.property) as any;
    let capexPlan = req.body.capexPlan ?? defaults.capexPlan;
    const capex = capexPlan as any;
    if (!capex?.phase1?.totalBudgetCr || capex.phase1.totalBudgetCr === 0) {
      const totalKeys = property?.keys?.phase1 ?? 80;
      const starRating = property?.starRating ?? 3;
      const costPerKey = starRating >= 5 ? 1.5 : starRating >= 4 ? 1.0 : 0.7; // Cr per key
      const estimatedBudget = totalKeys * costPerKey;
      capexPlan = {
        phase1: {
          totalBudgetCr: estimatedBudget,
          items: [
            { id: 'land', costCode: 'LAND', description: 'Land Acquisition', budgetAmount: estimatedBudget * 0.15 },
            { id: 'construction', costCode: 'CONST', description: 'Construction', budgetAmount: estimatedBudget * 0.55 },
            { id: 'ffne', costCode: 'FFNE', description: 'FF&E', budgetAmount: estimatedBudget * 0.15 },
            { id: 'softcosts', costCode: 'SOFT', description: 'Soft Costs & Pre-Opening', budgetAmount: estimatedBudget * 0.15 },
          ],
        },
        phase2: { totalBudgetCr: 0, items: [] },
        contingencyPct: 0.10,
      };
      logger.info('deals.create.capex_estimated', { totalKeys, starRating, costPerKey, estimatedBudget });
    }

    // ── Auto-estimate OpEx if not provided ──
    let opexModel = req.body.opexModel ?? defaults.opexModel;
    const opex = opexModel as any;
    if (!opex?.departments || opex.departments.length === 0) {
      opexModel = {
        departments: [
          { name: 'Rooms', costPctOfRevenue: 0.22 },
          { name: 'F&B', costPctOfRevenue: 0.08 },
          { name: 'Other Operated', costPctOfRevenue: 0.03 },
        ],
        undistributed: [
          { name: 'Admin & General', costPctOfRevenue: 0.06 },
          { name: 'Sales & Marketing', costPctOfRevenue: 0.04 },
          { name: 'Property Operations', costPctOfRevenue: 0.04 },
          { name: 'Utilities', costPctOfRevenue: 0.04 },
        ],
        fixedCharges: [
          { name: 'Insurance', annualAmountCr: 0.15 },
          { name: 'Property Tax', annualAmountCr: 0.20 },
        ],
      };
    }

    const dealPayload = {
      name,
      assetClass,
      property: req.body.property ?? defaults.property,
      partnership: req.body.partnership ?? defaults.partnership,
      marketAssumptions: normalizedMarket,
      financialAssumptions: req.body.financialAssumptions ?? defaults.financialAssumptions,
      capexPlan,
      opexModel,
      scenarios: req.body.scenarios ?? defaults.scenarios,
    };

    const deal = await createDeal(db, dealPayload);

    // Grant the creator access to the deal
    await grantDealAccess(db, {
      userId: user.userId,
      dealId: deal.id,
      role: user.role,
    });

    await insertAuditEntry(db, {
      dealId: deal.id,
      userId: user.userId,
      role: user.role,
      module: 'deals',
      action: 'deal.created',
      entityType: 'deal',
      entityId: deal.id,
      diff: { name, assetClass },
    });

    // Trigger initial recompute to populate engine results
    try {
      await recomputeDeal(db, deal.id, 'deal.created', user.userId);
    } catch (err) {
      logger.warn('route.create.initial_recompute_failed', { dealId: deal.id, error: String(err) });
    }

    return deal;
  });

  // ── GET /deals/:id/history ──
  // Get recommendation history for a deal
  app.get<{ Params: { id: string } }>('/deals/:id/history', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const history = await getRecommendationHistory(db, id, 100);

    return {
      dealId: id,
      recommendations: history.map(r => ({
        version: r.version,
        verdict: r.verdict,
        confidence: r.confidence,
        irr: r.proformaSnapshot ? (r.proformaSnapshot as any).irr : null,
        npv: r.proformaSnapshot ? (r.proformaSnapshot as any).npv : null,
        dscr: r.proformaSnapshot ? (r.proformaSnapshot as any).avgDSCR : null,
        timestamp: r.createdAt.toISOString(),
        triggerEvent: r.triggerEvent,
      })),
    };
  });

  // ── POST /deals/:id/revalue ──
  // Monthly revaluation: optionally advance month, then trigger full recompute cascade
  app.post<{
    Params: { id: string };
    Body: { advanceMonth?: boolean };
  }>('/deals/:id/revalue', { preHandler: requireRole('analyst', 'admin') }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const { advanceMonth } = req.body;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    // Optionally advance current month
    if (advanceMonth) {
      await updateDealCurrentMonth(db, id, deal.currentMonth + 1);
      await insertAuditEntry(db, {
        dealId: id,
        userId: user.userId,
        role: user.role,
        module: 'deals',
        action: 'deal.month-advanced',
        entityType: 'deal',
        entityId: id,
        diff: { previousMonth: deal.currentMonth, newMonth: deal.currentMonth + 1 },
      });
    }

    // Trigger full recompute cascade
    try {
      const result = await recomputeDeal(db, id, 'revalue.monthly', user.userId);

      if (!result.ok || !result.proforma) {
        logger.warn('revalue.partial_failure', { dealId: id });
        return reply.code(207).send({
          message: 'Revaluation partially failed — prior results preserved',
          error: result.error,
          recommendation: result.recommendation,
          proforma: result.proforma ? {
            irr: result.proforma.irr,
            npv: result.proforma.npv,
            equityMultiple: result.proforma.equityMultiple,
          } : null,
        });
      }

      // Fetch updated deal to return dashboard view
      const updatedDeal = await getDealById(db, id);
      const [latestUW, latestRec] = await Promise.all([
        getLatestEngineResultByScenario(db, id, 'underwriter', 'base'),
        getLatestRecommendation(db, id),
      ]);

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

      return {
        message: 'Revaluation completed',
        deal: {
          id: updatedDeal!.id,
          name: updatedDeal!.name,
          currentMonth: updatedDeal!.currentMonth,
        },
        latestRecommendation,
        latestProforma,
      };
    } catch (err) {
      logger.error('route.revalue.crash', { dealId: id, error: String(err) });
      return reply.code(500).send({
        message: 'Revaluation failed',
        error: 'Engine cascade crashed',
      });
    }
  });

  // ── GET /deals/:id/engines/:engine/history ──
  // Get all versions of an engine result
  app.get<{
    Params: { id: string; engine: string };
    Querystring: { scenarioKey?: string; limit?: string };
  }>('/deals/:id/engines/:engine/history', { preHandler: authGuard }, async (req, reply) => {
    const { id, engine } = req.params;
    const { scenarioKey, limit } = req.query;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const validEngines = ['underwriter', 'decision', 'factor', 'montecarlo', 'budget', 'scurve'];
    if (!validEngines.includes(engine)) {
      return reply.code(400).send({ error: `Invalid engine name. Valid: ${validEngines.join(', ')}` });
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const history = await getEngineResultHistory(db, id, engine, scenarioKey as any, limitNum);

    return {
      dealId: id,
      engine,
      scenarioKey: scenarioKey ?? 'all',
      results: history.map(r => ({
        version: r.version,
        durationMs: r.durationMs,
        triggeredBy: r.triggeredBy,
        createdAt: r.createdAt.toISOString(),
        contentHash: r.contentHash,
        previousHash: r.previousHash,
        modelVersion: r.modelVersion,
        output: r.output,
      })),
    };
  });

  // ── GET /deals/:id/audit ──
  // Get recent audit log entries for the deal
  app.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/deals/:id/audit', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const { limit } = req.query;

    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const auditEntries = await getRecentAudit(db, id, limitNum);

    return {
      dealId: id,
      entries: auditEntries.map(a => ({
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        userId: a.userId,
        role: a.role,
        module: a.module,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        diff: a.diff,
      })),
    };
  });
}
