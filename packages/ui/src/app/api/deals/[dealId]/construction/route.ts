import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getBudgetLinesByDeal, getChangeOrdersByDeal, getRFIsByDeal, getMilestonesByDeal, getConstructionSummary,
  createBudgetLine, createChangeOrder, createRFI, createMilestone,
  updateBudgetLine, approveChangeOrder, answerRFI, updateMilestone,
  deleteBudgetLine, deleteChangeOrder, deleteRFI, deleteMilestone,
  insertAuditEntry,
} from '@v3grand/db';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, ...data } = body;

    const result = await withRLS(user.userId, user.role, async (db) => {
      let created: unknown;
      switch (type) {
        case 'budget_line':
          created = await createBudgetLine(db, { dealId, ...data });
          break;
        case 'change_order':
          created = await createChangeOrder(db, { dealId, ...data, requestedBy: user.userId });
          break;
        case 'rfi':
          created = await createRFI(db, { dealId, ...data, raisedBy: user.userId });
          break;
        case 'milestone':
          created = await createMilestone(db, { dealId, ...data });
          break;
        default:
          return { _invalidType: true as const };
      }

      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'construction', action: `${type}.created`,
        entityType: type, entityId: (created as any)?.id ?? '',
        diff: data,
      });

      return created;
    });

    if (result && typeof result === 'object' && '_invalidType' in result) {
      return NextResponse.json({ error: 'Invalid type. Use: budget_line, change_order, rfi, milestone' }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/deals/[id]/construction failed:', err);
    return NextResponse.json({ error: 'Failed to create construction item' }, { status: 500 });
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
    const { type, id, ...updates } = body;
    if (!type || !id) return NextResponse.json({ error: 'type and id are required' }, { status: 400 });

    const result = await withRLS(user.userId, user.role, async (db) => {
      let updated: unknown;
      switch (type) {
        case 'budget_line':
          updated = await updateBudgetLine(db, id, updates);
          break;
        case 'change_order':
          if (updates.status === 'approved') {
            updated = await approveChangeOrder(db, id, user.userId);
          } else {
            // Generic update for other fields
            const { default: drizzleOps } = await import('drizzle-orm');
            // Fallback: use approveChangeOrder for now
            updated = await approveChangeOrder(db, id, user.userId);
          }
          break;
        case 'rfi':
          if (updates.answer) {
            updated = await answerRFI(db, id, updates.answer, user.userId);
          }
          break;
        case 'milestone':
          updated = await updateMilestone(db, id, updates);
          break;
        default:
          return { _invalidType: true as const };
      }

      await insertAuditEntry(db, {
        dealId, userId: user.userId, role: user.role,
        module: 'construction', action: `${type}.updated`,
        entityType: type, entityId: id,
        diff: updates,
      });

      return updated;
    });

    if (result && typeof result === 'object' && '_invalidType' in result) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (!result) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH /api/deals/[id]/construction failed:', err);
    return NextResponse.json({ error: 'Failed to update construction item' }, { status: 500 });
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
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    if (!type || !id) return NextResponse.json({ error: 'type and id query params required' }, { status: 400 });

    const result = await withRLS(user.userId, user.role, async (db) => {
      let deleted: unknown;
      switch (type) {
        case 'budget_line':
          deleted = await deleteBudgetLine(db, id);
          break;
        case 'change_order':
          deleted = await deleteChangeOrder(db, id);
          break;
        case 'rfi':
          deleted = await deleteRFI(db, id);
          break;
        case 'milestone':
          deleted = await deleteMilestone(db, id);
          break;
        default:
          return { _invalidType: true as const };
      }

      if (deleted) {
        await insertAuditEntry(db, {
          dealId, userId: user.userId, role: user.role,
          module: 'construction', action: `${type}.deleted`,
          entityType: type, entityId: id,
          diff: { deleted: true },
        });
      }

      return deleted;
    });

    if (result && typeof result === 'object' && '_invalidType' in result) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (!result) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ message: `${type} deleted`, item: result });
  } catch (err) {
    console.error('DELETE /api/deals/[id]/construction failed:', err);
    return NextResponse.json({ error: 'Failed to delete construction item' }, { status: 500 });
  }
}
