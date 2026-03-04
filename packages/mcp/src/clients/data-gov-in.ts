// ─── data.gov.in Client ─────────────────────────────────────────────
// Open Government Data Platform India - free API key required.
// Docs: https://data.gov.in/apis
// Provides: airport traffic, tourism stats, housing price index
//
// DATA FRESHNESS NOTE (2026-03-04):
// Airport traffic data from data.gov.in is typically 6-12 months lagged.
// Tourism data is published annually by Ministry of Tourism (~1 year lag).
// Housing Price Index is published quarterly by RBI (~1 quarter lag).
//
// Fallback values are sourced from:
//   Airport: AAI annual traffic report FY2024-25 (provisional)
//   Tourism: Ministry of Tourism India Tourism Statistics 2024
//   HPI: RBI HPI Quarterly Bulletin Q3 2025

import { fetchWithRetry } from './http-client.js';

const DG_BASE = 'https://api.data.gov.in/resource';

// Known resource IDs (update as needed when data.gov.in changes catalog)
const RESOURCES = {
  airTraffic: '64d0c248-6ced-4cef-b782-cbb1e0c695a9',
};

// ── City → Airport code mapping ──
const CITY_AIRPORT_MAP: Record<string, string> = {
  'mumbai': 'BOM', 'delhi': 'DEL', 'bangalore': 'BLR', 'bengaluru': 'BLR',
  'hyderabad': 'HYD', 'chennai': 'MAA', 'kolkata': 'CCU', 'pune': 'PNQ',
  'goa': 'GOI', 'jaipur': 'JAI', 'ahmedabad': 'AMD', 'kochi': 'COK',
  'lucknow': 'LKO', 'guwahati': 'GAU', 'madurai': 'IXM',
  'coimbatore': 'CJB', 'trivandrum': 'TRV', 'varanasi': 'VNS',
};

// ── City → State mapping ──
const CITY_STATE_MAP: Record<string, string> = {
  'mumbai': 'Maharashtra', 'delhi': 'Delhi', 'bangalore': 'Karnataka',
  'bengaluru': 'Karnataka', 'hyderabad': 'Telangana', 'chennai': 'Tamil Nadu',
  'kolkata': 'West Bengal', 'pune': 'Maharashtra', 'goa': 'Goa',
  'jaipur': 'Rajasthan', 'ahmedabad': 'Gujarat', 'kochi': 'Kerala',
  'madurai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu',
};

export interface AirportTrafficData {
  airportCode: string;
  city: string;
  passengers: number;
  growth: number;        // YoY decimal
  period: string;        // e.g. "FY2024-25"
  source: 'live' | 'fallback';
}

export interface TourismData {
  state: string;
  domestic: number;
  foreign: number;
  growthPct: number;
  period: string;        // e.g. "2023-24"
  source: 'live' | 'fallback';
}

export interface HousingPriceData {
  city: string;
  index: number;
  growthPct: number;
  period: string;        // e.g. "Q3 2025"
  source: 'live' | 'fallback';
}

// ══════════════════════════════════════════════════════════════════════
// FALLBACK DATA — Updated 2026-03-04
// Source: AAI Annual Traffic Report FY2024-25 (provisional estimates)
// ══════════════════════════════════════════════════════════════════════
const AIRPORT_FALLBACK: Record<string, { passengers: number; growth: number }> = {
  'BOM': { passengers: 55_400_000, growth: 0.065 },   // CSMIA FY2024-25 (prov.)
  'DEL': { passengers: 74_600_000, growth: 0.048 },   // IGIA FY2024-25 (prov.)
  'BLR': { passengers: 40_200_000, growth: 0.092 },   // KIAB FY2024-25 (prov.)
  'HYD': { passengers: 26_800_000, growth: 0.078 },   // RGIA FY2024-25 (prov.)
  'MAA': { passengers: 23_500_000, growth: 0.068 },   // MAA FY2024-25 (prov.)
  'CCU': { passengers: 21_200_000, growth: 0.060 },   // NSCBI FY2024-25 (prov.)
  'PNQ': { passengers: 10_800_000, growth: 0.080 },   // Pune FY2024-25 (prov.)
  'GOI': { passengers: 9_400_000, growth: 0.044 },    // Dabolim/Mopa FY2024-25 (prov.)
  'IXM': { passengers: 2_700_000, growth: 0.080 },    // Madurai FY2024-25 (prov.)
  'CJB': { passengers: 5_200_000, growth: 0.040 },    // Coimbatore FY2024-25 (prov.)
  'JAI': { passengers: 7_800_000, growth: 0.072 },    // Jaipur FY2024-25 (prov.)
  'AMD': { passengers: 12_400_000, growth: 0.085 },   // Ahmedabad FY2024-25 (prov.)
  'COK': { passengers: 10_100_000, growth: 0.055 },   // Kochi FY2024-25 (prov.)
  'LKO': { passengers: 5_600_000, growth: 0.095 },    // Lucknow FY2024-25 (prov.)
  'GAU': { passengers: 4_100_000, growth: 0.070 },    // Guwahati FY2024-25 (prov.)
  'TRV': { passengers: 5_300_000, growth: 0.050 },    // Trivandrum FY2024-25 (prov.)
  'VNS': { passengers: 3_200_000, growth: 0.110 },    // Varanasi FY2024-25 (prov.)
};
const AIRPORT_FALLBACK_PERIOD = 'FY2024-25';

