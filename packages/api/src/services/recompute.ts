// ─── Recompute Service ──────────────────────────────────────────────
// Full engine cascade: Factor → Underwriter(×3) → MC → Budget → S-Curve → Decision.
// Runs all 3 scenarios (bear, base, bull) and persists results separately.
//
// G-2/F-3: Every engine result is cryptographically hash-chained.
// G-10/F-4: Every engine result is tagged with its model version.

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  Deal, ProFormaOutput, RecommendationState,
  FactorScoreOutput, MCOutput, BudgetAnalysisOutput,
} from '@v3grand/core';
import { logger } from '@v3grand/core';
import {
  buildProForma, evaluateDecision,
  scoreFactors, runMonteCarlo, analyzeBudget, distributeSCurve,
  computeContentHash, MODEL_VERSIONS, computeAssumptionFingerprint,
} from '@v3grand/engines';
import {
  getDealById, insertEngineResult, getLatestEngineResultByScenario,
  insertRecommendation, getLatestRecommendationByScenario, insertAuditEntry,
  getBudgetLinesByDeal, getChangeOrdersByDeal, getRFIsByDeal, getMilestonesByDeal,
  getLatestContentHash,
} from '@v3grand/db';
import { emitDealEvent } from '../sse-hub.js';
import { getMarketDataService } from '@v3grand/mcp';

export interface RecomputeResult {
  ok: boolean;               // false when cascade partially or fully failed
  error?: string;            // human-readable error when ok=false
  proforma: ProFormaOutput | null;
  recommendation: {
    verdict: string;
    confidence: number;
    explanation: string;
    narrative?: string;
    topDrivers?: string[];
    topRisks?: string[];
    flipConditions?: string[];
    isFlip: boolean;
  } | null;
  factorResult?: FactorScoreOutput;
  mcResult?: MCOutput;
  budgetResult?: BudgetAnalysisOutput;
}

// ── Helper: insert engine result with hash chain ──
// Fetches the previous hash, computes the content hash, and persists.
async function insertHashedEngineResult(
  db: PostgresJsDatabase,
  row: {
    dealId: string;
    engineName: string;
    scenarioKey?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    durationMs: number;
    triggeredBy: string;
  },
) {
  const modelVersion = MODEL_VERSIONS[row.engineName as keyof typeof MODEL_VERSIONS] ?? '1.0.0';

  // Fetch the previous hash in this chain
  const previousHash = await getLatestContentHash(
    db, row.dealId, row.engineName, row.scenarioKey,
  );

  // Compute the content hash for this result
  const contentHash = computeContentHash(previousHash, {
    engineName: row.engineName,
    version: 0,  // will be set by insertEngineResult
    scenarioKey: row.scenarioKey ?? 'base',
    input: row.input,
    output: row.output,
  });

  return insertEngineResult(db, {
    ...row,
    contentHash,
    previousHash,
    modelVersion,
  });
}

/** Reconstitute a Deal object from DB row */
export function reconstituteDeal(dealRow: any): Deal {
  return {
    id: dealRow.id,
    name: dealRow.name,
    assetClass: dealRow.assetClass as Deal['assetClass'],
    status: dealRow.status as Deal['status'],
    lifecyclePhase: dealRow.lifecyclePhase as Deal['lifecyclePhase'],
    currentMonth: dealRow.currentMonth,
    version: dealRow.version,
    property: dealRow.property as Deal['property'],
    partnership: dealRow.partnership as Deal['partnership'],
    marketAssumptions: dealRow.marketAssumptions as Deal['marketAssumptions'],
    financialAssumptions: dealRow.financialAssumptions as Deal['financialAssumptions'],
    capexPlan: dealRow.capexPlan as Deal['capexPlan'],
    opexModel: dealRow.opexModel as Deal['opexModel'],
    scenarios: dealRow.scenarios as Deal['scenarios'],
    createdAt: dealRow.createdAt.toISOString(),
    updatedAt: dealRow.updatedAt.toISOString(),
  };
}

