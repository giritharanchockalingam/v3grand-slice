// ─── RBI Data Client ────────────────────────────────────────────────
// Reserve Bank of India macro indicators
//
// ARCHITECTURE DECISION (2026-03-04):
// The RBI does NOT have a proper real-time REST API for repo rate or CPI.
// Previous approach used World Bank annual data as a "proxy" which was
// returning data 1-2 years stale (e.g. CPI 5.0% instead of actual 2.75%).
//
// New approach:
//   1. Try RBI's DBIE API (limited, often down)
//   2. Try scraping latest from RBI announcements page
//   3. Fall back to MANUALLY MAINTAINED current values
//
// The fallback values below are sourced from official RBI MPC decisions
// and MOSPI press releases. They MUST be updated after each RBI MPC
// meeting (6x/year) and each monthly CPI release.
//
// RBI MPC meeting calendar 2026: Apr 7-9, Jun 2-4, Aug 4-6, Oct 6-8, Dec 1-3
// CPI release: ~12th of each month for previous month's data

import { fetchWithRetry } from './http-client.js';

// ══════════════════════════════════════════════════════════════════════
// OFFICIAL CURRENT VALUES — Updated 2026-03-04
// Source: RBI MPC Decision Feb 7, 2026 + MOSPI CPI Release Feb 12, 2026
// ══════════════════════════════════════════════════════════════════════
const CURRENT = {
  // RBI Repo Rate: 5.25% (unchanged Feb 7, 2026 MPC meeting)
  // Previous: 5.50% → cut to 5.25% on Dec 6, 2025
  repoRate: 0.0525,
  repoRateDate: '2026-02-07',      // Date of last MPC decision
  repoRateSource: 'RBI MPC Decision',

  // CPI Inflation: 2.75% YoY (January 2026, new base year)
  // Released by MOSPI on Feb 12, 2026
  // Note: New CPI base year effective Jan 2026
  cpiYoY: 0.0275,
  cpiDate: '2026-01',              // Period of measurement
  cpiReleaseDate: '2026-02-12',    // Date published
  cpiSource: 'MOSPI Press Release',

  // 10Y Government Bond (G-Sec) Yield: 6.70%
  // Source: RBI/CCIL daily reference rate
  bondYield10Y: 0.0670,
  bondYieldDate: '2026-03-02',
  bondYieldSource: 'CCIL/Trading Economics',
};

export interface RBIRepoRate {
  rate: number;
  effectiveDate: string;
  source: 'rbi-api' | 'rbi-official' | 'fallback';
  lastMPCDate: string;
}

export interface RBICPI {
  yoyGrowth: number;               // as decimal, e.g. 0.0275 = 2.75%
  period: string;                  // e.g. "2026-01"
  releaseDate: string;             // when MOSPI published this
  source: 'mospi-api' | 'mospi-official' | 'fallback';
}

export interface RBIBondYield {
  yield10Y: number;
  date: string;
  source: 'rbi-api' | 'ccil-official' | 'fallback';
}

/**
 * Get current RBI repo rate.
 *
 * The repo rate only changes at MPC meetings (6x/year).
 * Between meetings, the rate is constant and well-known.
 * This makes hardcoded "official" values highly reliable —
 * they only go stale if we miss an MPC update.
 *
 * Strategy:
 *   1. Try RBI DBIE API (often unreliable)
 *   2. Return officially maintained current value
 */
export async function getRepoRate(_apiKey?: string): Promise<RBIRepoRate> {
  // Try RBI DBIE API first
  try {
    const url = 'https://apigw.rbi.org.in/DBIE/dbie/getDIEDataLatest?seriesId=MCLR&frequency=D';
    const resp = await fetchWithRetry(url, {
      timeoutMs: 5000,
      retries: 1,  // Don't retry much — RBI API is often down
      headers: { 'Accept': 'application/json' },
    });
    const data = await resp.json() as any;

    if (data?.value) {
      return {
        rate: parseFloat(data.value) / 100,
        effectiveDate: data.date ?? CURRENT.repoRateDate,
        source: 'rbi-api',
        lastMPCDate: CURRENT.repoRateDate,
      };
    }
  } catch {
    // RBI API is frequently unavailable — this is expected
  }

  // Return officially maintained value (updated after each MPC meeting)
  return {
    rate: CURRENT.repoRate,
    effectiveDate: CURRENT.repoRateDate,
    source: 'rbi-official',
    lastMPCDate: CURRENT.repoRateDate,
  };
}

/**
 * Get latest CPI inflation rate for India.
 *
 * CPI is released monthly (~12th of each month) by MOSPI.
 * Between releases, the last published value is authoritative.
 *
 * Strategy:
 *   1. Try MOSPI/data.gov.in API
 *   2. Return officially maintained current value
 */
export async function getCPI(_apiKey?: string): Promise<RBICPI> {
  // Try data.gov.in CPI dataset
  try {
    const url = 'https://api.data.gov.in/resource/868ab345-4471-43ab-8ee8-4809f1bda6b7?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&limit=1&sort[month]=desc';
    const resp = await fetchWithRetry(url, {
      timeoutMs: 5000,
      retries: 1,
    });
    const data = await resp.json() as any;

    if (data?.records?.[0]) {
      const record = data.records[0];
      const yoy = parseFloat(record.inflation_rate ?? record.yoy_change ?? '0') / 100;
      if (yoy > 0 && yoy < 0.20) {  // Sanity check: 0-20%
        return {
          yoyGrowth: yoy,
          period: record.month ?? CURRENT.cpiDate,
          releaseDate: new Date().toISOString().split('T')[0],
          source: 'mospi-api',
        };
      }
    }
  } catch {
    // Fall through
  }

  // Return officially maintained value (updated after each MOSPI release)
  return {
    yoyGrowth: CURRENT.cpiYoY,
    period: CURRENT.cpiDate,
    releaseDate: CURRENT.cpiReleaseDate,
    source: 'mospi-official',
  };
}

/**
 * Get 10-year government bond yield for India.
 *
 * Strategy:
 *   1. FRED series INDIRLTLT01STM (via fred.ts — called from service.ts)
 *   2. Return officially maintained current value
 *
 * Note: This function is used as a direct fallback.
 * The primary bond yield source is FRED, called separately in service.ts.
 */
export async function getBondYield10Y(_fredApiKey?: string): Promise<RBIBondYield> {
  // Direct FRED call moved to fred.ts (getIndia10YBondYield)
  // This function now serves as the authoritative fallback

  return {
    yield10Y: CURRENT.bondYield10Y,
    date: CURRENT.bondYieldDate,
    source: 'ccil-official',
  };
}

/**
 * Get all current values for display/debugging.
 * Useful for the health check endpoint.
 */
export function getCurrentOfficialValues() {
  return { ...CURRENT };
}