// ══════════════════════════════════════════════════════════════════════
// Source: Ministry of Tourism — India Tourism Statistics 2024
// Period: CY2023 / FY2023-24
// ══════════════════════════════════════════════════════════════════════
const TOURISM_FALLBACK: Record<string, { domestic: number; foreign: number; growth: number }> = {
  'Tamil Nadu': { domestic: 185_000_000, foreign: 4_700_000, growth: 0.12 },
  'Maharashtra': { domestic: 140_000_000, foreign: 5_500_000, growth: 0.10 },
  'Karnataka': { domestic: 120_000_000, foreign: 800_000, growth: 0.14 },
  'Kerala': { domestic: 18_000_000, foreign: 1_100_000, growth: 0.11 },
  'Rajasthan': { domestic: 52_000_000, foreign: 1_600_000, growth: 0.09 },
  'Delhi': { domestic: 30_000_000, foreign: 2_800_000, growth: 0.08 },
  'Goa': { domestic: 8_000_000, foreign: 900_000, growth: 0.15 },
  'Telangana': { domestic: 95_000_000, foreign: 300_000, growth: 0.13 },
  'West Bengal': { domestic: 90_000_000, foreign: 1_600_000, growth: 0.07 },
  'Gujarat': { domestic: 65_000_000, foreign: 200_000, growth: 0.11 },
};
const TOURISM_FALLBACK_PERIOD = '2023-24';

/**
 * Get airport passenger traffic for a city.
 */
export async function getAirportTraffic(
  city: string,
  apiKey?: string,
): Promise<AirportTrafficData> {
  const normalizedCity = city.toLowerCase().trim();
  const airportCode = CITY_AIRPORT_MAP[normalizedCity] ?? 'UNKNOWN';

  if (apiKey) {
    try {
      const url = `${DG_BASE}/${RESOURCES.airTraffic}?api-key=${apiKey}&format=json&limit=5`;
      const resp = await fetchWithRetry(url, { timeoutMs: 8000 });
      const data = await resp.json() as any;

      if (data?.records?.length > 0) {
        // Try to find matching airport in results
        const match = data.records.find((r: any) =>
          r.airport_code === airportCode ||
          (r.airport_name ?? '').toLowerCase().includes(normalizedCity)
        );
        if (match) {
          return {
            airportCode,
            city,
            passengers: parseInt(match.passengers_total ?? match.total_passengers ?? '0'),
            growth: parseFloat(match.growth_pct ?? '10') / 100,
            period: match.period ?? match.year ?? AIRPORT_FALLBACK_PERIOD,
            source: 'live',
          };
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  const fallback = AIRPORT_FALLBACK[airportCode] ?? { passengers: 3_000_000, growth: 0.10 };
  return {
    airportCode,
    city,
    passengers: fallback.passengers,
    growth: fallback.growth,
    period: AIRPORT_FALLBACK_PERIOD,
    source: 'fallback',
  };
}

/**
 * Get tourism statistics by state.
 */
export async function getTourismByState(
  city: string,
  _apiKey?: string,
): Promise<TourismData> {
  const normalizedCity = city.toLowerCase().trim();
  const state = CITY_STATE_MAP[normalizedCity] ?? 'Unknown';

  // Tourism data from data.gov.in is typically annual PDFs, so we use fallback
  const fallback = TOURISM_FALLBACK[state] ?? { domestic: 10_000_000, foreign: 200_000, growth: 0.08 };
  return {
    state,
    domestic: fallback.domestic,
    foreign: fallback.foreign,
    growthPct: fallback.growth,
    period: TOURISM_FALLBACK_PERIOD,
    source: 'fallback',
  };
}

/**
 * Get housing price index for a city.
 * RBI publishes HPI quarterly — using curated fallback data.
 *
 * Source: RBI Quarterly House Price Index (Base: Q4 2008-09 = 100)
 * Last update: Q3 FY2025 (Oct-Dec 2024), published Jan 2025
 */
export async function getHousingPriceIndex(
  city: string,
  _apiKey?: string,
): Promise<HousingPriceData> {
  // RBI HPI data (Base Q4 2008-09 = 100)
  // Source: RBI Quarterly Bulletin, Q3 FY2025
  const CITY_HPI: Record<string, { index: number; growth: number }> = {
    'mumbai': { index: 318, growth: 0.038 },    // Q3 FY2025
    'delhi': { index: 290, growth: 0.035 },
    'bangalore': { index: 305, growth: 0.058 },
    'bengaluru': { index: 305, growth: 0.058 },
    'chennai': { index: 272, growth: 0.042 },
    'hyderabad': { index: 320, growth: 0.068 },
    'kolkata': { index: 248, growth: 0.034 },
    'pune': { index: 278, growth: 0.048 },
    'madurai': { index: 200, growth: 0.052 },
    'kochi': { index: 252, growth: 0.045 },
    'ahmedabad': { index: 262, growth: 0.055 },
    'jaipur': { index: 245, growth: 0.042 },
    'goa': { index: 230, growth: 0.065 },
  };

  const normalized = city.toLowerCase().trim();
  const data = CITY_HPI[normalized] ?? { index: 220, growth: 0.04 };

  return {
    city,
    index: data.index,
    growthPct: data.growth,
    period: 'Q3 FY2025',
    source: 'fallback',
  };
}

/** Helper to get state for a city */
export function getStateForCity(city: string): string {
  return CITY_STATE_MAP[city.toLowerCase().trim()] ?? 'Unknown';
}

/** Helper to get airport code for a city */
export function getAirportCodeForCity(city: string): string {
  return CITY_AIRPORT_MAP[city.toLowerCase().trim()] ?? 'UNKNOWN';
}
