// ─── MCP Tools: Web Search + Real-Time Data APIs ──────────────────────
// Enterprise-grade external data sources for 16 CFO specialist agents.
//
// PRIMARY SEARCH:   Serper.dev (2,500 free/month, Google results, AI-optimized)
// FALLBACK:         Brave Search → SerpAPI → graceful degradation
//
// FINANCIAL DATA:   FRED (free, 120K series), Yahoo Finance (free, real-time)
// MACRO DATA:       World Bank (free, 16K indicators), Trading Economics (free tier)
// ESG DATA:         World Bank ESG DataBank (free)
// REGULATORY:       Specialized Indian regulatory search templates

import { z } from 'zod';

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ): void;
};

// ═══════════════════════════════════════════════════════════════════
// SEARCH ENGINES (Serper → Brave → SerpAPI → graceful degradation)
// ═══════════════════════════════════════════════════════════════════

/**
 * Serper.dev — PRIMARY search engine.
 * Free: 2,500 queries/month (no CC required)
 * Returns Google search results optimized for AI consumption.
 * https://serper.dev
 */
async function serperSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string; date?: string }>;
  source: 'serper' | 'unavailable';
  knowledgeGraph?: Record<string, unknown>;
}> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { results: [], source: 'unavailable' };

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: count,
        gl: 'in',      // India geo-targeting
        hl: 'en',      // English
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`Serper API error: ${response.status}`);
      return { results: [], source: 'unavailable' };
    }

    const data = await response.json() as {
      organic?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
        date?: string;
        position?: number;
      }>;
      knowledgeGraph?: Record<string, unknown>;
      answerBox?: { answer?: string; snippet?: string; title?: string };
    };

    const results = (data.organic ?? []).slice(0, count).map((r) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      description: r.snippet ?? '',
      date: r.date,
    }));

    return { results, source: 'serper', knowledgeGraph: data.knowledgeGraph };
  } catch (err) {
    console.error('Serper search failed:', err instanceof Error ? err.message : err);
    return { results: [], source: 'unavailable' };
  }
}

/**
 * Brave Search — FALLBACK #1
 * Free: 2,000 queries/month
 */
