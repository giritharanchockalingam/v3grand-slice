import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById, getLatestEngineResult, getLatestEngineResultByScenario,
  getLatestRecommendation, getRecentAudit, getConstructionSummary,
} from '@v3grand/db';
import { recommendations } from '@v3grand/db';
import { eq, desc } from 'drizzle-orm';
import { computeAssumptionFingerprint } from '@v3grand/engines';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await withRLS(user.userId, user.role, async (db) => {
      const dealRow = await getDealById(db, dealId);
      if (!dealRow) return null;

      const [latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestSCurveResult, latestDecisionResult, audit, constructionSummary] = await Promise.all([
        getLatestEngineResultByScenario(db, dealId, 'underwriter', 'base'),
        getLatestRecommendation(db, dealId),
        getLatestEngineResult(db, dealId, 'montecarlo'),
        getLatestEngineResult(db, dealId, 'factor'),
        getLatestEngineResult(db, dealId, 'budget'),
        getLatestEngineResult(db, dealId, 'scurve'),
        getLatestEngineResult(db, dealId, 'decision'),
        getRecentAudit(db, dealId, 50),
        getConstructionSummary(db, dealId),
      ]);

      const recHistory = await db.select()
        .from(recommendations)
        .where(eq(recommendations.dealId, dealId))
        .orderBy(desc(recommendations.version))
        .limit(20);

      return { dealRow, latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestSCurveResult, latestDecisionResult, audit, constructionSummary, recHistory };
    });

    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const { dealRow, latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestSCurveResult, latestDecisionResult, audit, constructionSummary, recHistory } = data;

    const latestProforma = latestUW ? (() => {
      const output = latestUW.output as any;
      return {
        scenarioKey: output.scenarioKey, years: output.years, irr: output.irr,
        npv: output.npv, equityMultiple: output.equityMultiple, avgDSCR: output.avgDSCR,
        paybackYear: output.paybackYear, exitValue: output.exitValue,
        totalInvestment: output.totalInvestment, equityInvestment: output.equityInvestment,
      };
    })() : null;

    const latestRecommendation = latestRec ? {
      id: latestRec.id, dealId: latestRec.dealId, version: latestRec.version,
      timestamp: latestRec.createdAt.toISOString(),
      verdict: latestRec.verdict, confidence: latestRec.confidence,
      triggerEvent: latestRec.triggerEvent,
      proformaSnapshot: latestRec.proformaSnapshot,
      gateResults: latestRec.gateResults,
      explanation: latestRec.explanation,
      previousVerdict: latestRec.previousVerdict,
      isFlip: latestRec.isFlip === 'true',
    } : null;

    const constructionProgress = constructionSummary ? {
      totalBudget: constructionSummary.totalBudget,
      actualSpend: constructionSummary.totalActualSpend,
      commitments: constructionSummary.totalCommitments,
      approvedCOs: constructionSummary.totalApprovedCOs,
      variance: constructionSummary.budgetVariance,
      completionPct: constructionSummary.completionPct,
    } : null;

    const recentEvents = audit.map((a: any) => {
      let severity: string = 'info';
      if (a.action.includes('failed') || a.action.includes('crash')) severity = 'critical';
      else if (a.action.includes('flip') || a.action.includes('overrun')) severity = 'warning';
      return {
        id: a.id, type: a.action, timestamp: a.timestamp.toISOString(),
        description: `${a.module}: ${a.action}`, module: a.module, severity, userId: a.userId, diff: a.diff,
      };
    });

    // ── Staleness detection: compare deal fingerprint to latest engine result ──
    const currentFingerprint = computeAssumptionFingerprint({
      marketAssumptions: dealRow.marketAssumptions,
      financialAssumptions: dealRow.financialAssumptions,
      capexPlan: dealRow.capexPlan,
      opexModel: (dealRow as any).opexModel,
      scenarios: (dealRow as any).scenarios,
      property: dealRow.property,
      partnership: dealRow.partnership,
    });

    // Check the latest underwriter result's fingerprint (most critical engine)
    const latestEngineFingerprint = latestUW
      ? (latestUW.input as any)?.assumptionFingerprint ?? null
      : null;

    const resultsStale = latestEngineFingerprint != null
      ? currentFingerprint !== latestEngineFingerprint
      : latestUW != null; // No fingerprint on old result = assume stale

    return NextResponse.json({
      deal: {
        id: dealRow.id, name: dealRow.name, assetClass: dealRow.assetClass,
        status: dealRow.status, lifecyclePhase: dealRow.lifecyclePhase,
        currentMonth: dealRow.currentMonth, version: dealRow.version,
      },
      activeScenario: dealRow.activeScenarioKey,
      property: dealRow.property,
      partnership: dealRow.partnership,
      marketAssumptions: dealRow.marketAssumptions,
      financialAssumptions: dealRow.financialAssumptions,
      capexPlan: dealRow.capexPlan,
      latestRecommendation,
      latestProforma,
      latestMC: latestMCResult ? (latestMCResult.output as any) : null,
      latestFactor: latestFactorResult ? (latestFactorResult.output as any) : null,
      latestBudget: latestBudgetResult ? (latestBudgetResult.output as any) : null,
      latestSCurve: latestSCurveResult ? (latestSCurveResult.output as any) : null,
      budgetSummary: latestBudgetResult ? (() => {
        const b = latestBudgetResult.output as any;
        return { overallStatus: b.overallStatus, varianceToCurrent: b.varianceToCurrent, alerts: b.alerts ?? [] };
      })() : null,
      constructionProgress,
      decisionInsight: latestDecisionResult ? (() => {
        const d = latestDecisionResult.output as any;
        return {
          narrative: d.narrative ?? '', topDrivers: d.topDrivers ?? [],
          topRisks: d.topRisks ?? [], flipConditions: d.flipConditions ?? [], riskFlags: d.riskFlags ?? [],
        };
      })() : null,
      recentEvents,
      recommendationHistory: recHistory.map((r: any) => ({
        version: r.version, verdict: r.verdict, confidence: r.confidence,
        timestamp: r.createdAt.toISOString(), scenarioKey: r.scenarioKey,
        explanation: r.explanation, previousVerdict: r.previousVerdict,
        isFlip: r.isFlip === 'true', gateResults: r.gateResults,
      })),
      // Staleness detection: true if assumptions changed since last engine run
      resultsStale,
      assumptionFingerprint: currentFingerprint,
      lastEngineFingerprint: latestEngineFingerprint,
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/dashboard failed:', err);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
