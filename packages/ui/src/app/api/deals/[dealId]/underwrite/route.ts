/**
 * POST /api/deals/[dealId]/underwrite
 *
 * Runs the full engine pipeline for ALL scenarios (bear, base, bull):
 *   underwriter → montecarlo → factor → budget → scurve → decision
 *
 * Stores results in engine_results table and updates recommendations.
 * Called by the "Recompute" button on the deal dashboard.
 */

import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById,
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

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { ok: false, error: 'Deal not found' };

      const activeScenario = (deal.activeScenarioKey ?? 'base') as ScenarioKey;
      const dealData = deal as any;
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
      const scenarioResults: Record<string, { proforma: any; mc: any; factor: any }> = {};

      // ── Run scenario-dependent engines for ALL scenarios ──
      for (const scenarioKey of SCENARIO_KEYS) {
        // Skip scenarios that aren't defined in the deal
        if (!dealData.scenarios?.[scenarioKey]) {
          continue;
        }

        let proforma: any = null;
        let mcResult: any = null;
        let factorResult: any = null;

        // ── 1. Underwriter Pro Forma ──
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
          errors.push(`underwriter[${scenarioKey}]: ${err.message}`);
          console.error(`Underwriter [${scenarioKey}] failed:`, err);
        }

        // ── 2. Monte Carlo Simulation ──
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
          errors.push(`montecarlo[${scenarioKey}]: ${err.message}`);
          console.error(`MonteCarlo [${scenarioKey}] failed:`, err);
        }

        // ── 3. Factor Scoring ──
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
          errors.push(`factor[${scenarioKey}]: ${err.message}`);
          console.error(`Factor [${scenarioKey}] failed:`, err);
        }

        scenarioResults[scenarioKey] = { proforma, mc: mcResult, factor: factorResult };

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
            const prevRec = await getLatestRecommendationByScenario(db, dealId, scenarioKey);
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
            errors.push(`decision[${scenarioKey}]: ${err.message}`);
            console.error(`Decision [${scenarioKey}] failed:`, err);
          }
        }
      }

      // ── Deal-level engines (not scenario-dependent) ──

      // ── 4. Budget Variance Analysis ──
      try {
        const t0 = Date.now();
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
          scenarioKey: activeScenario,
          input: { scenarioKey: activeScenario, assumptionFingerprint: fingerprint },
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
          scenarioKey: activeScenario,
          input: { scenarioKey: activeScenario, assumptionFingerprint: fingerprint },
          output: scurve as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
          triggeredBy: 'dashboard-recompute',
        });
      } catch (err: any) {
        errors.push(`scurve: ${err.message}`);
        console.error('SCurve failed:', err);
      }

      const anyProforma = Object.values(scenarioResults).some(r => r.proforma);
      if (errors.length > 0 && !anyProforma) {
        return { ok: false, error: errors.join('; ') };
      }

      return {
        ok: true,
        scenarios: Object.fromEntries(
          Object.entries(scenarioResults).map(([key, r]) => [
            key,
            { underwriter: r.proforma ? 'success' : 'failed' },
          ])
        ),
        engines: {
          budget: errors.some(e => e.startsWith('budget')) ? 'failed' : 'success',
          scurve: errors.some(e => e.startsWith('scurve')) ? 'failed' : 'success',
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
