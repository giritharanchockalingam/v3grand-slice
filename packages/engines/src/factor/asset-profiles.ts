// ─── Multi-Asset Class Profiles ─────────────────────────────────────
// G-1/F-10: Pluggable asset class profiles for the Factor engine.
//
// Each profile defines:
//   1. Domain weights (how much each domain contributes to composite score)
//   2. Global indicators and their scoring functions
//   3. Local indicators and their scoring functions
//   4. Asset-specific indicators
//   5. Sponsor evaluation criteria
//
// Adding a new asset class: implement AssetClassProfile and register it.

import type { Deal } from '@v3grand/core';

// ── Types ──

export interface DomainWeights {
  global: number;
  local: number;
  asset: number;
  sponsor: number;
}

export interface IndicatorScorer {
  name: string;
  weight: number;
  score: (deal: Deal, macroIndicators?: Record<string, number>) => number; // Returns 0-5
}

export interface AssetClassProfile {
  assetClass: string;
  displayName: string;
  domainWeights: DomainWeights;
  globalIndicators: IndicatorScorer[];
  localIndicators: IndicatorScorer[];
  assetIndicators: IndicatorScorer[];
  sponsorIndicators: IndicatorScorer[];
  // Implied discount rate formula
  impliedDiscountRate: (riskFreeRate: number, compositeScore: number) => number;
}

// ── Hotel Profile (existing behavior, now abstracted) ──

export const HOTEL_PROFILE: AssetClassProfile = {
  assetClass: 'hotel',
  displayName: 'Hotel / Hospitality',
  domainWeights: { global: 0.25, local: 0.25, asset: 0.30, sponsor: 0.20 },

  globalIndicators: [
    {
      name: 'Repo Rate',
      weight: 0.30,
      score: (_deal, macro) => {
        const rate = macro?.repoRate ?? 0.065;
        if (rate <= 0.05) return 5;
        if (rate <= 0.06) return 4;
        if (rate <= 0.07) return 3;
        if (rate <= 0.08) return 2;
        return 1;
      },
    },
    {
      name: 'GDP Growth',
      weight: 0.30,
      score: (_deal, macro) => {
        const g = macro?.gdpGrowthRate ?? 0.065;
        if (g >= 0.08) return 5;
        if (g >= 0.065) return 4;
        if (g >= 0.05) return 3;
        if (g >= 0.03) return 2;
        return 1;
      },
    },
    {
      name: 'CPI Inflation',
      weight: 0.20,
      score: (_deal, macro) => {
        const cpi = macro?.cpi ?? 0.05;
        if (cpi <= 0.03) return 5;
        if (cpi <= 0.04) return 4;
        if (cpi <= 0.06) return 3;
        if (cpi <= 0.08) return 2;
        return 1;
      },
    },
    {
      name: 'Bond Yield',
      weight: 0.20,
      score: (_deal, macro) => {
        const y = macro?.bondYield10Y ?? 0.07;
        if (y <= 0.06) return 5;
        if (y <= 0.065) return 4;
        if (y <= 0.07) return 3;
        if (y <= 0.08) return 2;
        return 1;
      },
    },
  ],

  localIndicators: [
    {
      name: 'Tourism Demand',
      weight: 0.35,
      score: (deal) => {
        const city = (deal.property as any)?.location?.city?.toLowerCase() ?? '';
        // Tourism-heavy cities score higher
        const tourismScore: Record<string, number> = {
          goa: 5, jaipur: 5, udaipur: 5, agra: 4, varanasi: 4,
          mumbai: 4, delhi: 4, bangalore: 3, hyderabad: 3,
          chennai: 3, pune: 3, madurai: 4, kochi: 4,
        };
        return tourismScore[city] ?? 3;
      },
    },
    {
      name: 'Airport Connectivity',
      weight: 0.25,
      score: (deal) => {
        const dist = (deal.property as any)?.location?.distanceToAirportKm ?? 30;
        if (dist <= 10) return 5;
        if (dist <= 20) return 4;
        if (dist <= 40) return 3;
        if (dist <= 60) return 2;
        return 1;
      },
    },
    {
      name: 'Supply Pipeline',
      weight: 0.20,
      score: (_deal, macro) => {
        const supply = macro?.hotelSupplyGrowthPct ?? 0.03;
        if (supply <= 0.02) return 5;  // Low supply = good for investor
        if (supply <= 0.03) return 4;
        if (supply <= 0.05) return 3;
        if (supply <= 0.07) return 2;
        return 1;
      },
    },
    {
      name: 'Infrastructure',
      weight: 0.20,
      score: (deal) => {
        const city = (deal.property as any)?.location?.city?.toLowerCase() ?? '';
        const infraScore: Record<string, number> = {
          mumbai: 4, delhi: 4, bangalore: 5, hyderabad: 4,
          chennai: 4, pune: 4, goa: 3, jaipur: 3,
          madurai: 3, kochi: 3,
        };
        return infraScore[city] ?? 2;
      },
    },
  ],

  assetIndicators: [
    {
      name: 'Star Rating',
      weight: 0.25,
      score: (deal) => {
        const stars = (deal.property as any)?.starRating ?? 3;
        return Math.min(5, stars);
      },
    },
    {
      name: 'Room Count Scale',
      weight: 0.25,
      score: (deal) => {
        const keys = (deal.property as any)?.keys?.total ?? 80;
        if (keys >= 200) return 5;
        if (keys >= 150) return 4;
        if (keys >= 100) return 3;
        if (keys >= 60) return 2;
        return 1;
      },
    },
    {
      name: 'Revenue Diversification',
      weight: 0.25,
      score: (deal) => {
        const mix = (deal.marketAssumptions as any)?.revenueMix ?? {};
        const roomsPct = mix.rooms ?? 0.55;
        // Lower room dependency = better diversification
        if (roomsPct <= 0.40) return 5;
        if (roomsPct <= 0.50) return 4;
        if (roomsPct <= 0.60) return 3;
        if (roomsPct <= 0.70) return 2;
        return 1;
      },
    },
    {
      name: 'Segment Mix',
      weight: 0.25,
      score: (deal) => {
        const segments = (deal.marketAssumptions as any)?.segments ?? [];
        if (segments.length >= 4) return 5;
        if (segments.length >= 3) return 4;
        if (segments.length >= 2) return 3;
        return 2;
      },
    },
  ],

  sponsorIndicators: [
    {
      name: 'Equity Commitment',
      weight: 0.40,
      score: (deal) => {
        const equity = (deal.financialAssumptions as any)?.equityRatio ?? 0.4;
        if (equity >= 0.50) return 5;
        if (equity >= 0.40) return 4;
        if (equity >= 0.30) return 3;
        if (equity >= 0.20) return 2;
        return 1;
      },
    },
    {
      name: 'Partner Count',
      weight: 0.30,
      score: (deal) => {
        const partners = (deal.partnership as any)?.partners ?? [];
        if (partners.length >= 3) return 4;
        if (partners.length >= 2) return 3;
        return 2;
      },
    },
    {
      name: 'Target Returns',
      weight: 0.30,
      score: (deal) => {
        const targetIRR = (deal.financialAssumptions as any)?.targetIRR ?? 0.18;
        // Realistic targets score higher than unrealistic
        if (targetIRR >= 0.15 && targetIRR <= 0.22) return 5;
        if (targetIRR >= 0.12 && targetIRR <= 0.25) return 4;
        if (targetIRR >= 0.10) return 3;
        return 2;
      },
    },
  ],

  impliedDiscountRate: (riskFreeRate, compositeScore) => {
    return riskFreeRate + (5 - compositeScore) * 0.03;
  },
};

