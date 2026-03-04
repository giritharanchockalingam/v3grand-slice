// ─── MCP Market Data Types ──────────────────────────────────────────
// Extended macro indicators that include additional fields beyond
// the core MacroIndicators type from @v3grand/core.

import type { MacroIndicators } from '@v3grand/core';

/** Per-indicator metadata for freshness tracking */
export interface IndicatorMeta {
  value: number;
  asOfDate: string;        // When this data point was measured/published
  source: string;          // e.g. "RBI MPC Decision", "FRED DEXINUS", "MOSPI"
  sourceType: 'live-api' | 'official' | 'fallback';
}

/** Extended macro data from live sources */
export interface LiveMacroData extends MacroIndicators {
  usdInrRate: number;                              // Forex rate
  inflationTrend: 'rising' | 'stable' | 'falling';
  source: 'live' | 'cached' | 'fallback';
  fetchedAt: string;                               // ISO timestamp when we fetched

  // Per-indicator freshness metadata
  indicators: {
    repoRate: IndicatorMeta;
    cpi: IndicatorMeta;
    gdpGrowth: IndicatorMeta;
    bondYield10Y: IndicatorMeta;
    usdInr: IndicatorMeta;
    hotelSupplyGrowth: IndicatorMeta;
  };
}

/** City-level market profile */
export interface CityMarketProfile {
  city: string;
  state: string;
  airportPassengers: number;                       // annual
  airportGrowthPct: number;                        // YoY %
  touristArrivals: {
    domestic: number;
    foreign: number;
    growthPct: number;
  };
  housingPriceIndex: number;
  housingGrowthPct: number;
  demandOutlook: 'strong' | 'moderate' | 'weak';
  fetchedAt: string;
  source: 'live' | 'cached' | 'fallback';
}

/** Demand signals for investment analysis */
export interface DemandSignals {
  touristGrowthPct: number;
  airTrafficGrowthPct: number;
  gdpGrowthPct: number;
  compositeScore: number;    // 0-100 weighted demand signal
}

/** Construction cost trends */
export interface CostTrend {
  currentIndex: number;
  baseYear: number;
  yoyGrowthPct: number;
  forecastGrowthPct: number; // predicted next year
  fetchedAt: string;
  source: 'live' | 'cached' | 'fallback';
}

/** MCP service configuration */
export interface MCPConfig {
  rbiApiKey?: string;
  fredApiKey?: string;
  dataGovInApiKey?: string;
  fallbackMode: boolean;
  cacheTtlSeconds: number;   // default 604800 (7 days)
}

/** Health status per data source */
export interface MCPHealthStatus {
  rbi: 'ok' | 'degraded' | 'offline';
  worldBank: 'ok' | 'degraded' | 'offline';
  fred: 'ok' | 'degraded' | 'offline';
  dataGovIn: 'ok' | 'degraded' | 'offline';
  forex: 'ok' | 'degraded' | 'offline';
  cacheHitRate: number;
  lastCheck: string;
}

/** Generic cache entry */
export interface CacheEntry<T> {
  key: string;
  value: T;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}
