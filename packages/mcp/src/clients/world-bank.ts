// ─── World Bank Open Data Client ────────────────────────────────────
// Free API, no authentication required.
// Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/898599
//
// IMPORTANT: World Bank data is ANNUAL and typically lags 1-2 years.
// For GDP, this is acceptable (annual figures are the standard).
// For CPI/inflation, this is NOT acceptable — use rbi.ts instead.
// This client now ONLY provides GDP growth data (annual).

import { fetchWithRetry } from './http-client.js';

const WB_BASE = 'https://api.worldbank.org/v2';

export interface WBDataPoint {
  value: number;
  year: string;
  source: 'world-bank' | 'fallback';
}

// ── Accurate GDP fallbacks (updated 2026-03-04) ──
// Source: MOSPI Provisional Estimates, May 2025
// FY2024-25: 6.5% (provisional)
// FY2023-24: 8.2% (first revised)
// FY2022-23: 7.0% (final)
const GDP_FALLBACK: WBDataPoint[] = [
  { value: 0.065, year: '2024-25', source: 'fallback' },   // Provisional (MOSPI May 2025)
  { value: 0.082, year: '2023-24', source: 'fallback' },   // First Revised (MOSPI Feb 2025)
  { value: 0.070, year: '2022-23', source: 'fallback' },   // Final (MOSPI Jan 2025)
];

/**
 * Fetch GDP growth rate for India (annual %).
 * Indicator: NY.GDP.MKTP.KD.ZG
 *
 * NOTE: World Bank typically lags 1-2 years.
 * The year label is returned so the UI can show "GDP Growth (FY2024)"
 * instead of implying it's current.
 */
export async function getGDPGrowth(years = 5): Promise<WBDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const url = `${WB_BASE}/country/IND/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=${years}&date=${currentYear - years}:${currentYear}`;

  try {
    const resp = await fetchWithRetry(url, { timeoutMs: 8000 });
    const data = await resp.json() as any[];

    if (!data?.[1]) return GDP_FALLBACK;

    const results = data[1]
      .filter((d: any) => d.value !== null)
      .map((d: any) => ({
        value: d.value / 100,   // Convert percentage to decimal
        year: d.date,
        source: 'world-bank' as const,
      }));

    return results.length > 0 ? results : GDP_FALLBACK;
  } catch {
    return GDP_FALLBACK;
  }
}

/**
 * Fetch consumer price inflation for India (annual %).
 * Indicator: FP.CPI.TOTL.ZG
 *
 * @deprecated Use getCPI() from rbi.ts instead for current monthly data.
 * This function returns ANNUAL data that is 1-2 years stale.
 * Kept for historical comparison only.
 */
export async function getInflation(years = 5): Promise<WBDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const url = `${WB_BASE}/country/IND/indicator/FP.CPI.TOTL.ZG?format=json&per_page=${years}&date=${currentYear - years}:${currentYear}`;

  try {
    const resp = await fetchWithRetry(url, { timeoutMs: 8000 });
    const data = await resp.json() as any[];

    if (!data?.[1]) return [{ value: 0.0505, year: '2023', source: 'fallback' }];

    return data[1]
      .filter((d: any) => d.value !== null)
      .map((d: any) => ({
        value: d.value / 100,
        year: d.date,
        source: 'world-bank' as const,
      }));
  } catch {
    return [{ value: 0.0505, year: '2023', source: 'fallback' }];
  }
}

/**
 * Fetch international tourist arrivals for India.
 * Indicator: ST.INT.ARVL
 */
export async function getTouristArrivals(years = 5): Promise<WBDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const url = `${WB_BASE}/country/IND/indicator/ST.INT.ARVL?format=json&per_page=${years}&date=${currentYear - years}:${currentYear}`;

  try {
    const resp = await fetchWithRetry(url, { timeoutMs: 8000 });
    const data = await resp.json() as any[];

    if (!data?.[1]) return [{ value: 10_900_000, year: '2023', source: 'fallback' }];

    return data[1]
      .filter((d: any) => d.value !== null)
      .map((d: any) => ({
        value: d.value,
        year: d.date,
        source: 'world-bank' as const,
      }));
  } catch {
    return [{ value: 10_900_000, year: '2023', source: 'fallback' }];
  }
}

/**
 * Fetch Foreign Direct Investment net inflows for India (current USD).
 * Indicator: BX.KLT.DINV.CD.WD
 */
export async function getFDIInflows(years = 5): Promise<WBDataPoint[]> {
  const currentYear = new Date().getFullYear();
  const url = `${WB_BASE}/country/IND/indicator/BX.KLT.DINV.CD.WD?format=json&per_page=${years}&date=${currentYear - years}:${currentYear}`;

  try {
    const resp = await fetchWithRetry(url, { timeoutMs: 8000 });
    const data = await resp.json() as any[];

    if (!data?.[1]) return [{ value: 28_000_000_000, year: '2023', source: 'fallback' }];

    return data[1]
      .filter((d: any) => d.value !== null)
      .map((d: any) => ({
        value: d.value,
        year: d.date,
        source: 'world-bank' as const,
      }));
  } catch {
    return [{ value: 28_000_000_000, year: '2023', source: 'fallback' }];
  }
}