async function braveSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string; age?: string }>;
  source: 'brave-api' | 'unavailable';
}> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { results: [], source: 'unavailable' };

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=strict&text_decorations=false`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { results: [], source: 'unavailable' };

    const data = await response.json() as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
    };

    return {
      results: (data.web?.results ?? []).map((r) => ({
        title: r.title ?? '', url: r.url ?? '', description: r.description ?? '', age: r.age,
      })),
      source: 'brave-api',
    };
  } catch {
    return { results: [], source: 'unavailable' };
  }
}

/**
 * SerpAPI — FALLBACK #2
 * Free: 100 queries/month
 */
async function serpApiSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string }>;
  source: 'serpapi' | 'unavailable';
}> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return { results: [], source: 'unavailable' };

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${count}&api_key=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { results: [], source: 'unavailable' };

    const data = await response.json() as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    return {
      results: (data.organic_results ?? []).slice(0, count).map((r) => ({
        title: r.title ?? '', url: r.link ?? '', description: r.snippet ?? '',
      })),
      source: 'serpapi',
    };
  } catch {
    return { results: [], source: 'unavailable' };
  }
}

/** Multi-tier search: Serper → Brave → SerpAPI → empty */
async function multiTierSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string; date?: string }>;
  source: string;
  knowledgeGraph?: Record<string, unknown>;
}> {
  // Tier 1: Serper (primary)
  const serperResult = await serperSearch(query, count);
  if (serperResult.results.length > 0) return serperResult;

  // Tier 2: Brave Search (fallback)
  const braveResult = await braveSearch(query, count);
  if (braveResult.results.length > 0) {
    return { results: braveResult.results, source: 'brave-api' };
  }

  // Tier 3: SerpAPI (last resort)
  const serpResult = await serpApiSearch(query, count);
  if (serpResult.results.length > 0) {
    return { results: serpResult.results, source: 'serpapi' };
  }

  return { results: [], source: 'unavailable' };
}


// ═══════════════════════════════════════════════════════════════════
// FRED API — Federal Reserve Economic Data (free, 120K+ series)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch a FRED series. Free API key from https://fred.stlouisfed.org/docs/api/api_key.html
 * Key series for Indian hotel investment:
 *   INDIRLTLT01STM  — India 10Y bond yield
 *   DEXINUS          — USD/INR exchange rate
 *   INDCPIALLMINMEI  — India CPI
 *   NYGDPMKTPKDZG    — India GDP (current $)
 *   DFF              — US Fed Funds Rate (global rate environment)
 *   BAMLHE00EHYIEY   — US High Yield spread (global risk appetite)
 */
async function fetchFredSeries(seriesId: string, limit = 5): Promise<{
  observations: Array<{ date: string; value: number }>;
  source: string;
  seriesId: string;
} | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;

    const data = await response.json() as {
      observations?: Array<{ date?: string; value?: string }>;
    };

    const observations = (data.observations ?? [])
      .filter(o => o.value && o.value !== '.')
      .map(o => ({ date: o.date ?? '', value: parseFloat(o.value!) }));

    return { observations, source: 'FRED', seriesId };
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════
// WORLD BANK API — Free, 16K+ indicators, 200+ countries
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch World Bank indicator for India.
 * Key indicators:
 *   NY.GDP.MKTP.KD.ZG  — GDP growth (annual %)
 *   FP.CPI.TOTL.ZG     — Inflation (CPI, annual %)
 *   FR.INR.RINR         — Real interest rate (%)
 *   EN.ATM.CO2E.PC     — CO2 emissions per capita (ESG)
 *   EG.ELC.RNWX.ZS     — Renewable electricity output (% of total)
 *   SP.URB.TOTL.IN.ZS  — Urban population (% of total)
 */
async function fetchWorldBankIndicator(indicator: string, years = 5): Promise<{
  data: Array<{ year: string; value: number }>;
  source: string;
  indicator: string;
} | null> {
  try {
    const url = `https://api.worldbank.org/v2/country/IND/indicator/${indicator}?format=json&per_page=${years}&mrv=${years}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;

    const json = await response.json() as Array<unknown>;
    if (!Array.isArray(json) || json.length < 2) return null;

    const records = json[1] as Array<{ date?: string; value?: number | null }>;
    const data = (records ?? [])
      .filter(r => r.value != null)
      .map(r => ({ year: r.date ?? '', value: r.value! }));

    return { data, source: 'World Bank', indicator };
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════
// YAHOO FINANCE — Free real-time Indian market data
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch Yahoo Finance quote for Indian tickers.
 * Key tickers:
 *   ^NSEI       — NIFTY 50
 *   ^BSESN      — SENSEX
 *   NIFTYBEES.NS — NIFTY ETF
 *   INDIANHOTEL.NS — Indian Hotels Company (Taj)
 *   LEMONTREE.NS   — Lemon Tree Hotels
 *   CHALET.NS      — Chalet Hotels
 *   INR=X          — USD/INR
 */
async function fetchYahooFinanceQuote(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  name: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  source: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'V3Grand-InvestmentOS/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            previousClose?: number;
            shortName?: string;
            marketCap?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
          };
        }>;
      };
    };

    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      name: meta.shortName ?? symbol,
      marketCap: meta.marketCap,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      source: 'Yahoo Finance',
    };
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════
// AUTHORITATIVE INDIAN REFERENCE DATA
// Updated from official sources (CBIC, State Revenue Depts, CPWD, Hotelivate)
// ═══════════════════════════════════════════════════════════════════

