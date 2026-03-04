// ─── Engine Routes: Individual engine triggers & results ────────────
// POST /deals/:id/engines/factor      — Run Factor scoring
// POST /deals/:id/engines/montecarlo  — Run Monte Carlo simulation
// POST /deals/:id/engines/budget      — Run Budget variance analysis
// POST /deals/:id/engines/scurve      — Run S-Curve distribution
// GET  /deals/:id/engines/:engine     — Get latest result for an engine

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  Deal, FactorScoreOutput, MCOutput, BudgetAnalysisOutput, SCurveOutput,
  MacroIndicators,
} from '@v3grand/core';
import {
  scoreFactors, runMonteCarlo, analyzeBudget, distributeSCurve,
} from '@v3grand/engines';
import {
  getDealById, insertEngineResult, getLatestEngineResult, insertAuditEntry,
  getBudgetLinesByDeal, getChangeOrdersByDeal, getRFIsByDeal, getMilestonesByDeal,
} from '@v3grand/db';
import { authGuard, attachUser } from '../middleware/auth.js';

/** Reconstitute Deal from DB row */
function reconstituteDeal(row: any): Deal {
  return {
    id: row.id,
    name: row.name,
    assetClass: row.assetClass as Deal['assetClass'],
    status: row.status as Deal['status'],
    lifecyclePhase: row.lifecyclePhase as Deal['lifecyclePhase'],
    currentMonth: row.currentMonth,
    version: row.version,
    property: row.property as Deal['property'],
    partnership: row.partnership as Deal['partnership'],
    marketAssumptions: row.marketAssumptions as Deal['marketAssumptions'],
    financialAssumptions: row.financialAssumptions as Deal['financialAssumptions'],
    capexPlan: row.capexPlan as Deal['capexPlan'],
    opexModel: row.opexModel as Deal['opexModel'],
    scenarios: row.scenarios as Deal['scenarios'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function engineRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── POST /deals/:id/engines/factor ──
  // Body (optional): { macroIndicators: MacroIndicators }
  app.post<{
    Params: { id: string };
    Body: { macroIndicators?: MacroIndicators } | undefined;
  }>('/deals/:id/engines/factor', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const deal = reconstituteDeal(dealRow);
    const macro = (req.body as any)?.macroIndicators;

    const t0 = Date.now();
    const result: FactorScoreOutput = scoreFactors({ deal, macroIndicators: macro });
    const duration = Date.now() - t0;

    await insertEngineResult(db, {
      dealId: id, engineName: 'factor',
      input: { macroIndicators: macro ?? null },
      output: result as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: 'api.manual',
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'factor', action: 'engine.completed',
      entityType: 'engine_result', entityId: id,
      diff: { compositeScore: result.compositeScore, impliedDiscountRate: result.impliedDiscountRate },
    });

    return result;
  });

  // ── POST /deals/:id/engines/montecarlo ──
  // Body (optional): { iterations?: number, seed?: number }
  app.post<{
    Params: { id: string };
    Body: { iterations?: number; seed?: number } | undefined;
  }>('/deals/:id/engines/montecarlo', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const deal = reconstituteDeal(dealRow);
    const iterations = (req.body as any)?.iterations ?? 5000;
    const seed = (req.body as any)?.seed;

    const t0 = Date.now();
    const result: MCOutput = runMonteCarlo({ deal, iterations, seed });
    const duration = Date.now() - t0;

    await insertEngineResult(db, {
      dealId: id, engineName: 'montecarlo',
      input: { iterations, seed: seed ?? null },
      output: result as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: 'api.manual',
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'montecarlo', action: 'engine.completed',
      entityType: 'engine_result', entityId: id,
      diff: {
        iterations, irrP50: result.irrDistribution.p50,
        npvP50: result.npvDistribution.p50,
        probNpvNegative: result.probNpvNegative,
      },
    });

    return result;
  });

  // ── POST /deals/:id/engines/budget ──
  app.post<{
    Params: { id: string };
  }>('/deals/:id/engines/budget', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const deal = reconstituteDeal(dealRow);

    const [budgetLinesData, coData, rfiData, msData] = await Promise.all([
      getBudgetLinesByDeal(db, id),
      getChangeOrdersByDeal(db, id),
      getRFIsByDeal(db, id),
      getMilestonesByDeal(db, id),
    ]);

    const mappedBudgetLines = budgetLinesData.map(l => ({
      id: l.id,
      dealId: l.dealId,
      costCode: l.costCode,
      description: l.description,
      category: l.category,
      originalAmount: parseFloat(l.originalAmount as string),
      approvedCOs: parseFloat(l.approvedCOs as string),
      currentBudget: parseFloat(l.currentBudget as string),
      actualSpend: parseFloat(l.actualSpend as string),
      commitments: parseFloat(l.commitments as string),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));
    const mappedCOs = coData.map(c => ({
      id: c.id,
      dealId: c.dealId,
      budgetLineId: c.budgetLineId,
      coNumber: c.coNumber,
      title: c.title,
      description: c.description,
      amount: parseFloat(c.amount as string),
      status: c.status as 'draft' | 'submitted' | 'approved' | 'rejected',
      requestedBy: c.requestedBy,
      approvedBy: c.approvedBy ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
    const mappedRFIs = rfiData.map(r => ({
      id: r.id,
      dealId: r.dealId,
      rfiNumber: r.rfiNumber,
      subject: r.subject,
      question: r.question,
      answer: r.answer ?? null,
      status: r.status as 'open' | 'answered' | 'closed',
      raisedBy: r.raisedBy,
      answeredBy: r.answeredBy ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
    const mappedMilestones = msData.map(m => ({
      id: m.id,
      dealId: m.dealId,
      name: m.name,
      description: m.description,
      targetDate: m.targetDate,
      actualDate: m.actualDate ?? null,
      status: m.status as 'not-started' | 'in-progress' | 'completed' | 'delayed',
      percentComplete: m.percentComplete,
      dependencies: m.dependencies as string[],
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    const t0 = Date.now();
    const result: BudgetAnalysisOutput = analyzeBudget({
      deal,
      budgetLines: mappedBudgetLines,
      changeOrders: mappedCOs,
      rfis: mappedRFIs,
      milestones: mappedMilestones,
      asOfMonth: deal.currentMonth,
    });
    const duration = Date.now() - t0;

    await insertEngineResult(db, {
      dealId: id, engineName: 'budget',
      input: { asOfMonth: deal.currentMonth },
      output: result as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: 'api.manual',
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'budget', action: 'engine.completed',
      entityType: 'engine_result', entityId: id,
      diff: { overallStatus: result.overallStatus, varianceToCurrent: result.varianceToCurrent },
    });

    return result;
  });

  // ── POST /deals/:id/engines/scurve ──
  // Body (optional): { totalMonths?: number }
  app.post<{
    Params: { id: string };
    Body: { totalMonths?: number } | undefined;
  }>('/deals/:id/engines/scurve', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const dealRow = await getDealById(db, id);
    if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

    const deal = reconstituteDeal(dealRow);
    const totalMonths = (req.body as any)?.totalMonths ?? 24;

    const items = (deal.capexPlan?.phase1?.items ?? []).map(item => ({
      id: item.id,
      costCode: item.costCode,
      amount: item.budgetAmount,
      startMonth: 0,
      endMonth: totalMonths,
      curveType: 's-curve' as const,
    }));

    const t0 = Date.now();
    const result: SCurveOutput = distributeSCurve({ items, totalMonths });
    const duration = Date.now() - t0;

    await insertEngineResult(db, {
      dealId: id, engineName: 'scurve',
      input: { itemCount: items.length, totalMonths },
      output: result as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: 'api.manual',
    });

    await insertAuditEntry(db, {
      dealId: id, userId: user.userId, role: user.role,
      module: 'scurve', action: 'engine.completed',
      entityType: 'engine_result', entityId: id,
      diff: { totalAmount: result.totalAmount, months: totalMonths },
    });

    return result;
  });

  // ── GET /deals/:id/engines/:engine ──
  // Retrieve the latest result for a specific engine
  app.get<{
    Params: { id: string; engine: string };
  }>('/deals/:id/engines/:engine', { preHandler: attachUser }, async (req, reply) => {
    const { id, engine } = req.params;
    const validEngines = ['underwriter', 'decision', 'factor', 'montecarlo', 'budget', 'scurve'];
    if (!validEngines.includes(engine)) {
      return reply.code(400).send({ error: `Invalid engine name. Valid: ${validEngines.join(', ')}` });
    }

    const result = await getLatestEngineResult(db, id, engine);
    if (!result) return reply.code(404).send({ error: `No ${engine} result found for deal ${id}` });

    return {
      engineName: result.engineName,
      version: result.version,
      output: result.output,
      durationMs: result.durationMs,
      triggeredBy: result.triggeredBy,
      createdAt: result.createdAt,
    };
  });
}
