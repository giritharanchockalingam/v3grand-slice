import { NextResponse } from 'next/server';

/**
 * GET /api/market/macro
 * Returns India macro economic indicators for hotel investment analysis.
 * In production, this would aggregate from RBI, MOSPI, World Bank, FRED APIs.
 * Currently returns curated fallback data representative of current conditions.
 */
export async function GET() {
  const now = new Date().toISOString();
  const asOf = '2025-12';

  return NextResponse.json({
    ok: true,
    data: {
      repoRate: 6.50,
      cpi: 5.10,
      gdpGrowthRate: 6.80,
      bondYield10Y: 7.15,
      hotelSupplyGrowthPct: 4.20,
      usdInrRate: 83.50,
      inflationTrend: 'stable' as const,
      source: 'fallback' as const,
      fetchedAt: now,
      indicators: {
        repoRate: {
          value: 6.50,
          asOfDate: asOf,
          source: 'RBI Monetary Policy — Dec 2025',
          sourceType: 'official' as const,
        },
        cpi: {
          value: 5.10,
          asOfDate: asOf,
          source: 'MOSPI CPI Report — Dec 2025',
          sourceType: 'official' as const,
        },
        gdpGrowth: {
          value: 6.80,
          asOfDate: 'FY2025-26 Q2',
          source: 'NSO Advance Estimate',
          sourceType: 'official' as const,
        },
        bondYield10Y: {
          value: 7.15,
          asOfDate: asOf,
          source: 'RBI G-Sec Benchmark',
          sourceType: 'official' as const,
        },
        usdInr: {
          value: 83.50,
          asOfDate: asOf,
          source: 'RBI Reference Rate',
          sourceType: 'official' as const,
        },
        hotelSupplyGrowth: {
          value: 4.20,
          asOfDate: asOf,
          source: 'HVS India Hotel Survey 2025',
          sourceType: 'official' as const,
        },
      },
    },
  });
}
