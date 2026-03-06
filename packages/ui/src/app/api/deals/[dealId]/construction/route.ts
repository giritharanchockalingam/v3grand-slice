import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getBudgetLinesByDeal, getChangeOrdersByDeal, getRFIsByDeal, getMilestonesByDeal, getConstructionSummary } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [budgetLines, changeOrders, rfisList, milestonesList, summary] = await withRLS(user.userId, user.role, (db) =>
      Promise.all([
        getBudgetLinesByDeal(db, dealId),
        getChangeOrdersByDeal(db, dealId),
        getRFIsByDeal(db, dealId),
        getMilestonesByDeal(db, dealId),
        getConstructionSummary(db, dealId),
      ])
    );

    return NextResponse.json({
      dashboard: {
        budgetLines, changeOrders, rfis: rfisList, milestones: milestonesList, summary,
      },
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/construction failed:', err);
    return NextResponse.json({ error: 'Failed to fetch construction data' }, { status: 500 });
  }
}