// ── Commercial Real Estate Profile (example extension) ──

export const COMMERCIAL_OFFICE_PROFILE: AssetClassProfile = {
  assetClass: 'commercial-office',
  displayName: 'Commercial Office',
  domainWeights: { global: 0.25, local: 0.30, asset: 0.25, sponsor: 0.20 },

  globalIndicators: HOTEL_PROFILE.globalIndicators, // Same macro indicators

  localIndicators: [
    {
      name: 'IT/Services Employment',
      weight: 0.30,
      score: (deal) => {
        const city = (deal.property as any)?.location?.city?.toLowerCase() ?? '';
        const itHubs: Record<string, number> = {
          bangalore: 5, hyderabad: 5, pune: 4, chennai: 4,
          gurgaon: 4, noida: 4, mumbai: 3, delhi: 3, kochi: 3,
        };
        return itHubs[city] ?? 2;
      },
    },
    {
      name: 'Metro Connectivity',
      weight: 0.25,
      score: (deal) => {
        const dist = (deal.property as any)?.location?.distanceToAirportKm ?? 30;
        if (dist <= 5) return 5;
        if (dist <= 15) return 4;
        if (dist <= 25) return 3;
        return 2;
      },
    },
    {
      name: 'Office Vacancy Rate',
      weight: 0.25,
      score: () => 3, // Would fetch from real data source
    },
    {
      name: 'Rental Growth Trend',
      weight: 0.20,
      score: () => 3,
    },
  ],

  assetIndicators: [
    {
      name: 'Grade A Classification',
      weight: 0.30,
      score: () => 4,
    },
    {
      name: 'Leasable Area Scale',
      weight: 0.25,
      score: (deal) => {
        const sqft = (deal.property as any)?.grossBUA?.totalSqft ?? 0;
        if (sqft >= 500000) return 5;
        if (sqft >= 200000) return 4;
        if (sqft >= 100000) return 3;
        return 2;
      },
    },
    {
      name: 'WALE (Weighted Avg Lease Expiry)',
      weight: 0.25,
      score: () => 3,
    },
    {
      name: 'Tenant Diversification',
      weight: 0.20,
      score: () => 3,
    },
  ],

  sponsorIndicators: HOTEL_PROFILE.sponsorIndicators, // Same sponsor criteria

  impliedDiscountRate: (riskFreeRate, compositeScore) => {
    return riskFreeRate + (5 - compositeScore) * 0.025; // Slightly lower risk premium for offices
  },
};

// ── Profile Registry ──

const PROFILE_REGISTRY: Map<string, AssetClassProfile> = new Map([
  ['hotel', HOTEL_PROFILE],
  ['commercial-office', COMMERCIAL_OFFICE_PROFILE],
]);

/**
 * Get the asset class profile for a deal's asset class.
 * Falls back to hotel profile if unknown asset class.
 */
export function getAssetClassProfile(assetClass: string): AssetClassProfile {
  return PROFILE_REGISTRY.get(assetClass) ?? HOTEL_PROFILE;
}

/**
 * Register a custom asset class profile.
 */
export function registerAssetClassProfile(profile: AssetClassProfile): void {
  PROFILE_REGISTRY.set(profile.assetClass, profile);
}

/**
 * List all registered asset class profiles.
 */
export function listAssetClassProfiles(): AssetClassProfile[] {
  return Array.from(PROFILE_REGISTRY.values());
}
