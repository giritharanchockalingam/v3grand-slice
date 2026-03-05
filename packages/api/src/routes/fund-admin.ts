import type { FastifyInstance } from 'fastify';

export async function fundAdminRoutes(app: FastifyInstance, db: any) {
  // GET /fund/:id/waterfall - Calculate distribution waterfall
  app.get('/fund/:id/waterfall', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };

    const fund = await db.execute(`SELECT * FROM funds WHERE id = $1`, [id]);
    if (!fund.length) return { error: 'Fund not found' };

    const fundData = fund[0];
    const preferredReturn = fundData.preferred_return || 0.08;
    const gpCarry = fundData.gp_carry || 0.20;
    const catchUpRate = fundData.catch_up_rate || 1.0;

    // Get all distributions for this fund
    const distributions = await db.execute(
      `SELECT SUM(amount) AS total_distributed FROM distributions WHERE fund_id = $1`, [id]
    );
    const totalDistributed = distributions[0]?.total_distributed || 0;

    const capitalCalls = await db.execute(
      `SELECT SUM(amount) AS total_called FROM capital_calls WHERE fund_id = $1`, [id]
    );
    const totalCalled = capitalCalls[0]?.total_called || 0;

    // European-style waterfall calculation
    const returnOfCapital = Math.min(totalDistributed, totalCalled);
    const remainingAfterROC = Math.max(0, totalDistributed - totalCalled);
    const preferredAmount = totalCalled * preferredReturn;
    const preferredDistributed = Math.min(remainingAfterROC, preferredAmount);
    const remainingAfterPref = Math.max(0, remainingAfterROC - preferredAmount);

    // GP catch-up
    const catchUpTarget = (returnOfCapital + preferredDistributed) * gpCarry / (1 - gpCarry);
    const catchUpAmount = Math.min(remainingAfterPref * catchUpRate, catchUpTarget);
    const remainingAfterCatchUp = Math.max(0, remainingAfterPref - catchUpAmount);

    // Carried interest split
    const gpCarried = remainingAfterCatchUp * gpCarry;
    const lpProfit = remainingAfterCatchUp * (1 - gpCarry);

    return {
      fundId: id,
      waterfall: {
        totalCalled,
        totalDistributed,
        tiers: [
          { tier: 1, name: 'Return of Capital', amount: returnOfCapital, recipient: 'LP' },
          { tier: 2, name: 'Preferred Return', amount: preferredDistributed, rate: preferredReturn, recipient: 'LP' },
          { tier: 3, name: 'GP Catch-Up', amount: catchUpAmount, rate: catchUpRate, recipient: 'GP' },
          { tier: 4, name: 'Carried Interest (LP)', amount: lpProfit, split: 1 - gpCarry, recipient: 'LP' },
          { tier: 4, name: 'Carried Interest (GP)', amount: gpCarried, split: gpCarry, recipient: 'GP' },
        ],
        totalToLP: returnOfCapital + preferredDistributed + lpProfit,
        totalToGP: catchUpAmount + gpCarried,
        lpMultiple: totalCalled > 0 ? (returnOfCapital + preferredDistributed + lpProfit) / totalCalled : 0,
      },
      calculatedAt: new Date().toISOString(),
    };
  });

  // GET /fund/:id/k1-preview - K-1 tax document preview
  app.get('/fund/:id/k1-preview', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const allocation = await db.execute(
      `SELECT i.investor_name, i.ownership_pct, i.investor_type,
              f.tax_year, f.ordinary_income, f.capital_gains_st, f.capital_gains_lt,
              f.depreciation, f.interest_expense
       FROM fund_investor_allocations f
       JOIN deal_investors i ON f.investor_id = i.id
       WHERE f.fund_id = $1 AND f.investor_id = $2`, [id, user.id]
    );

    if (!allocation.length) return { error: 'No K-1 data found' };

    const data = allocation[0];
    return {
      k1Preview: {
        investorName: data.investor_name,
        investorType: data.investor_type,
        ownershipPercent: data.ownership_pct,
        taxYear: data.tax_year,
        allocations: {
          ordinaryIncome: data.ordinary_income,
          shortTermCapitalGains: data.capital_gains_st,
          longTermCapitalGains: data.capital_gains_lt,
          depreciation: data.depreciation,
          interestExpense: data.interest_expense,
          netIncome: data.ordinary_income + data.capital_gains_st + data.capital_gains_lt - data.depreciation - data.interest_expense,
        },
        disclaimer: 'DRAFT - Not for tax filing. Consult your tax advisor.',
      },
    };
  });

  // GET /fund/:id/nav - Net Asset Value
  app.get('/fund/:id/nav', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };

    const assets = await db.execute(
      `SELECT SUM(current_valuation) AS total_assets FROM fund_assets WHERE fund_id = $1`, [id]
    );
    const liabilities = await db.execute(
      `SELECT SUM(amount) AS total_liabilities FROM fund_liabilities WHERE fund_id = $1`, [id]
    );
    const units = await db.execute(
      `SELECT SUM(units) AS total_units FROM fund_units WHERE fund_id = $1`, [id]
    );

    const totalAssets = assets[0]?.total_assets || 0;
    const totalLiabilities = liabilities[0]?.total_liabilities || 0;
    const totalUnits = units[0]?.total_units || 1;
    const nav = totalAssets - totalLiabilities;
    const navPerUnit = nav / totalUnits;

    return {
      fundId: id,
      nav: { totalAssets, totalLiabilities, netAssetValue: nav, totalUnits, navPerUnit },
      asOf: new Date().toISOString(),
    };
  });
}
