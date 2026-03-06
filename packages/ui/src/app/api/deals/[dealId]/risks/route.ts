import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getRisksByDeal, createRisk } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const risks = await getRisksByDeal(db, dealId);
    return NextResponse.json({ risks });
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
    const db = getDb();
    const user = await getAuthUser(request);
    const body = await request.json();

    const risk = await createRisk(db, {
      dealId,
      title: body.title,
      description: body.description,
      category: body.category,
      likelihood: body.likelihood,
      impact: body.impact,
      mitigation: body.mitigation,
      owner: body.owner,
      createdBy: user?.userId ?? 'anonymous',
    });

    return NextResponse.json(risk, { status: 201 });
  } catch (err) {
    console.error('POST /api/deals/[id]/risks failed:', err);
    return NextResponse.json({ error: 'Failed to create risk' }, { status: 500 });
  }
}