/** GST rates for hotel/hospitality (CBIC notification, effective from 2023) */
const GST_RATES_HOSPITALITY = {
  source: 'CBIC Notification No. 03/2022, GST Council 50th Meeting (Jul 2023)',
  lastUpdated: '2023-07-11',
  rates: [
    { category: 'Room tariff up to ₹1,000/night', gst: 12, sacCode: '996311' },
    { category: 'Room tariff ₹1,001 to ₹7,500/night', gst: 12, sacCode: '996311' },
    { category: 'Room tariff above ₹7,500/night', gst: 18, sacCode: '996311' },
    { category: 'Restaurant (non-AC, no liquor)', gst: 5, sacCode: '996331', itcAvailable: false },
    { category: 'Restaurant (AC / liquor license)', gst: 5, sacCode: '996331', itcAvailable: false },
    { category: 'Restaurant in hotel (tariff > ₹7,500)', gst: 18, sacCode: '996331', itcAvailable: true },
    { category: 'Outdoor catering', gst: 5, sacCode: '996335', itcAvailable: false },
    { category: 'Banquet/conference hall rental', gst: 18, sacCode: '997212' },
    { category: 'Spa/wellness services', gst: 18, sacCode: '999723' },
    { category: 'Laundry services', gst: 18, sacCode: '998511' },
  ],
  tds: {
    section194I: { threshold: 240000, rate: 10, description: 'TDS on rent (land/building)' },
    section194C: { threshold: 30000, singleRate: 1, aggregateRate: 2, description: 'TDS on contractor payments' },
    section194J: { threshold: 30000, rate: 10, description: 'TDS on professional/technical fees' },
  },
};

/** Stamp duty rates by state (as of 2025-26, from state revenue department notifications) */
const STAMP_DUTY_BY_STATE: Record<string, {
  male: number; female: number; joint: number;
  registrationCharge: number; metroSurcharge?: number; notes: string; source: string;
}> = {
  'Maharashtra': { male: 6, female: 5, joint: 6, registrationCharge: 1, metroSurcharge: 1, notes: '1% metro cess in Mumbai, Pune, Nagpur, Nashik. Rebate for women.', source: 'Maharashtra Stamp Act, IGR Maharashtra' },
  'Goa': { male: 5, female: 3.5, joint: 5, registrationCharge: 1.5, notes: '3.5% for women buyers (Goa state incentive). Commercial: 5% flat.', source: 'Goa Stamp Act, Dept of Registration, Goa' },
  'Karnataka': { male: 5, female: 5, joint: 5, registrationCharge: 1, metroSurcharge: 2, notes: '2% BBMP surcharge in Bangalore. Reduced to 3% for properties < ₹35L.', source: 'Karnataka Stamp Act, Kaveri Online Portal' },
  'Rajasthan': { male: 6, female: 5, joint: 6, registrationCharge: 1, notes: '1% less for women buyers. Additional 10% cess on stamp duty.', source: 'Rajasthan Stamp Act, e-Registration Rajasthan' },
  'Tamil Nadu': { male: 7, female: 7, joint: 7, registrationCharge: 1, notes: 'Highest in India. No gender benefit.', source: 'Tamil Nadu Registration Dept, TNREGINET' },
  'Delhi': { male: 6, female: 4, joint: 5, registrationCharge: 1, notes: '4% for women, 5% for joint (m+f).', source: 'Delhi Revenue Dept, DoRIS Portal' },
  'Kerala': { male: 8, female: 8, joint: 8, registrationCharge: 2, notes: '8% stamp duty + 2% registration. Highest effective rate.', source: 'Kerala Registration Dept' },
  'Telangana': { male: 6, female: 6, joint: 6, registrationCharge: 0.5, notes: 'Registration charge capped at ₹50,000.', source: 'Telangana IGRS Portal' },
  'Uttar Pradesh': { male: 7, female: 6, joint: 7, registrationCharge: 1, notes: '1% less for women buyers.', source: 'UP Stamp & Registration Dept, IGRSUP' },
  'Madhya Pradesh': { male: 7.5, female: 7.5, joint: 7.5, registrationCharge: 3, notes: 'Highest registration charge. Social infrastructure cess additional.', source: 'MP Revenue Dept, SAMPADA Portal' },
  'Gujarat': { male: 4.9, female: 4.9, joint: 4.9, registrationCharge: 1, notes: 'Among lowest. GIFT City: 0% stamp duty.', source: 'Gujarat Revenue Dept, e-Dhara Portal' },
  'West Bengal': { male: 7, female: 6, joint: 7, registrationCharge: 1, notes: 'KMC area may have additional surcharge.', source: 'WB Registration Dept, e-Nathikaran' },
  'Himachal Pradesh': { male: 6, female: 4, joint: 5, registrationCharge: 2, notes: 'Rural areas may have reduced rates.', source: 'HP Revenue Dept' },
  'Uttarakhand': { male: 5, female: 3.75, joint: 5, registrationCharge: 2, notes: 'Women get 25% rebate.', source: 'UK Revenue Dept' },
  'Odisha': { male: 5, female: 4, joint: 5, registrationCharge: 1, notes: 'Lower for women buyers.', source: 'Odisha Revenue Dept, IGR Odisha' },
};

