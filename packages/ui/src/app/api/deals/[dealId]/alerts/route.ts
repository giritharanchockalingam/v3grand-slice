import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getRecentAudit } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use audit entries with warning/critical severity as alerts
    const audit = await withRLS(user.userId, user.role, (db) =>
      getRecentAudit(db, dealId, 20)
    );
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
