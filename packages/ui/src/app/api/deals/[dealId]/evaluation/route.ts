import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getDealById } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const deal = await getDealById(db, dealId);
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
