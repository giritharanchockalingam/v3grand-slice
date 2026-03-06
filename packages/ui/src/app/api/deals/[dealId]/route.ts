import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById, updateDealStatus, getRisksByDeal, insertAuditEntry } from '@v3grand/db';

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
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(deal);
  } catch (err) {
    console.error('GET /api/deals/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, lifecyclePhase } = body;

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { _notFound: true as const };

      if (status === 'active') {
        const risks = await getRisksByDeal(db, dealId);
        if (risks.length < 1) {
          return { _riskRequired: true as const };
        }
      }

      const updated = await updateDealStatus(db, dealId, { status, lifecyclePhase });
      if (status != null || lifecyclePhase != null) {
        await insertAuditEntry(db, {
          dealId, userId: user.userId, role: user.role,
          module: 'deals', action: 'deal.updated',
          entityType: 'deal', entityId: dealId,
          diff: { status: status ?? deal.status, lifecyclePhase: lifecyclePhase ?? deal.lifecyclePhase },
        });
      }
      return updated ?? deal;
    });

    if (result && '_notFound' in result) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    if (result && '_riskRequired' in result) {
      return NextResponse.json({
        error: 'At least one risk entry is required before activating a deal',
        code: 'RISK_REQUIRED_FOR_ACTIVE',
      }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH /api/deals/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}
