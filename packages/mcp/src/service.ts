// ─── MarketDataService ─────────────────────────────────────────────
// Orchestrates all MCP data clients into a single service.
// Singleton pattern — one instance per process, shared by routes + engines.
//
// ARCHITECTURE (2026-03-04):
// Each indicator is fetched from the most authoritative + freshest source:
//   Repo Rate   → RBI (official MPC value, updated 6x/year)
//   CPI         → MOSPI (monthly, via rbi.ts)
//   GDP Growth  → World Bank (annual, acceptable for this metric)
//   Bond Yield  → FRED INDIRLTLT01STM → RBI/CCIL fallback
//   USD/INR     → FRED DEXINUS → open.er-api.com → fallback
//   Hotel Supply → Industry estimate (no reliable API)
//
// Per-indicator metadata (asOfDate, source) is tracked in the
// `indicators` field of LiveMacroData for UI freshness display.

import type { MacroIndicators } from '@v3grand/core';
import type {
  LiveMacroData, CityMarketProfile, DemandSignals,
  CostTrend, MCPConfig, MCPHealthStatus, IndicatorMeta,
} from './types.js';
import { MarketDataCache } from './clients/cache.js';
import { getRepoRate, getCPI, getBondYield10Y } from './clients/rbi.js';
import { getGDPGrowth } from './clients/world-bank.js';
import { getUSDINR, getIndia10YBondYield } from './clients/fred.js';
import {
  getAirportTraffic, getTourismByState, getHousingPriceIndex,
  getStateForCity,
} from './clients/data-gov-in.js';
import { resetCircuits } from './clients/http-client.js';

// ── Cache TTL constants (seconds) ──
const TTL = {
  macro: 7 * 24 * 3600,       // 7 days — macro indicators change slowly
  forex: 4 * 3600,            // 4 hours — exchange rates change intraday
  city: 30 * 24 * 3600,       // 30 days — city profiles are relatively stable
  tourism: 30 * 24 * 3600,    // 30 days
  construction: 30 * 24 * 3600,
};

// ── Default macro values (matches engine defaults) ──
// These are ONLY used if ALL sources fail AND cache is empty.
const DEFAULT_MACRO: MacroIndicators = {
  repoRate: 0.0525,             // RBI repo rate as of Feb 2026
  cpi: 0.0275,                  // CPI YoY as of Jan 2026
  gdpGrowthRate: 0.065,         // GDP FY2024-25 provisional
  bondYield10Y: 0.0670,         // 10Y G-Sec as of Mar 2026
  hotelSupplyGrowthPct: 0.03,   // Industry estimate
};

// ── Market data history logger type ──
// G-4/F-8: Every market data fetch is logged to an append-only audit trail.
// The logger is injected via connectHistoryDB() to avoid coupling with DB package.
type HistoryLogEntry = {
  indicator: string;
  value: number;
  asOfDate: string;
  source: string;
  sourceType: string;
  previousValue?: number;
  changeReason?: string;
};
type HistoryLogger = (entries: HistoryLogEntry[]) => Promise<void>;

export class MarketDataService {
  private cache: MarketDataCache;
  private config: MCPConfig;
  private historyLogger: HistoryLogger | null = null;

  constructor(config: MCPConfig) {
    this.config = config;
    this.cache = new MarketDataCache();
  }

  /** Connect market data history logger (for append-only audit trail) */
  connectHistoryDB(logger: HistoryLogger): void {
    this.historyLogger = logger;
  }

  /** Log market data indicators to the history table (fire-and-forget) */
  private async logHistory(entries: HistoryLogEntry[]): Promise<void> {
    if (!this.historyLogger) return;
    try {
      await this.historyLogger(entries);
    } catch {
      // Don't fail the main flow if history logging fails
    }
  }

