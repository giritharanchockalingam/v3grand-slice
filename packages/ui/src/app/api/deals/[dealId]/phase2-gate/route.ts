import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById, getLatestEngineResultByScenario, getLatestEngineResult, getLatestRecommendation } from '@v3grand/db';

/**
 * GET /api/deals/[dealId]/phase2-gate
 * Phase 2 (Land Acquisition) gate criteria evaluation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return null;

      const [uw, factor, rec] = await Promise.all([
        getLatestEngineResultByScenario(db, dealId, 'underwriter', 'base'),
        getLatestEngineResult(db, dealId, 'factor'),
        getLatestRecommendation(db, dealId),
      ]);

      const pf = uw ? (uw.output as any) : null;
      const factorOutput = factor ? (factor.output as any) : null;
      const fa = (deal.financialAssumptions ?? {}) as any;

      // Phase 2 gate criteria for land acquisition approval
      const irr = pf?.irr ?? 0;
      const avgDSCR = pf?.avgDSCR ?? 0;
      const npv = pf?.npv ?? 0;
      const totalScore = factorOutput?.totalScore ?? 0;

      const criteria = [
        {
          name: 'IRR exceeds hurdle rate',
          threshold: fa.targetIRR ?? 15,
          current: irr,
          passed: irr >= (fa.targetIRR ?? 15),
          notes: pf ? `IRR ${Number.isFinite(irr) ? irr.toFixed(1) : '0.0'}% vs ${fa.targetIRR ?? 15}% hurdle` : 'No underwriter result yet',
        },
        {
          name: 'DSCR above minimum',
          threshold: fa.targetDSCR ?? 1.25,
          current: avgDSCR,
          passed: avgDSCR >= (fa.targetDSCR ?? 1.25),
          notes: pf ? `DSCR ${Number.isFinite(avgDSCR) ? avgDSCR.toFixed(2) : '0.00'}x vs ${fa.targetDSCR ?? 1.25}x min` : 'No underwriter result yet',
        },
        {
          name: 'Positive NPV',
          threshold: 0,
          current: npv,
          passed: npv > 0,
          notes: pf ? `NPV ₹${Number.isFinite(npv) ? (npv / 10000000).toFixed(1) : '0.0'} Cr` : 'No underwriter result yet',
        },
        {
          name: 'Factor score above threshold',
          threshold: 60,
          current: totalScore,
          passed: totalScore >= 60,
          notes: factorOutput ? `Score ${Number.isFinite(totalScore) ? totalScore.toFixed(0) : '0'}/100` : 'No factor analysis yet',
        },
        {
          name: 'IC recommendation not PASS',
          threshold: 0,
          current: undefined,
          passed: rec ? rec.verdict !== 'PASS' : false,
          notes: rec ? `Current verdict: ${rec.verdict}` : 'No recommendation yet',
        },
      ];

      const passedCount = criteria.filter(c => c.passed).length;
      const totalCount = criteria.length;
      const verdict = passedCount === totalCount ? 'APPROVED' :
        passedCount >= totalCount * 0.6 ? 'CONDITIONAL' : 'NOT READY';

      return {
        dealId,
        phase2Gate: { criteria, passedCount, totalCount, verdict },
      };
    });

    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/deals/[id]/phase2-gate failed:', err);
    return NextResponse.json({ error: 'Failed to evaluate phase 2 gate' }, { status: 500 });
  }
}
