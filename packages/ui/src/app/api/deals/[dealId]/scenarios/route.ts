import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getDealById, getScenarioResults, getScenarioRecommendations } from '@v3grand/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const db = getDb();
    const dealRow = await getDealById(db, dealId);
    if (!dealRow) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const [uwResults, recResults] = await Promise.all([
      getScenarioResults(db, dealId, 'underwriter'),
      getScenarioRecommendations(db, dealId),
    ]);

    const formatProforma = (uw: any) => uw ? (uw.output as any) : null;
    const formatRec = (rec: any) => rec ? {
      id: rec.id, dealId: rec.dealId, version: rec.version,
      timestamp: rec.createdAt.toISOString(), verdict: rec.verdict,
      confidence: rec.confidence, triggerEvent: rec.triggerEvent,
      proformaSnapshot: rec.proformaSnapshot, gateResults: rec.gateResults,
      explanation: rec.explanation, previousVerdict: rec.previousVerdict,
      isFlip: rec.isFlip === 'true',
    } : null;

    const bearPf = formatProforma(uwResults.bear);
    const basePf = formatProforma(uwResults.base);
    const bullPf = formatProforma(uwResults.bull);

    const expectedIRR = (bearPf?.irr ?? 0) * 0.2 + (basePf?.irr ?? 0) * 0.6 + (bullPf?.irr ?? 0) * 0.2;
    const expectedNPV = (bearPf?.npv ?? 0) * 0.2 + (basePf?.npv ?? 0) * 0.6 + (bullPf?.npv ?? 0) * 0.2;

    return NextResponse.json({
      dealId, activeScenario: dealRow.activeScenarioKey,
      probabilityWeights: { bear: 0.2, base: 0.6, bull: 0.2 },
      expectedIRR, expectedNPV,
      scenarios: {
        bear: { scenarioKey: 'bear', proforma: bearPf, recommendation: formatRec(recResults.bear) },
        base: { scenarioKey: 'base', proforma: basePf, recommendation: formatRec(recResults.base) },
        bull: { scenarioKey: 'bull', proforma: bullPf, recommendation: formatRec(recResults.bull) },
      },
    });
  } catch (err) {
    console.error('GET /api/deals/[id]/scenarios failed:', err);
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
  }
}
