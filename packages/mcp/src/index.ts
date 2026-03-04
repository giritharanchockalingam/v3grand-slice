// ─── @v3grand/mcp — Market Intelligence Package ───────────────────
// Barrel export for the MCP market data service.

// Service (singleton)
export {
  MarketDataService,
  createMarketDataService,
  getMarketDataService,
} from './service.js';

// Types
export type {
  LiveMacroData,
  CityMarketProfile,
  DemandSignals,
  CostTrend,
  MCPConfig,
  MCPHealthStatus,
  CacheEntry,
  IndicatorMeta,
} from './types.js';

// Individual clients (for advanced usage / testing)
export { getRepoRate, getCPI, getBondYield10Y, getCurrentOfficialValues } from './clients/rbi.js';
export { getGDPGrowth, getInflation, getTouristArrivals, getFDIInflows } from './clients/world-bank.js';
export { getUSDINR, getIndia10YBondYield, getIndiaInterestRate, getSeriesLatest } from './clients/fred.js';
export {
  getAirportTraffic, getTourismByState, getHousingPriceIndex,
  getStateForCity, getAirportCodeForCity,
} from './clients/data-gov-in.js';

// Cache (for DB integration)
export { MarketDataCache } from './clients/cache.js';

// HTTP client (for testing)
export { fetchWithRetry, resetCircuits } from './clients/http-client.js';
