import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getRecentAudit } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    // Use audit entries with warning/critical severity as alerts
    const audit = await getRecentAudit(db, dealId, 20);
    const alerts = audit
      .filter(a => a.action.includes('flip') || a.action.includes('overrun') || a.action.includes('failed') || a.action.includes('delayed'))
      .map(a => ({
        id: a.id,
        type: a.action,
        severity: a.action.includes('failed') || a.action.includes('crash') ? 'critical' : 'warning',
        message: `${a.module}: ${a.action}`,
        timestamp: a.timestamp.toISOString(),
        acknowledged: false,
      }));

    return NextResponse.json({ alerts });
  } catch (err) {
    console.error('GET /api/deals/[id]/alerts failed:', err);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
