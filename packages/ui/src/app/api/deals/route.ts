import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { listDealsByUser, listDeals } from '@v3grand/db';

export async function GET(request: Request) {
  try {
    const db = getDb();
    const user = await getAuthUser(request);

    // If authenticated, list deals by user access; otherwise list all (for demo)
    if (user) {
      const deals = await listDealsByUser(db, user.userId);
      return NextResponse.json(deals);
    }

    // Fallback: list all deals (for demo/unauthenticated access)
    const deals = await listDeals(db);
    return NextResponse.json(deals);
  } catch (err) {
    console.error('GET /api/deals failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch deals', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, assetClass } = body;
    if (!name || !assetClass) {
      return NextResponse.json({ error: 'name and assetClass are required' }, { status: 400 });
    }

    const { createDeal, grantDealAccess, insertAuditEntry } = await import('@v3grand/db');

    const defaults = {
      property: {
        location: { city: '', state: '', country: 'India', latitude: 0, longitude: 0, distanceToAirportKm: 0 },
        landArea: { sqft: 0, acres: 0 },
        grossBUA: { phase1Sqft: 0, phase2Sqft: 0, totalSqft: 0 },
        keys: { phase1: 0, phase2: 0, total: 0 },
        roomTypes: [],
        amenities: [],
        starRating: 5,
      },
      partnership: {
        structure: 'jv',
        partners: [{ id: 'lead', name: user.email ?? user.userId, equityPct: 1, role: 'lead-investor', commitmentCr: 0 }],
      },
      marketAssumptions: {
        segments: [{ name: 'Domestic Business', pctMix: 0.4, adrPremium: 1.0, seasonality: [1,1,1,0.8,0.7,0.6,0.6,0.7,0.8,1,1.2,1.3] }],
        occupancyRamp: [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72],
        adrBase: 5500, adrStabilized: 7000, adrGrowthRate: 0.05,
        revenueMix: { rooms: 0.55, fb: 0.25, banquet: 0.12, other: 0.08 },
        seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, multiplier: 1.0 })),
        compSet: [],
      },
      financialAssumptions: {
        wacc: 0.12, riskFreeRate: 0.065, equityRatio: 0.4, debtRatio: 0.6,
        debtInterestRate: 0.095, debtTenorYears: 15, exitCapRate: 0.08, exitMultiple: 8,
        taxRate: 0.25, inflationRate: 0.05, managementFeePct: 0.03, incentiveFeePct: 0.10,
        ffAndEReservePct: 0.04, workingCapitalDays: 30,
        targetIRR: 0.18, targetEquityMultiple: 2.5, targetDSCR: 1.2,
      },
      capexPlan: { phase1: { totalBudgetCr: 0, items: [] }, phase2: { totalBudgetCr: 0, items: [] }, contingencyPct: 0.10 },
      opexModel: { departments: [], undistributed: [], fixedCharges: [] },
      scenarios: {
        bear: { id: 'bear', name: 'bear', probability: 0.25, occupancyStabilized: 0.58, adrStabilized: 5800, ebitdaMargin: 0.28, mouRealizationPct: 0.6, phase2Trigger: false },
        base: { id: 'base', name: 'base', probability: 0.50, occupancyStabilized: 0.72, adrStabilized: 7000, ebitdaMargin: 0.35, mouRealizationPct: 0.75, phase2Trigger: true },
        bull: { id: 'bull', name: 'bull', probability: 0.25, occupancyStabilized: 0.82, adrStabilized: 8200, ebitdaMargin: 0.42, mouRealizationPct: 0.9, phase2Trigger: true },
      },
    };

    const deal = await createDeal(db, {
      name,
      assetClass,
      lifecyclePhase: body.lifecyclePhase ?? undefined,
      property: body.property ?? defaults.property,
      partnership: body.partnership ?? defaults.partnership,
      marketAssumptions: body.marketAssumptions ?? defaults.marketAssumptions,
      financialAssumptions: body.financialAssumptions ?? defaults.financialAssumptions,
      capexPlan: body.capexPlan ?? defaults.capexPlan,
      opexModel: body.opexModel ?? defaults.opexModel,
      scenarios: body.scenarios ?? defaults.scenarios,
      captureContext: body.captureContext ?? undefined,
    });

    await grantDealAccess(db, { userId: user.userId, dealId: deal.id, role: user.role });
    await insertAuditEntry(db, {
      dealId: deal.id, userId: user.userId, role: user.role,
      module: 'deals', action: 'deal.created',
      entityType: 'deal', entityId: deal.id,
      diff: { name, assetClass },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (err) {
    console.error('POST /api/deals failed:', err);
    return NextResponse.json(
      { error: 'Failed to create deal', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
