import { NextResponse } from 'next/server';
import { getAllMacroIndicators, invalidateAllCache } from '@/lib/server/macro-data';

/** Allow up to 60s for Serper + FRED + other API calls */
export const maxDuration = 60;

/**
 * GET /api/market/macro
 *
 * Returns India macro indicators sourced LIVE from the most current
 * authoritative sources available:
 *
 *   USD/INR   → ExchangeRate-API (daily) → Frankfurter → FRED → Serper
 *   Bond 10Y  → Serper Web Intel → FRED OECD monthly
 *   Repo Rate → API Ninjas → Serper Web Intel
 *   CPI       → API Ninjas → Serper → FRED OECD monthly → World Bank
 *   GDP       → Serper Web Intel → World Bank → FRED
 *   Hotel     → Serper Web Intel → HVS static
 *
 * The Serper Web Intelligence agent searches Google for the latest
 * published values from Trading Economics, RBI, MOSPI, etc.
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
