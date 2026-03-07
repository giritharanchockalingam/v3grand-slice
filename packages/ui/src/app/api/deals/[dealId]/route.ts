import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById, updateDealStatus, updateDeal, softDeleteDeal, getRisksByDeal, insertAuditEntry } from '@v3grand/db';

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
    const { status, lifecyclePhase, name, property, partnership, marketAssumptions, financialAssumptions, capexPlan, opexModel, scenarios, activeScenarioKey } = body;

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { _notFound: true as const };

      // Gate: require ≥1 risk to activate
      if (status === 'active') {
        const risks = await getRisksByDeal(db, dealId);
        if (risks.length < 1) {
          return { _riskRequired: true as const };
        }
      }

      // Build update payload — only include fields that were sent
      const updates: Record<string, unknown> = {};
      if (status != null) updates.status = status;
      if (lifecyclePhase != null) updates.lifecyclePhase = lifecyclePhase;
      if (name != null) updates.name = name;
      if (property != null) updates.property = property;
      if (partnership != null) updates.partnership = partnership;
      if (marketAssumptions != null) updates.marketAssumptions = marketAssumptions;
      if (financialAssumptions != null) updates.financialAssumptions = financialAssumptions;
      if (capexPlan != null) updates.capexPlan = capexPlan;
      if (opexModel != null) updates.opexModel = opexModel;
      if (scenarios != null) updates.scenarios = scenarios;
      if (activeScenarioKey != null) updates.activeScenarioKey = activeScenarioKey;

      if (Object.keys(updates).length === 0) {
        return deal; // Nothing to update
      }

      const updated = await updateDeal(db, dealId, updates);

      // Audit trail
      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'deals', action: 'deal.updated',
        entityType: 'deal', entityId: dealId,
        diff: updates,
      });

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return null;

      const archived = await softDeleteDeal(db, dealId);

      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'deals', action: 'deal.archived',
        entityType: 'deal', entityId: dealId,
        diff: { previousStatus: deal.status, newStatus: 'archived' },
      });

      return archived;
    });

    if (!result) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({ message: 'Deal archived', deal: result });
  } catch (err) {
    console.error('DELETE /api/deals/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to archive deal' }, { status: 500 });
  }
}