export async function recomputeDeal(
  db: PostgresJsDatabase,
  dealId: string,
  trigger: string,          // e.g. "assumption.updated" or "api.manual"
  userId = 'system',
): Promise<RecomputeResult> {
  const cascadeStart = Date.now();
  const ctx = { dealId, trigger, userId };
  logger.info('recompute.start', ctx);

  // 1. Load current deal
  const dealRow = await getDealById(db, dealId);
  if (!dealRow) {
    logger.error('recompute.deal_not_found', ctx);
    return { ok: false, error: `Deal ${dealId} not found`, proforma: null, recommendation: null };
  }
  const deal = reconstituteDeal(dealRow);

  // ── 1b. Compute assumption fingerprint for staleness detection ──
  // This fingerprint is stored in every engine result's input so the dashboard
  // can compare it against the deal's current state to detect stale results.
  const assumptionFingerprint = computeAssumptionFingerprint(deal);
  logger.info('recompute.fingerprint', { ...ctx, assumptionFingerprint: assumptionFingerprint.slice(0, 12) + '…' });

  // ── 2. Fetch live macro data for Factor engine ──
  let macroIndicators: import('@v3grand/core').MacroIndicators | undefined;
  try {
    const marketService = getMarketDataService();
    const macro = await marketService.getFactorMacro();
    macroIndicators = {
      repoRate: macro.repoRate,
      cpi: macro.cpi,
      gdpGrowthRate: macro.gdpGrowthRate,
      bondYield10Y: macro.bondYield10Y,
      hotelSupplyGrowthPct: macro.hotelSupplyGrowthPct,
    };
    logger.info('recompute.macro_data', { ...ctx, source: macro.source, repoRate: macro.repoRate, cpi: macro.cpi, gdpGrowth: macro.gdpGrowthRate });
  } catch (err) {
    logger.warn('recompute.macro_fetch_failed', { ...ctx, error: String(err) });
    // Factor engine will use its own DEFAULT_MACRO fallback
  }

  // ── 2b. Factor Engine (deal-level, not per-scenario) ──
  let factorResult: FactorScoreOutput | null = null;
  try {
    const t0 = Date.now();
    factorResult = scoreFactors({ deal, macroIndicators });
    const duration = Date.now() - t0;
    logger.info('engine.factor.done', { ...ctx, durationMs: duration, compositeScore: factorResult.compositeScore });

    await insertHashedEngineResult(db, {
      dealId, engineName: 'factor',
      input: { trigger, assumptionFingerprint } as Record<string, unknown>,
      output: factorResult as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: trigger,
    });

    await insertAuditEntry(db, {
      dealId, userId, role: 'system', module: 'factor',
      action: 'engine.completed', entityType: 'engine_result',
      entityId: dealId,
      diff: { compositeScore: factorResult.compositeScore, impliedDiscountRate: factorResult.impliedDiscountRate },
    });
  } catch (err) {
    logger.error('engine.factor.failed', { ...ctx, error: String(err) });
  }

  // ── 3. Underwriter + Decision per scenario ──
  const scenarios: Array<'bear' | 'base' | 'bull'> = ['bear', 'base', 'bull'];
  let baseProforma: ProFormaOutput | null = null;
  let baseRecommendation: any = null;
  let scenarioErrors = 0;

  for (const scenarioKey of scenarios) {
   try {
    // Run Underwriter
    const t0 = Date.now();
    const proforma = buildProForma({ deal, scenarioKey });
    const uwDuration = Date.now() - t0;
    logger.info('engine.underwriter.done', { ...ctx, scenario: scenarioKey, durationMs: uwDuration, irr: proforma.irr });

    await insertHashedEngineResult(db, {
      dealId, engineName: 'underwriter', scenarioKey,
      input: { scenarioKey, assumptionFingerprint } as Record<string, unknown>,
      output: proforma as unknown as Record<string, unknown>,
      durationMs: uwDuration,
      triggeredBy: trigger,
    });

    if (scenarioKey === 'base') {
      baseProforma = proforma;
    }

    await insertAuditEntry(db, {
      dealId, userId, role: 'system', module: 'underwriter',
      action: 'engine.completed', entityType: 'engine_result',
      entityId: dealId, diff: { scenarioKey, irr: proforma.irr, npv: proforma.npv },
    });

    // Load previous recommendation (for flip detection)
    const prevRec = await getLatestRecommendationByScenario(db, dealId, scenarioKey);

    // Run Decision Engine (with Factor result attached)
    const t1 = Date.now();
    const decision = evaluateDecision({
      deal,
      proformaResult: proforma,
      factorResult,
      currentRecommendation: prevRec ? {
        id: prevRec.id,
        dealId: prevRec.dealId,
        version: prevRec.version,
        timestamp: prevRec.createdAt.toISOString(),
        verdict: prevRec.verdict as RecommendationState['verdict'],
        confidence: prevRec.confidence,
        triggerEvent: prevRec.triggerEvent,
        proformaSnapshot: prevRec.proformaSnapshot as RecommendationState['proformaSnapshot'],
        gateResults: prevRec.gateResults as RecommendationState['gateResults'],
        explanation: prevRec.explanation,
        previousVerdict: prevRec.previousVerdict as RecommendationState['previousVerdict'],
        isFlip: prevRec.isFlip === 'true',
      } : null,
    });
    const decDuration = Date.now() - t1;

    await insertHashedEngineResult(db, {
      dealId, engineName: 'decision', scenarioKey,
      input: { scenarioKey, proformaIrr: proforma.irr, assumptionFingerprint } as Record<string, unknown>,
      output: decision as unknown as Record<string, unknown>,
      durationMs: decDuration,
      triggeredBy: trigger,
    });

    // Persist recommendation (use narrative for richer explanation)
    await insertRecommendation(db, {
      dealId, scenarioKey,
      verdict: decision.verdict,
      confidence: decision.confidence,
      triggerEvent: trigger,
      proformaSnapshot: {
        irr: proforma.irr,
        npv: proforma.npv,
        equityMultiple: proforma.equityMultiple,
        avgDSCR: proforma.avgDSCR,
      },
      gateResults: decision.gateResults,
      explanation: decision.narrative || decision.explanation,
      previousVerdict: prevRec?.verdict ?? null,
      isFlip: decision.isFlip,
    });

    if (scenarioKey === 'base') {
      baseRecommendation = decision;
    }

    await insertAuditEntry(db, {
      dealId, userId, role: 'system', module: 'decision',
      action: 'recommendation.changed', entityType: 'recommendation',
      entityId: dealId,
      diff: { scenarioKey, verdict: decision.verdict, confidence: decision.confidence },
    });
   } catch (err) {
    scenarioErrors++;
    logger.error('engine.scenario.failed', { ...ctx, scenario: scenarioKey, error: String(err) });
   }
  }

  // ── 4. Monte Carlo (deal-level, uses base scenario params) ──
  let mcResult: MCOutput | null = null;
  try {
    const t0 = Date.now();
    mcResult = runMonteCarlo({ deal, iterations: 5000 });
    const duration = Date.now() - t0;
    logger.info('engine.montecarlo.done', { ...ctx, durationMs: duration, irrP50: mcResult.irrDistribution.p50 });

    await insertHashedEngineResult(db, {
      dealId, engineName: 'montecarlo',
      input: { iterations: 5000, trigger, assumptionFingerprint } as Record<string, unknown>,
      output: mcResult as unknown as Record<string, unknown>,
      durationMs: duration,
      triggeredBy: trigger,
    });

    await insertAuditEntry(db, {
      dealId, userId, role: 'system', module: 'montecarlo',
      action: 'engine.completed', entityType: 'engine_result',
      entityId: dealId,
      diff: {
        irrP50: mcResult.irrDistribution.p50,
        npvP50: mcResult.npvDistribution.p50,
        probNpvNegative: mcResult.probNpvNegative,
      },
    });
  } catch (err) {
    logger.error('engine.montecarlo.failed', { ...ctx, error: String(err) });
  }

  // ── 5. Budget Variance (only during construction phase) ──
  let budgetResult: BudgetAnalysisOutput | null = null;
  if (deal.lifecyclePhase === 'construction') {
    try {
      const [budgetLinesData, coData, rfiData, msData] = await Promise.all([
        getBudgetLinesByDeal(db, dealId),
        getChangeOrdersByDeal(db, dealId),
        getRFIsByDeal(db, dealId),
        getMilestonesByDeal(db, dealId),
      ]);

      // Map DB rows to engine input shapes
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
      budgetResult = analyzeBudget({
        deal,
        budgetLines: mappedBudgetLines,
        changeOrders: mappedCOs,
        rfis: mappedRFIs,
        milestones: mappedMilestones,
        asOfMonth: deal.currentMonth,
      });
      const duration = Date.now() - t0;
      logger.info('engine.budget.done', { ...ctx, durationMs: duration, status: budgetResult.overallStatus });

      await insertHashedEngineResult(db, {
        dealId, engineName: 'budget',
        input: { asOfMonth: deal.currentMonth, trigger, assumptionFingerprint } as Record<string, unknown>,
        output: budgetResult as unknown as Record<string, unknown>,
        durationMs: duration,
        triggeredBy: trigger,
      });

      await insertAuditEntry(db, {
        dealId, userId, role: 'system', module: 'budget',
        action: 'engine.completed', entityType: 'engine_result',
        entityId: dealId,
        diff: {
          overallStatus: budgetResult.overallStatus,
          varianceToCurrent: budgetResult.varianceToCurrent,
          alertCount: budgetResult.alerts.length,
        },
      });
    } catch (err) {
      logger.error('engine.budget.failed', { ...ctx, error: String(err) });
    }
  }

  // ── 6. S-Curve (only during construction phase) ──
  if (deal.lifecyclePhase === 'construction' && deal.capexPlan?.phase1?.items) {
    try {
      const scurveItems = deal.capexPlan.phase1.items.map((item, i) => ({
        id: item.id,
        costCode: item.costCode,
        amount: item.budgetAmount,
        startMonth: 0,
        endMonth: 24,   // assume 24-month construction
        curveType: 's-curve' as const,
      }));

      const t0 = Date.now();
      const scurveResult = distributeSCurve({ items: scurveItems, totalMonths: 24 });
      const duration = Date.now() - t0;

      await insertHashedEngineResult(db, {
        dealId, engineName: 'scurve',
        input: { itemCount: scurveItems.length, totalMonths: 24, trigger, assumptionFingerprint } as Record<string, unknown>,
        output: scurveResult as unknown as Record<string, unknown>,
        durationMs: duration,
        triggeredBy: trigger,
      });
    } catch (err) {
      logger.error('engine.scurve.failed', { ...ctx, error: String(err) });
    }
  }

  // ── 7. Re-run Decision with full context (MC + Budget + Factor) ──
  if (baseProforma && (mcResult || budgetResult)) {
    try {
      const prevRec = await getLatestRecommendationByScenario(db, dealId, 'base');
      const t0 = Date.now();
      const fullDecision = evaluateDecision({
        deal,
        proformaResult: baseProforma,
        factorResult,
        mcResult,
        budgetResult,
        currentRecommendation: prevRec ? {
          id: prevRec.id,
          dealId: prevRec.dealId,
          version: prevRec.version,
          timestamp: prevRec.createdAt.toISOString(),
          verdict: prevRec.verdict as RecommendationState['verdict'],
          confidence: prevRec.confidence,
          triggerEvent: prevRec.triggerEvent,
          proformaSnapshot: prevRec.proformaSnapshot as RecommendationState['proformaSnapshot'],
          gateResults: prevRec.gateResults as RecommendationState['gateResults'],
          explanation: prevRec.explanation,
          previousVerdict: prevRec.previousVerdict as RecommendationState['previousVerdict'],
          isFlip: prevRec.isFlip === 'true',
        } : null,
      });
      const decDuration = Date.now() - t0;

      // Persist the full decision engine output (includes narrative, topDrivers, topRisks, flipConditions)
      await insertHashedEngineResult(db, {
        dealId, engineName: 'decision', scenarioKey: 'base',
        input: { trigger: `${trigger}.enriched`, hasMC: !!mcResult, hasBudget: !!budgetResult, hasFactor: !!factorResult, assumptionFingerprint } as Record<string, unknown>,
        output: fullDecision as unknown as Record<string, unknown>,
        durationMs: decDuration,
        triggeredBy: `${trigger}.enriched`,
      });

      // Persist the enriched recommendation (explanation = narrative for rich display)
      await insertRecommendation(db, {
        dealId, scenarioKey: 'base',
        verdict: fullDecision.verdict,
        confidence: fullDecision.confidence,
        triggerEvent: `${trigger}.enriched`,
        proformaSnapshot: {
          irr: baseProforma.irr,
          npv: baseProforma.npv,
          equityMultiple: baseProforma.equityMultiple,
          avgDSCR: baseProforma.avgDSCR,
        },
        gateResults: fullDecision.gateResults,
        explanation: fullDecision.narrative || fullDecision.explanation,
        previousVerdict: prevRec?.verdict ?? null,
        isFlip: fullDecision.isFlip,
      });

      baseRecommendation = fullDecision;
    } catch (err) {
      logger.error('engine.enriched_decision.failed', { ...ctx, error: String(err) });
    }
  }

  // ── Final result with null guards ──
  const totalDuration = Date.now() - cascadeStart;
  const ok = baseProforma !== null && baseRecommendation !== null && scenarioErrors === 0;
  logger.info('recompute.done', { ...ctx, durationMs: totalDuration, ok, scenarioErrors });

  // ── Emit SSE events for real-time dashboard refresh ──
  emitDealEvent(dealId, 'recompute.complete', {
    ok,
    durationMs: totalDuration,
    verdict: baseRecommendation?.verdict ?? null,
    confidence: baseRecommendation?.confidence ?? null,
    isFlip: baseRecommendation?.isFlip ?? false,
    trigger,
  });
  if (baseRecommendation?.isFlip) {
    emitDealEvent(dealId, 'recommendation.flipped', {
      from: baseRecommendation?.flipConditions?.[0] ?? 'unknown',
      to: baseRecommendation.verdict,
      confidence: baseRecommendation.confidence,
    });
  }

  return {
    ok,
    error: ok ? undefined : 'One or more engines failed during recompute — existing results preserved',
    proforma: baseProforma,
    recommendation: baseRecommendation ? {
      verdict: baseRecommendation.verdict,
      confidence: baseRecommendation.confidence,
      explanation: baseRecommendation.explanation,
      narrative: baseRecommendation.narrative,
      topDrivers: baseRecommendation.topDrivers,
      topRisks: baseRecommendation.topRisks,
      flipConditions: baseRecommendation.flipConditions,
      isFlip: baseRecommendation.isFlip,
    } : null,
    factorResult: factorResult ?? undefined,
    mcResult: mcResult ?? undefined,
    budgetResult: budgetResult ?? undefined,
  };
}
