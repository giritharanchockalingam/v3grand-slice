// ─── FRED API Client + Free Forex Fallback ──────────────────────────
// FRED: Federal Reserve Economic Data - free API key required.
// Docs: https://fred.stlouisfed.org/docs/api/fred/
//
// For USD/INR we use a 3-tier approach:
//   1. FRED DEXINUS series (daily, requires free API key)
//   2. Open ExchangeRate API (daily, no key, free)
//   3. Hardcoded fallback (updated quarterly by dev team)

import { fetchWithRetry } from './http-client.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

// Key FRED series IDs
const SERIES = {
  USD_INR: 'DEXINUS',                    // India Rupees to One U.S. Dollar (DAILY)
  INDIA_10Y_BOND: 'INDIRLTLT01STM',      // Long-Term Government Bond Yields: 10-Year for India (MONTHLY)
  INDIA_INTEREST_RATE: 'INTDSRINM193N',  // Interest Rates, Discount Rate for India (MONTHLY)
};

// ── CURRENT FALLBACKS (updated 2026-03-04) ──
// These MUST be updated whenever they become stale.
// Last verified: 2026-03-04 from Trading Economics, RBI, Bloomberg
const FALLBACK_USD_INR = 92.15;           // USD/INR as of 2026-03-04
const FALLBACK_USD_INR_DATE = '2026-03-04';
const FALLBACK_BOND_YIELD = 0.0670;       // 6.70% as of 2026-03-02
const FALLBACK_BOND_DATE = '2026-03-02';

export interface FREDObservation {
  value: number;
  date: string;
  source: 'fred' | 'exchangerate-api' | 'fallback';
}

/**
 * Get latest USD/INR exchange rate.
 * Tier 1: FRED DEXINUS (daily, most reliable, needs free API key)
 * Tier 2: open.er-api.com (daily, no key, free)
 * Tier 3: hardcoded fallback
 */
export async function getUSDINR(apiKey?: string): Promise<FREDObservation> {
  // Tier 1: FRED (daily data, 1-2 day lag on weekdays)
  if (apiKey) {
    try {
      const url = `${FRED_BASE}/series/observations?series_id=${SERIES.USD_INR}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;
      const resp = await fetchWithRetry(url, { timeoutMs: 6000 });
      const data = await resp.json() as any;

      // FRED marks missing values as "." — skip those
      const valid = data?.observations?.find((o: any) => o.value !== '.');
      if (valid) {
        return { value: parseFloat(valid.value), date: valid.date, source: 'fred' };
      }
    } catch {
      // Fall through to Tier 2
    }
  }

  // Tier 2: Free ExchangeRate API (no key, daily updates)
  try {
    const url = 'https://open.er-api.com/v6/latest/USD';
    const resp = await fetchWithRetry(url, { timeoutMs: 6000 });
    const data = await resp.json() as any;

    if (data?.result === 'success' && data?.rates?.INR) {
      return {
        value: Math.round(data.rates.INR * 100) / 100,
        date: data.time_last_update_utc?.split(' 00:')[0] ?? new Date().toISOString().split('T')[0],
        source: 'exchangerate-api',
      };
    }
  } catch {
    // Fall through to Tier 3
  }

  // Tier 3: Hardcoded fallback
  return { value: FALLBACK_USD_INR, date: FALLBACK_USD_INR_DATE, source: 'fallback' };
}

/**
 * Get India 10-Year Government Bond Yield from FRED.
 * Series: INDIRLTLT01STM (monthly, ~2-month lag)
 */
export async function getIndia10YBondYield(apiKey?: string): Promise<FREDObservation> {
  if (apiKey) {
    try {
      const url = `${FRED_BASE}/series/observations?series_id=${SERIES.INDIA_10Y_BOND}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;
      const resp = await fetchWithRetry(url, { timeoutMs: 6000 });
      const data = await resp.json() as any;

      const valid = data?.observations?.find((o: any) => o.value !== '.');
      if (valid) {
        const yieldPct = parseFloat(valid.value);
        return {
          // FRED stores as percentage (e.g. 6.70), convert to decimal (0.067)
          value: yieldPct > 1 ? yieldPct / 100 : yieldPct,
          date: valid.date,
          source: 'fred',
        };
      }
    } catch {
      // Fall through
    }
  }

  return { value: FALLBACK_BOND_YIELD, date: FALLBACK_BOND_DATE, source: 'fallback' };
}

/**
 * Get India discount/interest rate from FRED.
 */
export async function getIndiaInterestRate(apiKey: string): Promise<FREDObservation> {
  try {
    const url = `${FRED_BASE}/series/observations?series_id=${SERIES.INDIA_INTEREST_RATE}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
    const resp = await fetchWithRetry(url, { timeoutMs: 6000 });
    const data = await resp.json() as any;

    const valid = data?.observations?.find((o: any) => o.value !== '.');
    if (valid) {
      return { value: parseFloat(valid.value) / 100, date: valid.date, source: 'fred' };
    }
  } catch {
    // Fall through
  }

  return { value: 0.0525, date: '2026-02-07', source: 'fallback' };
}

/**
 * Generic FRED series fetcher.
 */
export async function getSeriesLatest(
  apiKey: string,
  seriesId: string,
  limit = 1,
): Promise<FREDObservation[]> {
  try {
    const url = `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit * 2}`;
    const resp = await fetchWithRetry(url, { timeoutMs: 6000 });
    const data = await resp.json() as any;

    return (data?.observations ?? [])
      .filter((o: any) => o.value !== '.')
      .slice(0, limit)
      .map((o: any) => ({ value: parseFloat(o.value), date: o.date, source: 'fred' as const }));
  } catch {
    return [];
  }
}
