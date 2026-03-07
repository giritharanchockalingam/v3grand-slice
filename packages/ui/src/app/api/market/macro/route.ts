import { NextResponse } from 'next/server';
import { getAllMacroIndicators, invalidateAllCache } from '@/lib/server/macro-data';

/**
 * GET /api/market/macro
 *
 * Returns India macro indicators sourced LIVE from authoritative APIs:
 *   USD/INR  → FRED DEXINUS → Frankfurter → Open ExchangeRate API
 *   Bond 10Y → FRED INDIRLTLT01STM
 *   Repo Rate → API Ninjas → World Bank
 *   CPI      → API Ninjas → World Bank
 *   GDP      → World Bank → FRED
 *   Hotel    → HVS (manual; no free API)
 *
 * Intelligent caching: FX 15 min, bonds 1 hr, repo 24 hr, CPI 7 d, GDP 30 d.
 * Stale-while-revalidate: serves stale data while refreshing in background.
 */
export async function GET(request: Request) {
  try {
    // Check if force-refresh is requested via ?refresh=true
    const url = new URL(request.url);
    if (url.searchParams.get('refresh') === 'true') {
      invalidateAllCache();
    }

    const data = await getAllMacroIndicators();

    return NextResponse.json({
      ok: true,
      data,
    }, {
      headers: {
        // Allow browser caching for 60s, CDN for 300s, stale-while-revalidate for 600s
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600, max-age=60',
      },
    });
  } catch (err) {
    console.error('GET /api/market/macro failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch macro indicators' },
      { status: 500 },
    );
  }
}
