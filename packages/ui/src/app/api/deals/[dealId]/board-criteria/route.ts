import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById, getLatestEngineResultByScenario } from '@v3grand/db';

/**
 * GET /api/deals/[dealId]/board-criteria
 * Returns board-level investment criteria evaluated against actuals.
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

      const uw = await getLatestEngineResultByScenario(db, dealId, 'underwriter', 'base');
      const pf = uw ? (uw.output as any) : null;

      const fa = (deal.financialAssumptions ?? {}) as any;

      // Board criteria: minimum thresholds vs actual engine outputs
      const boardCriteria = [
        {
          name: 'Minimum IRR',
          threshold: fa.targetIRR ?? 15,
          actual: pf?.irr ?? 0,
          passed: (pf?.irr ?? 0) >= (fa.targetIRR ?? 15),
        },
        {
          name: 'Minimum Equity Multiple',
          threshold: fa.targetEquityMultiple ?? 1.8,
          actual: pf?.equityMultiple ?? 0,
          passed: (pf?.equityMultiple ?? 0) >= (fa.targetEquityMultiple ?? 1.8),
        },
        {
          name: 'Minimum DSCR',
          threshold: fa.targetDSCR ?? 1.25,
          actual: pf?.avgDSCR ?? 0,
          passed: (pf?.avgDSCR ?? 0) >= (fa.targetDSCR ?? 1.25),
        },
        {
          name: 'Payback Period',
          threshold: 7,
          actual: pf?.paybackYear ?? 99,
          passed: (pf?.paybackYear ?? 99) <= 7,
        },
        {
          name: 'Positive NPV',
          threshold: 0,
          actual: pf?.npv ?? 0,
          passed: (pf?.npv ?? 0) > 0,
        },
      ];

      return { dealId, boardCriteria };
    });

    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/deals/[id]/board-criteria failed:', err);
    return NextResponse.json({ error: 'Failed to fetch board criteria' }, { status: 500 });
  }
}
