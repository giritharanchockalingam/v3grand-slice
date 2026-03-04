// ─── Evaluation Engine API Routes ───────────────────────────────────
// POST /deals/:id/evaluate — run the unified evaluation engine
// GET  /deals/:id/evaluation — get latest evaluation result
// POST /evaluate/standalone — run without a persisted deal

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DealEvaluationInput, DealEvaluationOutput } from '@v3grand/core';
import { logger } from '@v3grand/core';
import { evaluateDeal, hotelPlugin, generateICMemoPDF } from '@v3grand/engines';
import { getDealById, insertEngineResult, getLatestEngineResult, insertAuditEntry } from '@v3grand/db';
import { authGuard, requireRole } from '../middleware/auth.js';
import { emitDealEvent } from '../sse-hub.js';

// Plugin registry — extensible for future asset classes
const PLUGINS: Record<string, typeof hotelPlugin> = {
  hotel: hotelPlugin,
};

export async function evaluationRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── POST /deals/:id/evaluate ──
  // Run the full evaluation engine against a persisted deal.
  // Builds DealEvaluationInput from the deal's stored assumptions.
  app.post<{
    Params: { id: string };
    Body: {
      overrides?: Partial<DealEvaluationInput>;
      sensitivityConfig?: DealEvaluationInput['sensitivityConfig'];
    };
  }>('/deals/:id/evaluate', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const assetClass = (deal.assetClass as string) || 'hotel';
    const plugin = PLUGINS[assetClass];
    if (!plugin) return reply.code(400).send({ error: `No plugin for asset class: ${assetClass}` });

    // Build evaluation input from deal data
    const evalInput = buildEvalInputFromDeal(deal, req.body.overrides, req.body.sensitivityConfig);

    try {
      const t0 = Date.now();
      const result = evaluateDeal(evalInput, plugin);
      const durationMs = Date.now() - t0;

      // Persist as engine result
      const existingResults = await getLatestEngineResult(db, id, 'evaluation' as any);
      const nextVersion = existingResults ? existingResults.version + 1 : 1;

      await insertEngineResult(db, {
        dealId: id,
        engineName: 'evaluation' as any,
        version: nextVersion,
        input: evalInput as any,
        output: result as any,
        durationMs,
        triggeredBy: user.userId,
        scenarioKey: 'base',
      });

      await insertAuditEntry(db, {
        dealId: id, userId: user.userId, role: user.role,
        module: 'evaluation', action: 'evaluation.completed',
        entityType: 'deal', entityId: id,
        diff: { verdict: result.verdict, confidence: result.confidence, irr: result.irr, npv: result.npv },
      });

      emitDealEvent(id, 'evaluation.completed', {
        verdict: result.verdict, confidence: result.confidence,
        irr: result.irr, npv: result.npv, durationMs,
      });

      return result;
    } catch (err) {
      logger.error('evaluation.engine.crashed', { dealId: id, error: String(err) });
      return reply.code(500).send({ error: 'Evaluation engine failed', details: String(err) });
    }
  });

  // ── GET /deals/:id/evaluation ──
  // Get the latest persisted evaluation result.
  app.get<{ Params: { id: string } }>('/deals/:id/evaluation', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    const result = await getLatestEngineResult(db, id, 'evaluation' as any);
    if (!result) return reply.code(404).send({ error: 'No evaluation result yet — run POST /deals/:id/evaluate first' });

    return {
      version: result.version,
      createdAt: result.createdAt,
      durationMs: result.durationMs,
      triggeredBy: result.triggeredBy,
      input: result.input,
      output: result.output,
    };
  });

  // ── POST /evaluate/standalone ──
  // Run the evaluation engine without a persisted deal.
  // Takes the full DealEvaluationInput directly.
  app.post<{
    Body: DealEvaluationInput;
  }>('/evaluate/standalone', { preHandler: authGuard }, async (req, reply) => {
    const input = req.body;
    if (!input.assetClass) return reply.code(400).send({ error: 'assetClass is required' });

    const plugin = PLUGINS[input.assetClass];
    if (!plugin) return reply.code(400).send({ error: `No plugin for asset class: ${input.assetClass}` });

    // Validate sector inputs
    const errors = plugin.validateInputs(input.sectorInputs as any);
    if (errors.length > 0) return reply.code(400).send({ error: 'Validation failed', details: errors });

    try {
      const result = evaluateDeal(input, plugin);
      return result;
    } catch (err) {
      logger.error('evaluation.standalone.crashed', { error: String(err) });
      return reply.code(500).send({ error: 'Evaluation engine failed', details: String(err) });
    }
  });

  // ── GET /evaluation/plugins ──
  // List available asset plugins with their input schemas.
  app.get('/evaluation/plugins', { preHandler: authGuard }, async () => {
    return Object.values(PLUGINS).map(p => ({
      assetClass: p.assetClass,
      label: p.label,
      inputSchema: p.getInputSchema(),
    }));
  });

  // ── POST /deals/:id/ic-memo ──
  // Generate and return a board-ready IC Memo PDF.
  app.post<{
    Params: { id: string };
    Body: {
      evaluationOutput?: DealEvaluationOutput;
    };
  }>('/deals/:id/ic-memo', { preHandler: authGuard }, async (req, reply) => {
    const { id } = req.params;
    const user = (req as any).user;
    const deal = await getDealById(db, id);
    if (!deal) return reply.code(404).send({ error: 'Deal not found' });

    let evalOutput: DealEvaluationOutput;
    let evalInput: DealEvaluationInput;

    if (req.body.evaluationOutput) {
      // Use the provided evaluation output (from the UI)
      evalOutput = req.body.evaluationOutput as DealEvaluationOutput;
      // Build a matching input from deal data for the memo header
      evalInput = buildEvalInputFromDeal(deal);
    } else {
      // Fetch the latest persisted evaluation result
      const result = await getLatestEngineResult(db, id, 'evaluation' as any);
      if (!result) {
        return reply.code(404).send({ error: 'No evaluation result found. Run the evaluation engine first.' });
      }
      evalInput = result.input as unknown as DealEvaluationInput;
      evalOutput = result.output as unknown as DealEvaluationOutput;
    }

    try {
      const pdfBytes = await generateICMemoPDF(evalInput, evalOutput);

      await insertAuditEntry(db, {
        dealId: id, userId: user.userId, role: user.role,
        module: 'evaluation', action: 'ic-memo.generated',
        entityType: 'deal', entityId: id,
        diff: { verdict: evalOutput.verdict, pages: 'pdf' },
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="IC-Memo-${id}.pdf"`);
      reply.header('Content-Length', pdfBytes.length);
      return reply.send(Buffer.from(pdfBytes));
    } catch (err) {
      logger.error('ic-memo.generation.failed', { dealId: id, error: String(err) });
      return reply.code(500).send({ error: 'IC Memo generation failed', details: String(err) });
    }
  });
}

// ── Build DealEvaluationInput from persisted Deal data ──
function buildEvalInputFromDeal(deal: any, overrides?: Partial<DealEvaluationInput>, sensitivityConfig?: DealEvaluationInput['sensitivityConfig']): DealEvaluationInput {
  const fin = deal.financialAssumptions as any;
  const mkt = deal.marketAssumptions as any;
  const prop = deal.property as any;
  const capex = deal.capexPlan as any;
  const scenarios = deal.scenarios as any;

  const totalCapex = ((capex?.phase1?.totalBudgetCr ?? 0) + (capex?.phase2?.totalBudgetCr ?? 0)) * 1e7;

  const evalInput: DealEvaluationInput = {
    dealId: deal.id,
    dealName: deal.name,
    assetClass: deal.assetClass || 'hotel',
    location: {
      city: prop?.location?.city ?? '',
      state: prop?.location?.state ?? '',
      country: prop?.location?.country ?? 'India',
    },
    totalProjectCost: totalCapex,
    landCost: 0, // derived from capex items
    constructionCost: totalCapex * 0.60,
    softCosts: totalCapex * 0.10,
    preOpeningCost: totalCapex * 0.08,
    contingencyPct: capex?.contingencyPct ?? 0.10,
    equityPct: fin?.equityRatio ?? 0.40,
    debtPct: fin?.debtRatio ?? 0.60,
    interestRate: fin?.debtInterestRate ?? 0.095,
    debtTenorYears: fin?.debtTenorYears ?? 15,
    gracePeriodYears: 2,
    waccInputs: {
      riskFreeRate: fin?.riskFreeRate ?? 0.065,
      equityRiskPremium: 0.08,
      betaLevered: 1.1,
      costOfDebt: fin?.debtInterestRate ?? 0.095,
      taxRate: fin?.taxRate ?? 0.25,
      debtWeight: fin?.debtRatio ?? 0.60,
      equityWeight: fin?.equityRatio ?? 0.40,
      countryRiskPremium: 0.02,
      sizeRiskPremium: 0.015,
    },
    projectionYears: 10,
    constructionMonths: 24,
    stabilizationYear: 5,
    scenarios: {
      bear: {
        label: 'Bear',
        probability: scenarios?.bear?.probability ?? 0.25,
        occupancyStabilized: scenarios?.bear?.occupancyStabilized ?? 0.58,
        adrStabilized: scenarios?.bear?.adrStabilized ?? 5800,
        revenueGrowthRate: 0.03,
        opexGrowthRate: 0.05,
        exitCapRate: fin?.exitCapRate ?? 0.09,
        exitMultiple: (fin?.exitMultiple ?? 8) * 0.85,
        constructionCostOverrun: 0.10,
      },
      base: {
        label: 'Base',
        probability: scenarios?.base?.probability ?? 0.50,
        occupancyStabilized: scenarios?.base?.occupancyStabilized ?? 0.72,
        adrStabilized: scenarios?.base?.adrStabilized ?? 7000,
        revenueGrowthRate: 0.05,
        opexGrowthRate: 0.05,
        exitCapRate: fin?.exitCapRate ?? 0.08,
        exitMultiple: fin?.exitMultiple ?? 8,
        constructionCostOverrun: 0,
      },
      bull: {
        label: 'Bull',
        probability: scenarios?.bull?.probability ?? 0.25,
        occupancyStabilized: scenarios?.bull?.occupancyStabilized ?? 0.82,
        adrStabilized: scenarios?.bull?.adrStabilized ?? 8200,
        revenueGrowthRate: 0.07,
        opexGrowthRate: 0.04,
        exitCapRate: (fin?.exitCapRate ?? 0.08) * 0.90,
        exitMultiple: (fin?.exitMultiple ?? 8) * 1.15,
        constructionCostOverrun: -0.03,
      },
    },
    exitCapRate: fin?.exitCapRate ?? 0.08,
    exitMultiple: fin?.exitMultiple ?? 8,
    exitYear: 10,
    taxRate: fin?.taxRate ?? 0.25,
    inflationRate: fin?.inflationRate ?? 0.05,
    risks: [],
    operatingModelOptions: [
      {
        label: 'Independent',
        type: 'independent',
        baseMgmtFeePct: 0.03,
        incentiveFeePct: 0.10,
        brandFeePct: 0,
        reservationFeePct: 0,
        occupancyPremium: 0,
        adrPremium: 0,
        setupCostCr: 0,
      },
      {
        label: 'Branded (Marriott Courtyard)',
        type: 'brand',
        baseMgmtFeePct: 0.03,
        incentiveFeePct: 0.10,
        brandFeePct: 0.03,
        reservationFeePct: 0.02,
        occupancyPremium: 0.08,
        adrPremium: 0.12,
        setupCostCr: 3.5,
      },
      {
        label: 'Soft Brand (Best Western)',
        type: 'soft-brand',
        baseMgmtFeePct: 0.02,
        incentiveFeePct: 0.08,
        brandFeePct: 0.015,
        reservationFeePct: 0.01,
        occupancyPremium: 0.04,
        adrPremium: 0.06,
        setupCostCr: 1.5,
      },
    ],
    liteAlternatives: [
      {
        description: 'Land lease (no development)',
        annualIncome: totalCapex * 0.015,
        growthRate: 0.05,
        investmentRequired: totalCapex * 0.15,
        durationYears: 10,
      },
    ],
    capitalStructureOptions: [
      { label: 'Conservative (40% Debt)', debtPct: 0.40, equityPct: 0.60, interestRate: fin?.debtInterestRate ?? 0.090, tenorYears: 15 },
      { label: 'Moderate (60% Debt)', debtPct: 0.60, equityPct: 0.40, interestRate: fin?.debtInterestRate ?? 0.095, tenorYears: 15 },
      { label: 'Aggressive (75% Debt)', debtPct: 0.75, equityPct: 0.25, interestRate: (fin?.debtInterestRate ?? 0.095) + 0.01, tenorYears: 12 },
    ],
    sensitivityConfig: sensitivityConfig ?? undefined,
    sectorInputs: {
      totalKeys: prop?.keys?.phase1 ?? 72,
      phase2Keys: prop?.keys?.phase2 ?? 0,
      starRating: prop?.starRating ?? 5,
      roomTypes: prop?.roomTypes ?? [],
      amenities: prop?.amenities ?? [],
      adrBase: mkt?.adrBase ?? 5500,
      adrStabilized: mkt?.adrStabilized ?? 7000,
      adrGrowthRate: mkt?.adrGrowthRate ?? 0.05,
      occupancyRamp: mkt?.occupancyRamp ?? [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72],
      occupancyStabilized: scenarios?.base?.occupancyStabilized ?? 0.72,
      revenueMix: mkt?.revenueMix ? { ...mkt.revenueMix, spa: 0.03, other: (mkt.revenueMix.other ?? 0.08) - 0.03 } : { rooms: 0.55, fb: 0.25, banquet: 0.12, spa: 0.03, other: 0.05 },
      seasonality: mkt?.seasonality ?? [],
      compSet: mkt?.compSet ?? [],
      anchorTenants: [],
      marketSupplyGrowthPct: 0.03,
      marketDemandGrowthPct: 0.06,
      managementFeePct: fin?.managementFeePct ?? 0.03,
      incentiveFeePct: fin?.incentiveFeePct ?? 0.10,
      ffAndEReservePct: fin?.ffAndEReservePct ?? 0.04,
      departmentalCostPct: 0.45,
      undistributedCostPct: 0.15,
      selectedOperatingModel: 'independent',
      phase2TriggerOccupancy: 0.70,
      phase2TriggerYear: 4,
    },
  };

  // Apply overrides
  if (overrides) {
    Object.assign(evalInput, overrides);
  }

  return evalInput;
}
