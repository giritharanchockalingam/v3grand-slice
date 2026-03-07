import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getDealById } from '@v3grand/db';
import { buildProForma } from '@v3grand/engines';
import type { Deal } from '@v3grand/core';

/**
 * GET /api/deals/[dealId]/capital-structure-scenarios
 * Computes IRR / NPV / DSCR across different debt-equity splits.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return null;

      const fa = (deal.financialAssumptions ?? {}) as any;
      const baseDebtRatio = fa.debtRatio ?? 0.65;

      // Generate capital structure scenarios at different debt ratios
      const debtLevels = [0.0, 0.3, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8];
      const scenarios = debtLevels.map(debtRatio => {
        try {
          const overrides = { debtRatio, equityRatio: 1 - debtRatio };
          const pf = buildProForma({ deal: deal as unknown as Deal, scenarioKey: 'base', overrides });
          const riskLevel = debtRatio <= 0.5 ? 'low' : debtRatio <= 0.65 ? 'moderate' : debtRatio <= 0.75 ? 'elevated' : 'high';
          const isBase = Math.abs(debtRatio - baseDebtRatio) < 0.01;
          return {
            debtPct: Math.round(debtRatio * 100),
            equityPct: Math.round((1 - debtRatio) * 100),
            irr: pf.irr,
            npv: pf.npv,
            avgDSCR: pf.avgDSCR,
            riskLevel,
            recommendation: isBase ? 'Current structure' :
              debtRatio < baseDebtRatio ? 'More conservative' : 'More leveraged',
          };
        } catch {
          return {
            debtPct: Math.round(debtRatio * 100),
            equityPct: Math.round((1 - debtRatio) * 100),
            irr: 0, npv: 0, avgDSCR: 0,
            riskLevel: 'unknown',
            recommendation: 'Unable to compute',
          };
        }
      });

      return { dealId, scenarios };
    });

    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/deals/[id]/capital-structure-scenarios failed:', err);
    return NextResponse.json({ error: 'Failed to compute capital structure scenarios' }, { status: 500 });
  }
}
