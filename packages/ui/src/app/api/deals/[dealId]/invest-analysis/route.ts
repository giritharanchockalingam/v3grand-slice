// ─── GET /api/deals/[dealId]/invest-analysis ─────────────────────────
// Returns the latest 16-agent IC analysis for a deal
import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getLatestInvestAnalysis } from '@v3grand/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const analysis = await withRLS(user.userId, user.role, async (db) => {
      return getLatestInvestAnalysis(db, dealId);
    });

    if (!analysis) {
      return NextResponse.json({ ok: false, error: 'No IC analysis found for this deal' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: analysis.id,
        dealId: analysis.dealId,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        summary: analysis.summary,
        keyMetrics: analysis.keyMetrics,
        warnings: analysis.warnings,
        agentResults: analysis.agentResults,
        createdAt: analysis.createdAt,
      },
    });
  } catch (err) {
    console.error('[invest-analysis] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
