/**
 * POST /api/deals/[dealId]/underwrite
 *
 * Runs the full engine pipeline for the deal's active scenario:
 *   underwriter → montecarlo → factor → budget → scurve → decision
 *
 * Stores results in engine_results table and updates the recommendation.
 * Called by the "Recompute" button on the deal dashboard.
 */

import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById,
  insertEngineResult,
  insertRecommendation,
  getLatestRecommendation,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { ok: false, error: 'Deal not found' };

      const scenarioKey = (deal.activeScenarioKey ?? 'base') as 'bear' | 'base' | 'bull';
      const dealData = deal as any; // Full deal object for engine consumption
      const fingerprint = computeAssumptionFingerprint({
        marketAssumptions: deal.marketAssumptions,
        financialAssumptions: deal.financialAssumptions,
        capexPlan: deal.capexPlan,
        opexModel: dealData.opexModel,
        scenarios: dealData.scenarios,
        property: deal.property,
        partnership: deal.partnership,
      });

      const errors: string[] = [];

      // ── 1. Underwriter Pro Forma ──
      let proforma: any = null;
      try {
        const t0 = Date.now();
        proforma = buildProForma({
          deal: dealData,
          scenarioKey,
          overrides: {},
        });
        await insertEngineResult(db, {
          dealId,
          engineName: 'underwriter',
          scenarioKey,
          input: { scenarioKey, assumptionFingerprint: fingerprint },
          output: proforma as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`underwriter: ${err.message}`);
        console.error('Underwriter failed:', err);
      }

      // ── 2. Monte Carlo Simulation ──
      let mcResult: any = null;
      try {
        const t0 = Date.now();
        mcResult = runMonteCarlo({
          deal: dealData,
          iterations: 5000,
        });
        await insertEngineResult(db, {
          dealId,
          engineName: 'montecarlo',
          scenarioKey,
          input: { scenarioKey, iterations: 5000, assumptionFingerprint: fingerprint },
          output: mcResult as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`montecarlo: ${err.message}`);
        console.error('MonteCarlo failed:', err);
      }

      // ── 3. Factor Scoring ──
      let factorResult: any = null;
      try {
        const t0 = Date.now();
        factorResult = scoreFactors({ deal: dealData });
        await insertEngineResult(db, {
          dealId,
          engineName: 'factor',
          scenarioKey,
          input: { scenarioKey, assumptionFingerprint: fingerprint },
          output: factorResult as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`factor: ${err.message}`);
        console.error('Factor failed:', err);
      }

      // ── 4. Budget Variance Analysis ──
      try {
        const t0 = Date.now();
        // Budget engine needs construction data — pass empty arrays if not available
        const budget = analyzeBudget({
          deal: dealData,
          budgetLines: dealData.budgetLines ?? [],
          changeOrders: dealData.changeOrders ?? [],
          rfis: dealData.rfis ?? [],
          milestones: dealData.milestones ?? [],
          asOfMonth: dealData.currentMonth ?? 0,
        });
        await insertEngineResult(db, {
          dealId,
          engineName: 'budget',
          scenarioKey,
          input: { scenarioKey, assumptionFingerprint: fingerprint },
          output: budget as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`budget: ${err.message}`);
        console.error('Budget failed:', err);
      }

      // ── 5. S-Curve CAPEX Distribution ──
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
          scenarioKey,
          input: { scenarioKey, assumptionFingerprint: fingerprint },
          output: scurve as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`scurve: ${err.message}`);
        console.error('SCurve failed:', err);
      }

      // ── 6. Decision Engine (requires pro forma) ──
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
            input: { scenarioKey, assumptionFingerprint: fingerprint },
            output: decision as unknown as Record<string, unknown>,
            durationMs: Date.now() - t0,
            triggeredBy: 'dashboard-recompute',
          });

          // ── Update Recommendation ──
          const prevRec = await getLatestRecommendation(db, dealId);
          const prevVerdict = prevRec?.verdict ?? null;
          const isFlip = prevVerdict != null && prevVerdict !== decision.verdict;

          await insertRecommendation(db, {
            dealId,
            scenarioKey,
            verdict: decision.verdict,
            confidence: decision.confidence,
            triggerEvent: 'dashboard.recompute',
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
          errors.push(`decision: ${err.message}`);
          console.error('Decision failed:', err);
        }
      }

      if (errors.length > 0 && !proforma) {
        return { ok: false, error: errors.join('; ') };
      }

      return {
        ok: true,
        engines: {
          underwriter: proforma ? 'success' : 'failed',
          montecarlo: errors.some(e => e.startsWith('montecarlo')) ? 'failed' : 'success',
          factor: errors.some(e => e.startsWith('factor')) ? 'failed' : 'success',
          budget: errors.some(e => e.startsWith('budget')) ? 'failed' : 'success',
          scurve: errors.some(e => e.startsWith('scurve')) ? 'failed' : 'success',
          decision: errors.some(e => e.startsWith('decision')) ? 'failed' : 'success',
        },
        warnings: errors.length > 0 ? errors : undefined,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/deals/[id]/underwrite failed:', err);
    return NextResponse.json({ ok: false, error: 'Engine pipeline failed' }, { status: 500 });
  }
}
