import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getLatestEngineResult } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const result = await getLatestEngineResult(db, dealId, 'montecarlo');
    if (!result) return NextResponse.json({ results: null, status: 'not_run' });
    return NextResponse.json({ results: result.output, status: 'completed', version: result.version });
  } catch (err) {
    console.error('GET montecarlo failed:', err);
    return NextResponse.json({ results: null, status: 'error' }, { status: 500 });
  }
}
