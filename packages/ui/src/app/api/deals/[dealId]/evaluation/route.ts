import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deal = await withRLS(user.userId, user.role, (db) =>
      getDealById(db, dealId)
    );
    if (!deal) return NextResponse.json(null);

    // Return the deal's property evaluation data
    return NextResponse.json({
      property: deal.property,
      marketAssumptions: deal.marketAssumptions,
      financialAssumptions: deal.financialAssumptions,
      capexPlan: deal.capexPlan,
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/evaluation failed:', err);
    return NextResponse.json(null);
  }
}
