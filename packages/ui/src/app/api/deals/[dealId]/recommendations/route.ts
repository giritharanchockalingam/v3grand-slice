import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getRecommendationHistory } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const history = await getRecommendationHistory(db, dealId, 50);

    return NextResponse.json({
      history: history.map(r => ({
        version: r.version, verdict: r.verdict, confidence: r.confidence,
        timestamp: r.createdAt.toISOString(), triggerEvent: r.triggerEvent,
        scenarioKey: r.scenarioKey, explanation: r.explanation,
        previousVerdict: r.previousVerdict, isFlip: r.isFlip === 'true',
      })),
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/recommendations failed:', err);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
