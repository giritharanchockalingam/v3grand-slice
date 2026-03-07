import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getRisksByDeal, getRiskSummary, createRisk, updateRisk, deleteRisk, insertAuditEntry } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { risks, summary } = await withRLS(user.userId, user.role, async (db) => {
      const [allRisks, riskSummary] = await Promise.all([
        getRisksByDeal(db, dealId),
        getRiskSummary(db, dealId),
      ]);
      return { risks: allRisks, summary: riskSummary };
    });
    return NextResponse.json({ risks, summary });
  } catch (err) {
    console.error('GET /api/deals/[id]/risks failed:', err);
    return NextResponse.json({ error: 'Failed to fetch risks' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const risk = await withRLS(user.userId, user.role, async (db) => {
      const created = await createRisk(db, {
        dealId,
        title: body.title,
        description: body.description,
        category: body.category,
        likelihood: body.likelihood,
        impact: body.impact,
        mitigation: body.mitigation,
        owner: body.owner,
        createdBy: user.userId,
      });

      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'risks', action: 'risk.created',
        entityType: 'risk', entityId: created!.id,
        diff: { title: body.title, category: body.category },
      });

      return created;
    });

    return NextResponse.json(risk, { status: 201 });
  } catch (err) {
    console.error('POST /api/deals/[id]/risks failed:', err);
    return NextResponse.json({ error: 'Failed to create risk' }, { status: 500 });
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
    const { riskId, ...updates } = body;
    if (!riskId) return NextResponse.json({ error: 'riskId is required' }, { status: 400 });

    const updated = await withRLS(user.userId, user.role, async (db) => {
      const result = await updateRisk(db, riskId, updates);

      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'risks', action: 'risk.updated',
        entityType: 'risk', entityId: riskId,
        diff: updates,
      });

      return result;
    });

    if (!updated) return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/deals/[id]/risks failed:', err);
    return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 });
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

    const { searchParams } = new URL(request.url);
    const riskId = searchParams.get('riskId');
    if (!riskId) return NextResponse.json({ error: 'riskId query param required' }, { status: 400 });

    const deleted = await withRLS(user.userId, user.role, async (db) => {
      const result = await deleteRisk(db, riskId);

      if (result) {
        await insertAuditEntry(db, {
          dealId, userId: user.userId, role: user.role,
          module: 'risks', action: 'risk.deleted',
          entityType: 'risk', entityId: riskId,
          diff: { title: result.title },
        });
      }

      return result;
    });

    if (!deleted) return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    return NextResponse.json({ message: 'Risk deleted', risk: deleted });
  } catch (err) {
    console.error('DELETE /api/deals/[id]/risks failed:', err);
    return NextResponse.json({ error: 'Failed to delete risk' }, { status: 500 });
  }
}
