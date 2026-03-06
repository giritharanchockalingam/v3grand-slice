import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getBudgetLinesByDeal, getChangeOrdersByDeal, getRFIsByDeal, getMilestonesByDeal, getConstructionSummary } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();

    const [budgetLines, changeOrders, rfisList, milestonesList, summary] = await Promise.all([
      getBudgetLinesByDeal(db, dealId),
      getChangeOrdersByDeal(db, dealId),
      getRFIsByDeal(db, dealId),
      getMilestonesByDeal(db, dealId),
      getConstructionSummary(db, dealId),
    ]);

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
