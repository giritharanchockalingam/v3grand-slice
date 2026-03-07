/**
 * POST /api/deals/[dealId]/revalue
 *
 * Runs a monthly revaluation:
 *   - Optionally advances currentMonth by 1
 *   - Re-runs the full engine pipeline for all scenarios
 *   - Stores new recommendation with trigger "monthly.revalue"
 *
 * Body: { advanceMonth: boolean }
 */

import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById,
  updateDealCurrentMonth,
  insertEngineResult,
  insertRecommendation,
  getLatestRecommendationByScenario,
} from '@v3grand/db';
import {
  buildProForma,
  runMonteCarlo,
  scoreFactors,
  analyzeBudget,
  distributeSCurve,
  evaluateDecision,
  computeAssumptionFingerprint,
} from '@v3grand/engines';

export const maxDuration = 30;

const SCENARIO_KEYS = ['bear', 'base', 'bull'] as const;
type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const advanceMonth = body.advanceMonth === true;

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { ok: false, error: 'Deal not found' };

      const dealData = deal as any;
      let currentMonth = dealData.currentMonth ?? 0;

      // ── Advance month if requested ──
      if (advanceMonth) {
        currentMonth += 1;
        await updateDealCurrentMonth(db, dealId, currentMonth);
      }

      const activeScenario = (deal.activeScenarioKey ?? 'base') as ScenarioKey;
      const fingerprint = computeAssumptionFingerprint({
        marketAssumptions: deal.marketAssumptions,
        financialAssumptions: deal.financialAssumptions,
        capexPlan: deal.capexPlan,
        opexModel: dealData.opexModel,
        scenarios: dealData.scenarios,
        property: deal.property,
        partnership: deal.partnership,
      });

      const triggerEvent = advanceMonth ? 'monthly.advance-revalue' : 'monthly.revalue';
      const errors: string[] = [];

      // ── Run scenario-dependent engines for ALL scenarios ──
      for (const scenarioKey of SCENARIO_KEYS) {
        if (!dealData.scenarios?.[scenarioKey]) continue;

        let proforma: any = null;
        let mcResult: any = null;
        let factorResult: any = null;

        // 1. Underwriter Pro Forma
        try {
          const t0 = Date.now();
          proforma = buildProForma({ deal: dealData, scenarioKey, overrides: {} });
          await insertEngineResult(db, {
            dealId,
            engineName: 'underwriter',
            scenarioKey,
            input: { scenarioKey, month: currentMonth, assumptionFingerprint: fingerprint },
            output: proforma as unknown as Record<string, unknown>,
            durationMs: Date.now() - t0,
            triggeredBy: triggerEvent,
          });
        } catch (err: any) {
          errors.push(`underwriter[${scenarioKey}]: ${err.message}`);
        }

        // 2. Monte Carlo
        try {
          const t0 = Date.now();
          mcResult = runMonteCarlo({ deal: dealData, iterations: 5000 });
          await insertEngineResult(db, {
            dealId,
            engineName: 'montecarlo',
            scenarioKey,
            input: { scenarioKey, month: currentMonth, iterations: 5000 },
            output: mcResult as unknown as Record<string, unknown>,
            durationMs: Date.now() - t0,
            triggeredBy: triggerEvent,
          });
        } catch (err: any) {
          errors.push(`montecarlo[${scenarioKey}]: ${err.message}`);
        }

        // 3. Factor Scoring
        try {
          const t0 = Date.now();
          factorResult = scoreFactors({ deal: dealData });
          await insertEngineResult(db, {
            dealId,
            engineName: 'factor',
            scenarioKey,
            input: { scenarioKey, month: currentMonth },
            output: factorResult as unknown as Record<string, unknown>,
            durationMs: Date.now() - t0,
            triggeredBy: triggerEvent,
          });
        } catch (err: any) {
          errors.push(`factor[${scenarioKey}]: ${err.message}`);
        }

        // 4. Decision Engine + Recommendation
        if (proforma) {
          try {
            const t0 = Date.now();
            const decision = evaluateDecision({
              deal: dealData,
              proformaResult: proforma,
              factorResult: factorResult ?? undefined,
              mcResult: mcResult ?? undefined,
              budgetResult: undefined,
              currentRecommendation: undefined,
            });
            await insertEngineResult(db, {
              dealId,
              engineName: 'decision',
              scenarioKey,
              input: { scenarioKey, month: currentMonth },
              output: decision as unknown as Record<string, unknown>,
              durationMs: Date.now() - t0,
              triggeredBy: triggerEvent,
            });

            const prevRec = await getLatestRecommendationByScenario(db, dealId, scenarioKey);
            const prevVerdict = prevRec?.verdict ?? null;
            const isFlip = prevVerdict != null && prevVerdict !== decision.verdict;

            await insertRecommendation(db, {
              dealId,
              scenarioKey,
              verdict: decision.verdict,
              confidence: decision.confidence,
              triggerEvent,
              proformaSnapshot: {
                irr: proforma.irr,
                npv: proforma.npv,
                equityMultiple: proforma.equityMultiple,
                avgDSCR: proforma.avgDSCR,
                paybackYear: proforma.paybackYear,
              },
              gateResults: decision.gateResults,
              explanation: decision.explanation,
              previousVerdict: prevVerdict,
              isFlip,
            });
          } catch (err: any) {
            errors.push(`decision[${scenarioKey}]: ${err.message}`);
          }
        }
      }

      // ── Deal-level engines ──
      try {
        const t0 = Date.now();
        const budget = analyzeBudget({
          deal: dealData,
          budgetLines: dealData.budgetLines ?? [],
          changeOrders: dealData.changeOrders ?? [],
          rfis: dealData.rfis ?? [],
          milestones: dealData.milestones ?? [],
          asOfMonth: currentMonth,
        });
        await insertEngineResult(db, {
          dealId,
          engineName: 'budget',
          scenarioKey: activeScenario,
          input: { scenarioKey: activeScenario, month: currentMonth },
          output: budget as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: triggerEvent,
        });
      } catch (err: any) {
        errors.push(`budget: ${err.message}`);
      }

      try {
        const t0 = Date.now();
        const capex = deal.capexPlan as any;
        const constructionMonths = capex?.phase1?.durationMonths ?? 24;
        const scurve = distributeSCurve({
          items: (capex?.lineItems ?? []).map((li: any) => ({
            name: li.description ?? li.name ?? 'item',
            amount: li.budgetCr ? li.budgetCr * 1e7 : li.amount ?? 0,
            startMonth: li.startMonth ?? 0,
            endMonth: li.endMonth ?? constructionMonths,
            curveType: li.curveType ?? 's-curve',
          })),
          totalMonths: constructionMonths,
        });
        await insertEngineResult(db, {
          dealId,
          engineName: 'scurve',
          scenarioKey: activeScenario,
          input: { scenarioKey: activeScenario, month: currentMonth },
          output: scurve as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: triggerEvent,
        });
      } catch (err: any) {
        errors.push(`scurve: ${err.message}`);
      }

      return {
        ok: true,
        currentMonth,
        advancedMonth: advanceMonth,
        warnings: errors.length > 0 ? errors : undefined,
      };
    });

    if ((result as any)?.error === 'Deal not found') {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/deals/[id]/revalue failed:', err);
    return NextResponse.json({ ok: false, error: 'Revaluation failed' }, { status: 500 });
  }
}