  /** Optionally connect the DB tier for persistent caching */
  connectCacheDB(
    query: (key: string) => Promise<any>,
    write: (entry: any) => Promise<void>,
  ): void {
    this.cache.connectDB(query, write);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MACRO INDICATORS — feeds directly into Factor engine
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Full macro snapshot for the Factor engine.
   * Fetches from all sources in parallel, merges, caches.
   * Returns the core MacroIndicators type + extended fields + per-indicator metadata.
   */
  async getMacroIndicators(): Promise<LiveMacroData> {
    // Check cache first
    const cached = await this.cache.get<LiveMacroData>('macro:india');
    if (cached) return { ...cached, source: 'cached' };

    // Fetch all sources in parallel (graceful degradation per source)
    const [repoRate, cpi, bondYieldFRED, bondYieldRBI, gdpArr, usdInr] = await Promise.allSettled([
      getRepoRate(this.config.rbiApiKey),                    // RBI official
      getCPI(this.config.rbiApiKey),                         // MOSPI official
      getIndia10YBondYield(this.config.fredApiKey),          // FRED (primary for bond yield)
      getBondYield10Y(this.config.fredApiKey),               // RBI/CCIL (fallback for bond yield)
      getGDPGrowth(3),                                       // World Bank (annual GDP)
      getUSDINR(this.config.fredApiKey),                     // FRED → open.er-api.com → fallback
    ]);

    // ── Extract values with fallbacks ──

    // Repo Rate: from RBI client (official MPC value)
    const repoResult = repoRate.status === 'fulfilled' ? repoRate.value : null;
    const repo = repoResult?.rate ?? DEFAULT_MACRO.repoRate;

    // CPI: from MOSPI via RBI client
    const cpiResult = cpi.status === 'fulfilled' ? cpi.value : null;
    const cpiVal = cpiResult?.yoyGrowth ?? DEFAULT_MACRO.cpi;

    // Bond Yield: prefer FRED (more frequently updated), fall back to RBI/CCIL
    let bond = DEFAULT_MACRO.bondYield10Y;
    let bondSource = 'fallback';
    let bondDate = '2026-03-02';
    if (bondYieldFRED.status === 'fulfilled' && bondYieldFRED.value.source !== 'fallback') {
      bond = bondYieldFRED.value.value;
      bondSource = bondYieldFRED.value.source;
      bondDate = bondYieldFRED.value.date;
    } else if (bondYieldRBI.status === 'fulfilled') {
      bond = bondYieldRBI.value.yield10Y;
      bondSource = bondYieldRBI.value.source;
      bondDate = bondYieldRBI.value.date;
    } else if (bondYieldFRED.status === 'fulfilled') {
      // Even FRED fallback is better than DEFAULT_MACRO
      bond = bondYieldFRED.value.value;
      bondSource = bondYieldFRED.value.source;
      bondDate = bondYieldFRED.value.date;
    }

    // USD/INR: from 3-tier FRED client
    const forexResult = usdInr.status === 'fulfilled' ? usdInr.value : null;
    const forex = forexResult?.value ?? 92.15;

    // GDP: use latest available year from World Bank
    let gdpGrowth = DEFAULT_MACRO.gdpGrowthRate;
    let gdpYear = '2024-25';
    let gdpSource = 'fallback';
    if (gdpArr.status === 'fulfilled' && gdpArr.value.length > 0) {
      gdpGrowth = gdpArr.value[0].value;
      gdpYear = gdpArr.value[0].year;
      gdpSource = gdpArr.value[0].source;
    }

    // Determine inflation trend from CPI direction
    // Use RBI's own characterization: current 2.75% is well below 4% target → falling
    let inflationTrend: 'rising' | 'stable' | 'falling' = 'stable';
    if (cpiVal < 0.035) inflationTrend = 'falling';      // Below RBI's 4% target
    else if (cpiVal > 0.055) inflationTrend = 'rising';   // Above comfort zone

    // Determine overall source status
    const sourceStatuses = [
      repoResult?.source,
      cpiResult?.source,
      bondSource,
      gdpSource,
      forexResult?.source,
    ];
    const hasLive = sourceStatuses.some(s =>
      s === 'rbi-api' || s === 'mospi-api' || s === 'fred' || s === 'exchangerate-api' || s === 'world-bank'
    );
    const hasOfficial = sourceStatuses.some(s =>
      s === 'rbi-official' || s === 'mospi-official' || s === 'ccil-official'
    );

    // Build per-indicator metadata for UI freshness display
    const indicators: LiveMacroData['indicators'] = {
      repoRate: {
        value: repo,
        asOfDate: repoResult?.effectiveDate ?? '2026-02-07',
        source: repoResult?.source === 'rbi-api' ? 'RBI DBIE API' : 'RBI MPC Decision',
        sourceType: repoResult?.source === 'rbi-api' ? 'live-api' : 'official',
      },
      cpi: {
        value: cpiVal,
        asOfDate: cpiResult?.period ?? '2026-01',
        source: cpiResult?.source === 'mospi-api' ? 'MOSPI/data.gov.in API' : 'MOSPI Press Release',
        sourceType: cpiResult?.source === 'mospi-api' ? 'live-api' : 'official',
      },
      gdpGrowth: {
        value: gdpGrowth,
        asOfDate: gdpYear,
        source: gdpSource === 'world-bank' ? 'World Bank Open Data' : 'MOSPI Provisional Estimates',
        sourceType: gdpSource === 'world-bank' ? 'live-api' : 'fallback',
      },
      bondYield10Y: {
        value: bond,
        asOfDate: bondDate,
        source: bondSource === 'fred' ? 'FRED INDIRLTLT01STM' : 'CCIL/Trading Economics',
        sourceType: bondSource === 'fred' ? 'live-api' : 'official',
      },
      usdInr: {
        value: forex,
        asOfDate: forexResult?.date ?? '2026-03-04',
        source: forexResult?.source === 'fred' ? 'FRED DEXINUS'
              : forexResult?.source === 'exchangerate-api' ? 'Open ExchangeRate API'
              : 'Manual Fallback',
        sourceType: (forexResult?.source === 'fred' || forexResult?.source === 'exchangerate-api')
                    ? 'live-api' : 'fallback',
      },
      hotelSupplyGrowth: {
        value: 0.03,
        asOfDate: '2025',
        source: 'Industry Estimate (HVS/JLL)',
        sourceType: 'fallback',
      },
    };

    const result: LiveMacroData = {
      repoRate: repo,
      cpi: cpiVal,
      gdpGrowthRate: gdpGrowth,
      bondYield10Y: bond,
      hotelSupplyGrowthPct: 0.03,
      usdInrRate: forex,
      inflationTrend,
      source: hasLive ? 'live' : (hasOfficial ? 'live' : 'fallback'),
      fetchedAt: new Date().toISOString(),
      indicators,
    };

    // ── G-4/F-8: Log each indicator to market_data_history (append-only) ──
    await this.logHistory([
      { indicator: 'repoRate', value: repo, asOfDate: repoResult?.effectiveDate ?? '2026-02-07', source: indicators.repoRate.source, sourceType: indicators.repoRate.sourceType },
      { indicator: 'cpi', value: cpiVal, asOfDate: cpiResult?.period ?? '2026-01', source: indicators.cpi.source, sourceType: indicators.cpi.sourceType },
      { indicator: 'gdpGrowthRate', value: gdpGrowth, asOfDate: gdpYear, source: indicators.gdpGrowth.source, sourceType: indicators.gdpGrowth.sourceType },
      { indicator: 'bondYield10Y', value: bond, asOfDate: bondDate, source: indicators.bondYield10Y.source, sourceType: indicators.bondYield10Y.sourceType },
      { indicator: 'usdInrRate', value: forex, asOfDate: forexResult?.date ?? '2026-03-04', source: indicators.usdInr.source, sourceType: indicators.usdInr.sourceType },
      { indicator: 'hotelSupplyGrowthPct', value: 0.03, asOfDate: '2025', source: 'Industry Estimate (HVS/JLL)', sourceType: 'fallback' },
    ]);

    // Cache with appropriate TTL (use shorter forex TTL since it drives cache invalidation)
    await this.cache.set('macro:india', result, TTL.forex, 'multi-source');
    return result;
  }

  /**
   * Extract just the core MacroIndicators for the Factor engine.
   * This is the integration point — returns the type the engine expects.
   */
  async getFactorMacro(): Promise<MacroIndicators & { source: string }> {
    const live = await this.getMacroIndicators();
    return {
      repoRate: live.repoRate,
      cpi: live.cpi,
      gdpGrowthRate: live.gdpGrowthRate,
      bondYield10Y: live.bondYield10Y,
      hotelSupplyGrowthPct: live.hotelSupplyGrowthPct,
      source: live.source,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // CITY PROFILE — enriches deal context
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive market profile for a city.
   * Combines airport traffic, tourism, and housing data.
   */
  async getCityProfile(city: string): Promise<CityMarketProfile> {
    const cacheKey = `city:${city.toLowerCase().trim()}`;
    const cached = await this.cache.get<CityMarketProfile>(cacheKey);
    if (cached) return { ...cached, source: 'cached' };

    const [airport, tourism, housing] = await Promise.allSettled([
      getAirportTraffic(city, this.config.dataGovInApiKey),
      getTourismByState(city, this.config.dataGovInApiKey),
      getHousingPriceIndex(city, this.config.dataGovInApiKey),
    ]);

    const airportData = airport.status === 'fulfilled' ? airport.value : null;
    const tourismData = tourism.status === 'fulfilled' ? tourism.value : null;
    const housingData = housing.status === 'fulfilled' ? housing.value : null;

    // Compute demand outlook based on composite signals
    const signals = [
      airportData?.growth ?? 0.10,
      tourismData?.growthPct ?? 0.10,
      housingData?.growthPct ?? 0.04,
    ];
    const avgGrowth = signals.reduce((a, b) => a + b, 0) / signals.length;
    let demandOutlook: 'strong' | 'moderate' | 'weak' = 'moderate';
    if (avgGrowth > 0.12) demandOutlook = 'strong';
    else if (avgGrowth < 0.06) demandOutlook = 'weak';

    const result: CityMarketProfile = {
      city,
      state: getStateForCity(city),
      airportPassengers: airportData?.passengers ?? 3_000_000,
      airportGrowthPct: airportData?.growth ?? 0.10,
      touristArrivals: {
        domestic: tourismData?.domestic ?? 10_000_000,
        foreign: tourismData?.foreign ?? 200_000,
        growthPct: tourismData?.growthPct ?? 0.10,
      },
      housingPriceIndex: housingData?.index ?? 220,
      housingGrowthPct: housingData?.growthPct ?? 0.04,
      demandOutlook,
      fetchedAt: new Date().toISOString(),
      source: (airportData?.source === 'live' || tourismData?.source === 'live' || housingData?.source === 'live')
        ? 'live'
        : 'fallback',
    };

    await this.cache.set(cacheKey, result, TTL.city, 'city-profile');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEMAND SIGNALS — weighted composite for investment scoring
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compute demand signals for a city.
   * Returns a 0-100 composite score weighted by:
   *   40% tourist growth, 30% air traffic growth, 30% GDP growth
   */
  async getDemandSignals(city: string): Promise<DemandSignals> {
    const cacheKey = `demand:${city.toLowerCase().trim()}`;
    const cached = await this.cache.get<DemandSignals>(cacheKey);
    if (cached) return cached;

    const [cityProfile, macro] = await Promise.all([
      this.getCityProfile(city),
      this.getMacroIndicators(),
    ]);

    const touristGrowthPct = cityProfile.touristArrivals.growthPct;
    const airTrafficGrowthPct = cityProfile.airportGrowthPct;
    const gdpGrowthPct = macro.gdpGrowthRate;

    // Normalize each to 0-100 scale (cap at 25% growth = 100)
    const normalize = (pct: number) => Math.min(100, Math.max(0, (pct / 0.25) * 100));

    const compositeScore = Math.round(
      normalize(touristGrowthPct) * 0.40 +
      normalize(airTrafficGrowthPct) * 0.30 +
      normalize(gdpGrowthPct) * 0.30
    );

    const result: DemandSignals = {
      touristGrowthPct,
      airTrafficGrowthPct,
      gdpGrowthPct,
      compositeScore,
    };

    await this.cache.set(cacheKey, result, TTL.tourism, 'demand-signals');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONSTRUCTION COSTS — CAPEX forecasting aid
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get construction cost trend.
   * Currently uses curated CPWD (Central Public Works Department) indices.
   * Will integrate live CPWD data when API becomes available.
   */
  async getConstructionCostTrend(): Promise<CostTrend> {
    const cached = await this.cache.get<CostTrend>('construction:costs');
    if (cached) return cached;

    // CPWD cost index data (curated, updated quarterly)
    // Base year 2011-12 = 100
    const result: CostTrend = {
      currentIndex: 165,
      baseYear: 2012,
      yoyGrowthPct: 0.058,
      forecastGrowthPct: 0.055,
      fetchedAt: new Date().toISOString(),
      source: 'fallback',
    };

    await this.cache.set('construction:costs', result, TTL.construction, 'cpwd');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // HEALTH CHECK — monitor source availability
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check which data sources are reachable.
   * Useful for diagnostics and the Market Intel tab freshness indicator.
   */
  async healthCheck(): Promise<MCPHealthStatus> {
    const checks = await Promise.allSettled([
      getRepoRate(this.config.rbiApiKey),                    // RBI
      getGDPGrowth(1),                                        // World Bank
      getUSDINR(this.config.fredApiKey),                     // FRED + free forex
      getAirportTraffic('delhi', this.config.dataGovInApiKey), // data.gov.in
    ]);

    const status = (result: PromiseSettledResult<any>): 'ok' | 'degraded' | 'offline' => {
      if (result.status === 'rejected') return 'offline';
      const src = (result.value as any)?.source;
      // 'official' sources are authoritative — they're not degraded
      if (src === 'fallback') return 'degraded';
      return 'ok';
    };

    // Forex check — uses same result as FRED check
    const forexStatus = (): 'ok' | 'degraded' | 'offline' => {
      if (checks[2].status === 'rejected') return 'offline';
      const src = (checks[2].value as any)?.source;
      if (src === 'fred' || src === 'exchangerate-api') return 'ok';
      return 'degraded';
    };

    const cacheStats = this.cache.getStats();

    return {
      rbi: status(checks[0]),
      worldBank: status(checks[1]),
      fred: status(checks[2]),
      dataGovIn: status(checks[3]),
      forex: forexStatus(),
      cacheHitRate: cacheStats.hitRate,
      lastCheck: new Date().toISOString(),
    };
  }

  /** Force-refresh all cached data */
  async refresh(): Promise<void> {
    this.cache.clear();
    resetCircuits();
    // Pre-fetch macro data to warm cache
    await this.getMacroIndicators();
  }

  /** Get cache statistics */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON — shared across routes and recompute service
// ═══════════════════════════════════════════════════════════════════

let _instance: MarketDataService | null = null;

/** Create and initialize the singleton */
export function createMarketDataService(config: MCPConfig): MarketDataService {
  _instance = new MarketDataService(config);
  return _instance;
}

/** Get the singleton (throws if not initialized) */
export function getMarketDataService(): MarketDataService {
  if (!_instance) {
    throw new Error('MarketDataService not initialized — call createMarketDataService() first');
  }
  return _instance;
}
