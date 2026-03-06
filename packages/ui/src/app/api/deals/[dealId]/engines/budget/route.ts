import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getLatestEngineResult } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await withRLS(user.userId, user.role, (db) =>
      getLatestEngineResult(db, dealId, 'budget')
    );
    if (!result) return NextResponse.json({ results: null, status: 'not_run' });
    return NextResponse.json({ results: result.output, status: 'completed', version: result.version });
  } catch (err) {
    console.error('GET budget failed:', err);
    return NextResponse.json({ results: null, status: 'error' }, { status: 500 });
  }
}