/** Hotel industry benchmarks (sourced from Hotelivate/Horwath HTL 2025-26 reports) */
const HOTEL_BENCHMARKS_2025_26 = {
  source: 'Hotelivate India Hotel Market Review 2025, Horwath HTL Annual Report, JLL India Hospitality Report 2025',
  lastUpdated: '2025-12',
  national: {
    occupancy: 68.5,
    adrUsd: 108,
    adrInr: 9950,
    revparUsd: 74,
    revparInr: 6816,
    supplyGrowthPct: 5.8,
    pipelineRooms: 114000,
    pipelineGrowthYoY: 58,
  },
  byTier: {
    'tier-1': { occupancy: 75.2, adrUsd: 119, adrInr: 10950, revparUsd: 89, revparInr: 8190, cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata'] },
    'tier-2': { occupancy: 67.8, adrUsd: 84, adrInr: 7730, revparUsd: 57, revparInr: 5243, cities: ['Goa', 'Pune', 'Jaipur', 'Ahmedabad', 'Kochi', 'Chandigarh', 'Lucknow'] },
    'tier-3': { occupancy: 56.5, adrUsd: 65, adrInr: 5980, revparUsd: 37, revparInr: 3378, cities: ['Madurai', 'Visakhapatnam', 'Indore', 'Bhopal', 'Coimbatore', 'Mysore'] },
  },
  bySegment: {
    'luxury': { occupancy: 70, adrInr: 18500, revparInr: 12950, pricePerKey: { minCr: 2.5, maxCr: 6.0 }, capRate: { min: 6.5, max: 8.0 } },
    'upper-upscale': { occupancy: 72, adrInr: 12000, revparInr: 8640, pricePerKey: { minCr: 1.5, maxCr: 3.5 }, capRate: { min: 7.0, max: 9.0 } },
    'upscale': { occupancy: 74, adrInr: 8500, revparInr: 6290, pricePerKey: { minCr: 0.8, maxCr: 2.0 }, capRate: { min: 7.5, max: 9.5 } },
    'upper-midscale': { occupancy: 76, adrInr: 5500, revparInr: 4180, pricePerKey: { minCr: 0.5, maxCr: 1.2 }, capRate: { min: 8.0, max: 10.5 } },
    'midscale': { occupancy: 72, adrInr: 3800, revparInr: 2736, pricePerKey: { minCr: 0.3, maxCr: 0.8 }, capRate: { min: 9.0, max: 12.0 } },
  },
  constructionCost: {
    source: 'CPWD Cost Index 2025, CIDC Quarterly Report, JLL Construction Cost Guide India 2025',
    perSqFt: {
      'luxury-5star': { min: 8000, max: 14000, avg: 11000 },
      'upscale-4star': { min: 5500, max: 9000, avg: 7250 },
      'midscale-3star': { min: 3500, max: 6000, avg: 4750 },
    },
    perKey: {
      'luxury-5star': { minLakh: 90, maxLakh: 200, avgLakh: 145 },
      'upscale-4star': { minLakh: 50, maxLakh: 120, avgLakh: 85 },
      'midscale-3star': { minLakh: 25, maxLakh: 60, avgLakh: 42.5 },
    },
    materialIndices: {
      cement: { pricePerTon: 11500, yoyChange: 4.2, source: 'CIDC/CementsPrice.com Q4 2025' },
      steel: { pricePerTon: 58000, yoyChange: -2.1, source: 'SteelOrbis India Q4 2025' },
      labour: { yoyWageGrowth: 8.5, source: 'CIDC Labour Cost Index 2025' },
    },
  },
};


// ═══════════════════════════════════════════════════════════════════
// TOOL REGISTRATIONS
// ═══════════════════════════════════════════════════════════════════

export function registerWebSearchTools(server: Server): void {

  // ── 1. web_search: General-purpose search (Serper → Brave → SerpAPI) ──
  server.registerTool(
    'web_search',
    z.object({
      query: z.string().min(3).max(500).describe(
        'Search query. Be specific: include location, year, and data type. ' +
        'Examples: "Goa 5-star hotel ADR occupancy 2025 2026", ' +
        '"RBI repo rate February 2026 decision", ' +
        '"India hotel transaction cap rate 2025"'
      ),
      count: z.number().int().min(1).max(10).optional().describe('Number of results (default 5)'),
    }).describe(
      'Search the web for real-time market data, regulatory updates, competitive intelligence, ' +
      'and current industry benchmarks. Uses Google via Serper.dev with Brave/SerpAPI fallback. ' +
      'Always cite the source URL in your analysis.'
    ),
    async (args) => {
      const { query, count = 5 } = args as { query: string; count?: number };
      const searchResult = await multiTierSearch(query, count);

      if (searchResult.results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query, results: [], source: 'unavailable',
              note: 'Web search unavailable (no SERPER_API_KEY, BRAVE_SEARCH_API_KEY, or SERP_API_KEY configured). ' +
                    'Use internal reference data and clearly disclose: "Based on industry benchmarks, not live web data."',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            results: searchResult.results,
            source: searchResult.source,
            knowledgeGraph: searchResult.knowledgeGraph,
            fetchedAt: new Date().toISOString(),
            note: 'Live web results. Cite specific URLs when referencing data.',
          }, null, 2),
        }],
      };
    },
  );


  // ── 2. search_hotel_market: Specialized hotel market search ──
  server.registerTool(
    'search_hotel_market',
    z.object({
      city: z.string().min(2).describe('City name, e.g. Goa, Mumbai, Jaipur'),
      starRating: z.number().int().min(3).max(7).optional().describe('Hotel star rating (3-5)'),
      metric: z.enum(['adr', 'occupancy', 'revpar', 'supply', 'demand', 'cap_rate', 'transaction']).describe('Metric to search for'),
    }).describe('Search for specific hotel market metrics in a city with real-time web results.'),
    async (args) => {
      const { city, starRating, metric } = args as { city: string; starRating?: number; metric: string };

      const metricQueries: Record<string, string> = {
        adr: `${city} hotel average daily rate ADR ${starRating ? starRating + '-star' : ''} 2025 2026 India RevPAR`,
        occupancy: `${city} hotel occupancy rate percentage ${starRating ? starRating + '-star' : ''} 2025 2026 India`,
        revpar: `${city} hotel RevPAR revenue per available room 2025 2026 India Hotelivate`,
        supply: `${city} new hotel supply pipeline upcoming hotels ${starRating ? starRating + '-star' : ''} 2025 2026 India`,
        demand: `${city} hotel demand tourism growth foreign domestic arrivals 2025 2026`,
        cap_rate: `India hotel cap rate ${city} hospitality transaction yield 2025 JLL CBRE`,
        transaction: `India hotel acquisition sale transaction ${city} 2024 2025 price per key deal`,
      };

      const query = metricQueries[metric] ?? `${city} hotel ${metric} 2025 2026`;
      const searchResult = await multiTierSearch(query, 5);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query, city, metric, starRating,
            results: searchResult.results,
            source: searchResult.source,
            fetchedAt: new Date().toISOString(),
            note: searchResult.results.length > 0
              ? 'Live hotel market data. Cross-reference with internal benchmarks.'
              : 'No live results. Use get_hotel_benchmarks tool for authoritative reference data.',
          }, null, 2),
        }],
      };
    },
  );


  // ── 3. search_regulatory: Indian regulatory/legal search ──
  server.registerTool(
    'search_regulatory',
    z.object({
      state: z.string().min(2).describe('Indian state, e.g. Goa, Maharashtra'),
      topic: z.enum(['rera', 'zoning', 'environmental', 'tax', 'licensing', 'labor']).describe('Regulatory topic'),
    }).describe('Search for current Indian regulatory requirements and compliance updates.'),
    async (args) => {
      const { state, topic } = args as { state: string; topic: string };

      const topicQueries: Record<string, string> = {
        rera: `${state} RERA real estate regulation 2025 2026 latest rules registered projects`,
        zoning: `${state} zoning regulation hotel hospitality FSI FAR development control rules 2025`,
        environmental: `${state} environmental clearance CRZ coastal regulation hotel construction 2025 2026`,
        tax: `${state} GST hotel hospitality tax stamp duty registration charge 2025 2026`,
        licensing: `${state} hotel license requirements tourism department trade license 2025`,
        labor: `${state} labor law hotel hospitality minimum wage EPF ESIC 2025 2026`,
      };

      const query = topicQueries[topic] ?? `${state} ${topic} regulation hotel 2025 2026`;
      const searchResult = await multiTierSearch(query, 5);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query, state, topic,
            results: searchResult.results,
            source: searchResult.source,
            fetchedAt: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );


  // ── 4. get_fred_data: FRED economic data series ──
  server.registerTool(
    'get_fred_data',
    z.object({
      seriesId: z.string().describe(
        'FRED series ID. Key series: INDIRLTLT01STM (India 10Y bond), DEXINUS (USD/INR), ' +
        'INDCPIALLMINMEI (India CPI), DFF (US Fed Funds Rate), BAMLHE00EHYIEY (US HY spread), ' +
        'MORTGAGE30US (US 30Y mortgage), CPIAUCSL (US CPI)'
      ),
      limit: z.number().int().min(1).max(50).optional().describe('Number of observations (default 10, most recent first)'),
    }).describe(
      'Fetch real-time economic data from FRED (Federal Reserve Economic Data). ' +
      'Free API with 120,000+ data series. Returns most recent observations.'
    ),
    async (args) => {
      const { seriesId, limit = 10 } = args as { seriesId: string; limit?: number };
      const result = await fetchFredSeries(seriesId, limit);

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              seriesId, error: 'FRED API unavailable (no FRED_API_KEY configured or API error).',
              note: 'Register for a free API key at https://fred.stlouisfed.org/docs/api/api_key.html',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...result,
            fetchedAt: new Date().toISOString(),
            note: `Live data from FRED series ${seriesId}. Source: Federal Reserve Bank of St. Louis.`,
          }, null, 2),
        }],
      };
    },
  );


  // ── 5. get_yahoo_finance_quote: Real-time Indian stock/index data ──
  server.registerTool(
    'get_yahoo_finance_quote',
    z.object({
      symbol: z.string().describe(
        'Yahoo Finance ticker. Key tickers: ^NSEI (NIFTY 50), ^BSESN (SENSEX), ' +
        'INDIANHOTEL.NS (Taj/IHCL), LEMONTREE.NS, CHALET.NS, ' +
        'OBEROI.NS (EIH), ITCHOTEL.NS (ITC Hotels), INR=X (USD/INR)'
      ),
    }).describe(
      'Fetch real-time stock/index quotes from Yahoo Finance. ' +
      'Free, no API key required. Covers NSE/BSE Indian equities and forex.'
    ),
    async (args) => {
      const { symbol } = args as { symbol: string };
      const result = await fetchYahooFinanceQuote(symbol);

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              symbol, error: 'Yahoo Finance API unavailable or invalid symbol.',
              note: 'Try alternative tickers: INDIANHOTEL.NS, ^NSEI, INR=X',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            symbol, ...result,
            fetchedAt: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );


  // ── 6. get_world_bank_data: Development & ESG indicators ──
  server.registerTool(
    'get_world_bank_data',
    z.object({
      indicator: z.string().describe(
        'World Bank indicator code. Key indicators: ' +
        'NY.GDP.MKTP.KD.ZG (GDP growth), FP.CPI.TOTL.ZG (CPI inflation), ' +
        'FR.INR.RINR (real interest rate), EN.ATM.CO2E.PC (CO2/capita), ' +
        'EG.ELC.RNWX.ZS (renewable energy %), SP.URB.TOTL.IN.ZS (urbanization %), ' +
        'BX.KLT.DINV.CD.WD (FDI inflows), ST.INT.ARVL (international tourist arrivals)'
      ),
      years: z.number().int().min(1).max(20).optional().describe('Number of years (default 5)'),
    }).describe(
      'Fetch India development and ESG indicators from World Bank Open Data. ' +
      'Free, no API key required. 16,000+ indicators covering economy, ESG, tourism, infrastructure.'
    ),
    async (args) => {
      const { indicator, years = 5 } = args as { indicator: string; years?: number };
      const result = await fetchWorldBankIndicator(indicator, years);

      if (!result || result.data.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              indicator, error: 'World Bank API returned no data for this indicator.',
              note: 'Search indicators at https://data.worldbank.org/indicator',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...result,
            country: 'India',
            fetchedAt: new Date().toISOString(),
            note: 'Source: World Bank Open Data (free, authoritative).',
          }, null, 2),
        }],
      };
    },
  );


  // ── 7. get_hotel_benchmarks: Authoritative hotel industry reference data ──
  server.registerTool(
    'get_hotel_benchmarks',
    z.object({
      city: z.string().optional().describe('City name to find tier classification'),
      segment: z.enum(['luxury', 'upper-upscale', 'upscale', 'upper-midscale', 'midscale']).optional().describe('Hotel segment'),
      starRating: z.number().int().min(3).max(5).optional().describe('Star rating (maps to segment)'),
    }).describe(
      'Get authoritative Indian hotel industry benchmarks (ADR, RevPAR, occupancy, cap rates, ' +
      'construction costs) sourced from Hotelivate, Horwath HTL, and JLL 2025-26 reports. ' +
      'Use this as the baseline for investment modeling.'
    ),
    async (args) => {
      const { city, segment, starRating } = args as { city?: string; segment?: string; starRating?: number };

      // Determine tier from city
      let tier: string | undefined;
      if (city) {
        const cityLower = city.toLowerCase();
        for (const [t, data] of Object.entries(HOTEL_BENCHMARKS_2025_26.byTier)) {
          if (data.cities.some(c => c.toLowerCase() === cityLower || cityLower.includes(c.toLowerCase()))) {
            tier = t;
            break;
          }
        }
      }

      // Map star rating to segment if segment not provided
      const effectiveSegment = segment ?? (starRating === 5 ? 'luxury' : starRating === 4 ? 'upscale' : starRating === 3 ? 'midscale' : undefined);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            source: HOTEL_BENCHMARKS_2025_26.source,
            lastUpdated: HOTEL_BENCHMARKS_2025_26.lastUpdated,
            national: HOTEL_BENCHMARKS_2025_26.national,
            cityTier: tier ? { tier, ...HOTEL_BENCHMARKS_2025_26.byTier[tier as keyof typeof HOTEL_BENCHMARKS_2025_26.byTier] } : undefined,
            segment: effectiveSegment ? HOTEL_BENCHMARKS_2025_26.bySegment[effectiveSegment as keyof typeof HOTEL_BENCHMARKS_2025_26.bySegment] : undefined,
            constructionCost: HOTEL_BENCHMARKS_2025_26.constructionCost,
            note: 'Authoritative benchmarks from Hotelivate/Horwath HTL/JLL. Cross-reference with web_search for latest data.',
            dataQuality: 'reference-benchmark',
          }, null, 2),
        }],
      };
    },
  );


  // ── 8. get_india_tax_reference: GST, stamp duty, TDS reference ──
  server.registerTool(
    'get_india_tax_reference',
    z.object({
      state: z.string().optional().describe('Indian state for stamp duty lookup'),
      category: z.enum(['gst_hospitality', 'stamp_duty', 'tds', 'all']).optional().describe('Tax category (default: all)'),
    }).describe(
      'Get authoritative Indian tax rates for hotel investments — GST (CBIC notifications), ' +
      'stamp duty by state (state revenue dept), and TDS rates (Income Tax Act). ' +
      'Updated to latest GST Council decisions and state notifications.'
    ),
    async (args) => {
      const { state, category = 'all' } = args as { state?: string; category?: string };

      const result: Record<string, unknown> = {
        fetchedAt: new Date().toISOString(),
        dataQuality: 'reference-benchmark',
      };

      if (category === 'gst_hospitality' || category === 'all') {
        result.gstHospitality = GST_RATES_HOSPITALITY;
      }

      if (category === 'stamp_duty' || category === 'all') {
        if (state) {
          const stateKey = Object.keys(STAMP_DUTY_BY_STATE).find(
            k => k.toLowerCase() === state.toLowerCase() || state.toLowerCase().includes(k.toLowerCase())
          );
          result.stampDuty = stateKey
            ? { state: stateKey, ...STAMP_DUTY_BY_STATE[stateKey] }
            : { error: `No stamp duty data for "${state}". Available: ${Object.keys(STAMP_DUTY_BY_STATE).join(', ')}` };
        } else {
          result.stampDutyAllStates = STAMP_DUTY_BY_STATE;
        }
      }

      if (category === 'tds' || category === 'all') {
        result.tds = GST_RATES_HOSPITALITY.tds;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );


  // ── 9. get_indian_market_snapshot: Composite real-time market view ──
  server.registerTool(
    'get_indian_market_snapshot',
    z.object({}).describe(
      'Get a comprehensive real-time snapshot of Indian financial markets — NIFTY 50, SENSEX, ' +
      'hotel stocks (IHCL, Lemon Tree, Chalet, Oberoi), USD/INR, and key FRED indicators. ' +
      'Aggregates data from Yahoo Finance and FRED in a single call.'
    ),
    async () => {
      const tickers = [
        { symbol: '^NSEI', label: 'NIFTY 50' },
        { symbol: '^BSESN', label: 'SENSEX' },
        { symbol: 'INDIANHOTEL.NS', label: 'Indian Hotels (Taj/IHCL)' },
        { symbol: 'LEMONTREE.NS', label: 'Lemon Tree Hotels' },
        { symbol: 'CHALET.NS', label: 'Chalet Hotels' },
        { symbol: 'INR=X', label: 'USD/INR' },
      ];

      const [quotes, bondYield, fedRate] = await Promise.allSettled([
        Promise.allSettled(tickers.map(t => fetchYahooFinanceQuote(t.symbol))),
        fetchFredSeries('INDIRLTLT01STM', 1),
        fetchFredSeries('DFF', 1),
      ]);

      const marketQuotes: Record<string, unknown> = {};
      if (quotes.status === 'fulfilled') {
        quotes.value.forEach((q, i) => {
          if (q.status === 'fulfilled' && q.value) {
            marketQuotes[tickers[i].label] = q.value;
          }
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            markets: marketQuotes,
            bonds: {
              india10Y: bondYield.status === 'fulfilled' && bondYield.value
                ? { value: bondYield.value.observations[0]?.value, date: bondYield.value.observations[0]?.date, source: 'FRED INDIRLTLT01STM' }
                : { note: 'FRED API unavailable' },
              usFedFunds: fedRate.status === 'fulfilled' && fedRate.value
                ? { value: fedRate.value.observations[0]?.value, date: fedRate.value.observations[0]?.date, source: 'FRED DFF' }
                : { note: 'FRED API unavailable' },
            },
            fetchedAt: new Date().toISOString(),
            source: 'Yahoo Finance + FRED (Federal Reserve Economic Data)',
            note: 'Real-time market snapshot. Hotel stock performance indicates sector sentiment.',
          }, null, 2),
        }],
      };
    },
  );
}
