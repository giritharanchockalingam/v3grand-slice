import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById, updateDealAssumptions, insertAuditEntry } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const deal = await getDealById(db, dealId);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({
      marketAssumptions: deal.marketAssumptions,
      financialAssumptions: deal.financialAssumptions,
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/assumptions failed:', err);
    return NextResponse.json({ error: 'Failed to fetch assumptions' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deal = await getDealById(db, dealId);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const body = await request.json();
    const { marketAssumptions, financialAssumptions } = body;

    // Merge patch into existing assumptions
    const updatedMarket = marketAssumptions
      ? { ...(deal.marketAssumptions as object), ...marketAssumptions }
      : undefined;
    const updatedFinancial = financialAssumptions
      ? { ...(deal.financialAssumptions as object), ...financialAssumptions }
      : undefined;

    await updateDealAssumptions(db, dealId, {
      marketAssumptions: updatedMarket,
      financialAssumptions: updatedFinancial,
    });

    // Re-fetch the deal so we return the persisted state
    const updatedDeal = await getDealById(db, dealId);

    await insertAuditEntry(db, {
      dealId,
      userId: user.userId,
      role: user.role,
      module: 'assumptions',
      action: 'assumption.updated',
      entityType: 'deal',
      entityId: dealId,
      diff: { market: marketAssumptions, financial: financialAssumptions },
    });

    return NextResponse.json({
      message: 'Assumptions updated',
      deal: updatedDeal ?? undefined,
    });
  } catch (err) {
    console.error('PATCH /api/deals/[id]/assumptions failed:', err);
    return NextResponse.json({ error: 'Failed to update assumptions' }, { status: 500 });
  }
}
