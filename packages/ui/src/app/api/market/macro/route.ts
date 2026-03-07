import { NextResponse } from 'next/server';

/**
 * GET /api/market/macro
 * Returns India macro economic indicators for hotel investment analysis.
 * In production, this would aggregate from RBI, MOSPI, World Bank, FRED APIs.
 * Currently returns curated data based on latest published figures (Mar 2026).
 */
export async function GET() {
  const now = new Date().toISOString();
  const asOf = '2026-02';

  return NextResponse.json({
    ok: true,
    data: {
      repoRate: 5.25,
      cpi: 2.75,
      gdpGrowthRate: 7.40,
      bondYield10Y: 6.72,
      hotelSupplyGrowthPct: 5.20,
      usdInrRate: 91.99,
      inflationTrend: 'declining' as const,
      source: 'fallback' as const,
      fetchedAt: now,
      indicators: {
        repoRate: {
          value: 5.25,
          asOfDate: asOf,
          source: 'RBI MPC — Feb 6, 2026 (held at 5.25%)',
          sourceType: 'official' as const,
        },
        cpi: {
          value: 2.75,
          asOfDate: '2026-01',
          source: 'MOSPI CPI Report — Jan 2026 (new base year)',
          sourceType: 'official' as const,
        },
        gdpGrowth: {
          value: 7.40,
          asOfDate: 'FY2025-26 AE',
          source: 'NSO Advance Estimate — Feb 2026',
          sourceType: 'official' as const,
        },
        bondYield10Y: {
          value: 6.72,
          asOfDate: asOf,
          source: 'RBI G-Sec Benchmark 10Y',
          sourceType: 'official' as const,
        },
        usdInr: {
          value: 91.99,
          asOfDate: '2026-03-06',
          source: 'RBI Reference Rate — Mar 6, 2026 (Trading Economics)',
          sourceType: 'official' as const,
        },
        hotelSupplyGrowth: {
          value: 5.20,
          asOfDate: '2025',
          source: 'HVS India Hotel Survey 2025-26',
          sourceType: 'official' as const,
        },
      },
    },
  });
}
