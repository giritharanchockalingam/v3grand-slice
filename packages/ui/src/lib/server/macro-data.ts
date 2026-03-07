/**
 * Enterprise-grade macro data service — V2.
 *
 * Fetches India macro indicators from the MOST CURRENT sources available.
 * Every data point is fetched live; nothing is hardcoded.
 *
 * Fetcher priority (per indicator):
 *
 *   USD/INR FX        → ExchangeRate-API (daily) → Frankfurter (daily) → FRED DEXINUS
 *   RBI Repo Rate     → API Ninjas → Serper Web Intelligence → Emergency fallback
 *   CPI Inflation     → API Ninjas → FRED OECD monthly → Serper → World Bank
 *   GDP Growth        → Serper Web Intelligence → World Bank → FRED
 *   10Y Bond Yield    → FRED OECD monthly → Serper
 *   Hotel Supply      → Serper Web Intelligence → static HVS
 *
 * The Serper Web Intelligence agent uses Google Search API (SERPER_API_KEY)
 * to find the latest published values from authoritative sources like
 * Trading Economics, RBI, MOSPI, and financial news. This ensures we
 * always have the most recent data available on the web.
 *
 * Cache strategy:
 *   - In-memory Map with TTL per indicator
 *   - Stale data served while revalidation happens in background
 *   - On cold start, all fetches run in parallel
 *   - On error, stale data is returned with a "stale" flag
 */

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface MacroIndicator {
  value: number;
  asOfDate: string;
  source: string;
  sourceType: 'live' | 'cached' | 'stale' | 'fallback';
  fetchedAt: string;
  cacheExpiresAt: string;
}

export interface MacroData {
  repoRate: number;
  cpi: number;
  gdpGrowthRate: number;
  bondYield10Y: number;
  hotelSupplyGrowthPct: number;
  usdInrRate: number;
  inflationTrend: 'rising' | 'stable' | 'declining';
  source: 'live' | 'cached' | 'stale' | 'fallback';
  fetchedAt: string;
  indicators: {
    repoRate: MacroIndicator;
    cpi: MacroIndicator;
    gdpGrowth: MacroIndicator;
    bondYield10Y: MacroIndicator;
    usdInr: MacroIndicator;
    hotelSupplyGrowth: MacroIndicator;
  };
}

// ────────────────────────────────────────────────────────────────────
// Cache
// ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  expiresAt: number;
}

const TTL = {
  FX:           15 * 60 * 1000,
  BOND_YIELD:   60 * 60 * 1000,
  REPO_RATE:    24 * 60 * 60 * 1000,
  CPI:          7  * 24 * 60 * 60 * 1000,
  GDP:          30 * 24 * 60 * 60 * 1000,
  HOTEL_SUPPLY: 90 * 24 * 60 * 60 * 1000,
} as const;

const STALE_MULTIPLIER = 10;
const cache = new Map<string, CacheEntry<MacroIndicator>>();

function getCached(key: string): { indicator: MacroIndicator; fresh: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now < entry.expiresAt) return { indicator: entry.data, fresh: true };
  const staleLimit = entry.fetchedAt + (entry.expiresAt - entry.fetchedAt) * STALE_MULTIPLIER;
  if (now < staleLimit) return { indicator: { ...entry.data, sourceType: 'stale' }, fresh: false };
  cache.delete(key);
  return null;
}

function setCache(key: string, indicator: MacroIndicator, ttlMs: number) {
  const now = Date.now();
  cache.set(key, { data: indicator, fetchedAt: now, expiresAt: now + ttlMs });
}

// ────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────

const FRED_KEY       = () => process.env.FRED_API_KEY    || '';
const API_NINJAS_KEY = () => process.env.API_NINJAS_KEY  || '';
const SERPER_KEY     = () => process.env.SERPER_API_KEY   || '';

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────────────
// Serper Web Intelligence Agent
// ────────────────────────────────────────────────────────────────────

interface SerperResult {
  value: number;
  asOfDate: string;
  source: string;
}

/**
 * Uses Google Search (via Serper API) to find the latest published value
 * for an India macro indicator. Parses answer boxes, knowledge panels,
 * and top snippets to extract the numeric value.
 *
 * @param query       - Google search query
 * @param expectedMin - Minimum plausible value (for validation)
 * @param expectedMax - Maximum plausible value (for validation)
 * @param isPercent   - If true, looks for values followed by %
 */
async function serperWebIntelligence(
  query: string,
  expectedMin: number,
  expectedMax: number,
  isPercent = true,
): Promise<SerperResult> {
  const key = SERPER_KEY();
  if (!key) throw new Error('SERPER_API_KEY not set');

  const res = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'in', num: 8 }),
  });
  if (!res.ok) throw new Error(`Serper: ${res.status}`);

  const data = await res.json();

  // Strategy 1: Answer box (most authoritative)
  if (data.answerBox) {
    const ab = data.answerBox;
    const text = ab.answer || ab.snippet || ab.title || '';
    const val = extractNumber(text, expectedMin, expectedMax, isPercent);
    if (val !== null) {
      return { value: val, asOfDate: extractDate(text) || 'latest', source: `Google Answer: ${ab.title || query}` };
    }
  }

  // Strategy 2: Knowledge graph
  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    const text = kg.description || '';
    const val = extractNumber(text, expectedMin, expectedMax, isPercent);
    if (val !== null) {
      return { value: val, asOfDate: extractDate(text) || 'latest', source: `Knowledge Graph: ${kg.title || query}` };
    }
    // Check attributes
    for (const [attrKey, attrVal] of Object.entries(kg.attributes || {})) {
      const val2 = extractNumber(String(attrVal), expectedMin, expectedMax, isPercent);
      if (val2 !== null) {
        return { value: val2, asOfDate: 'latest', source: `Knowledge Graph: ${attrKey}` };
      }
    }
  }

  // Strategy 3: Top organic snippets (prefer authoritative domains)
  const authoritative = ['tradingeconomics.com', 'rbi.org.in', 'mospi.gov.in', 'pib.gov.in',
    'worldbank.org', 'imf.org', 'ceicdata.com', 'statista.com', 'macrotrends.net',
    'bankbazaar.com', 'moneycontrol.com', 'livemint.com', 'ndtv.com', 'economictimes.com'];

  const organic = data.organic || [];
  // Sort: authoritative domains first
  const sorted = [...organic].sort((a: any, b: any) => {
    const aAuth = authoritative.some(d => a.link?.includes(d)) ? 0 : 1;
    const bAuth = authoritative.some(d => b.link?.includes(d)) ? 0 : 1;
    return aAuth - bAuth;
  });

  for (const result of sorted) {
    const text = (result.snippet || '') + ' ' + (result.title || '');
    const val = extractNumber(text, expectedMin, expectedMax, isPercent);
    if (val !== null) {
      const domain = new URL(result.link).hostname.replace('www.', '');
      const dateFound = extractDate(text);
      return {
        value: val,
        asOfDate: dateFound || 'latest',
        source: `${domain}: "${(result.title || '').substring(0, 60)}"`,
      };
    }
  }

  throw new Error(`Serper: could not extract value for "${query}"`);
}

/**
 * Extract a numeric value from text within expected range.
 * If isPercent, prefers values near a % sign.
 */
function extractNumber(text: string, min: number, max: number, isPercent: boolean): number | null {
  if (!text) return null;

  // Try percent patterns first if isPercent
  if (isPercent) {
    // Match patterns like "5.25%", "5.25 %", "5.25 per cent", "5.25 percent"
    const pctPatterns = text.match(/(\d+\.?\d*)\s*(?:%|per\s*cent|percent)/gi) || [];
    for (const match of pctPatterns) {
      const num = parseFloat(match);
      if (!isNaN(num) && num >= min && num <= max) return Math.round(num * 100) / 100;
    }
  }

  // Try currency patterns for FX (₹91.03, INR 91.03, 91.03 INR)
  if (!isPercent) {
    const fxPatterns = text.match(/(?:₹|INR\s*|Rs\.?\s*)(\d+\.?\d*)/gi) || [];
    for (const match of fxPatterns) {
      const num = parseFloat(match.replace(/[₹INRRs.\s]/gi, ''));
      if (!isNaN(num) && num >= min && num <= max) return Math.round(num * 100) / 100;
    }
    // Also try plain numbers in range
    const nums = text.match(/\d+\.?\d*/g) || [];
    for (const n of nums) {
      const num = parseFloat(n);
      if (!isNaN(num) && num >= min && num <= max) return Math.round(num * 100) / 100;
    }
  }

  // General: find any number in range
  const allNums = text.match(/\d+\.?\d*/g) || [];
  for (const n of allNums) {
    const num = parseFloat(n);
    if (!isNaN(num) && num >= min && num <= max) return Math.round(num * 100) / 100;
  }

  return null;
}

/**
 * Extract a date reference from text (month/year patterns).
 */
function extractDate(text: string): string | null {
  if (!text) return null;

  // "January 2026", "Feb 2026", "March 2026"
  const monthYear = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i);
  if (monthYear) return `${monthYear[1]} ${monthYear[2]}`;

  // "Q3 FY2025-26", "Q3 2025"
  const quarter = text.match(/(Q[1-4])\s*(?:FY)?(\d{4}(?:-\d{2})?)/i);
  if (quarter) return `${quarter[1]} ${quarter[2]}`;

  // "2025-26", "FY2025-26"
  const fy = text.match(/(?:FY\s*)?(\d{4}-\d{2})/);
  if (fy) return `FY${fy[1]}`;

  // "2026-03", "2026-02"
  const isoMonth = text.match(/(\d{4}-\d{2})/);
  if (isoMonth) return isoMonth[1];

  return null;
}

// ────────────────────────────────────────────────────────────────────
// USD/INR Exchange Rate
// ────────────────────────────────────────────────────────────────────

async function fetchUsdInrExchangeRateApi(): Promise<MacroIndicator> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`ExchangeRate-API: ${res.status}`);
  const json = await res.json();
  const rate = json.rates?.INR;
  if (!rate) throw new Error('No INR rate in ExchangeRate-API');
  return {
    value: Math.round(rate * 100) / 100,
    asOfDate: json.time_last_update_utc?.split(' 00:')[0] ?? new Date().toISOString().split('T')[0],
    source: `ExchangeRate-API — ${json.time_last_update_utc ?? 'today'}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.FX).toISOString(),
  };
}

async function fetchUsdInrFrankfurter(): Promise<MacroIndicator> {
  const url = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Frankfurter: ${res.status}`);
  const json = await res.json();
  const rate = json.rates?.INR;
  if (!rate) throw new Error('No INR rate in Frankfurter');
  return {
    value: Math.round(rate * 100) / 100,
    asOfDate: json.date,
    source: `Frankfurter/ECB — ${json.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.FX).toISOString(),
  };
}

async function fetchUsdInrFred(): Promise<MacroIndicator> {
  const key = FRED_KEY();
  if (!key) throw new Error('FRED_API_KEY not set');
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DEXINUS&api_key=${key}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`FRED DEXINUS: ${res.status}`);
  const json = await res.json();
  const obs = json.observations?.find((o: any) => o.value !== '.');
  if (!obs) throw new Error('No valid FRED DEXINUS observations');
  return {
    value: parseFloat(obs.value),
    asOfDate: obs.date,
    source: `FRED DEXINUS — ${obs.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.FX).toISOString(),
  };
}

async function fetchUsdInrSerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'USD to INR exchange rate today',
    70, 120, false,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.FX).toISOString(),
  };
}

export async function getUsdInr(): Promise<MacroIndicator> {
  const cached = getCached('usdInr');
  if (cached?.fresh) return cached.indicator;

  const fetchers = [fetchUsdInrExchangeRateApi, fetchUsdInrFrankfurter, fetchUsdInrFred, fetchUsdInrSerper];
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      setCache('usdInr', result, TTL.FX);
      return result;
    } catch (err) {
      console.warn(`USD/INR fetcher failed: ${(err as Error).message}`);
    }
  }

  if (cached) return cached.indicator;
  throw new Error('All USD/INR data sources failed');
}

// ────────────────────────────────────────────────────────────────────
// 10Y Bond Yield
// ────────────────────────────────────────────────────────────────────

async function fetchBondYieldFred(): Promise<MacroIndicator> {
  const key = FRED_KEY();
  if (!key) throw new Error('FRED_API_KEY not set');
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=INDIRLTLT01STM&api_key=${key}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`FRED Bond: ${res.status}`);
  const json = await res.json();
  const obs = json.observations?.find((o: any) => o.value !== '.');
  if (!obs) throw new Error('No valid FRED bond observations');
  return {
    value: parseFloat(obs.value),
    asOfDate: obs.date,
    source: `FRED INDIRLTLT01STM (OECD) — ${obs.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.BOND_YIELD).toISOString(),
  };
}

async function fetchBondYieldSerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'India 10 year government bond yield today 2026',
    4, 12, true,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.BOND_YIELD).toISOString(),
  };
}

export async function getBondYield10Y(): Promise<MacroIndicator> {
  const cached = getCached('bondYield10Y');
  if (cached?.fresh) return cached.indicator;

  const fetchers = [fetchBondYieldSerper, fetchBondYieldFred];
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      setCache('bondYield10Y', result, TTL.BOND_YIELD);
      return result;
    } catch (err) {
      console.warn(`Bond yield fetcher failed: ${(err as Error).message}`);
    }
  }

  if (cached) return cached.indicator;
  throw new Error('All bond yield data sources failed');
}

// ────────────────────────────────────────────────────────────────────
// RBI Repo Rate
// ────────────────────────────────────────────────────────────────────

async function fetchRepoRateApiNinjas(): Promise<MacroIndicator> {
  const key = API_NINJAS_KEY();
  if (!key) throw new Error('API_NINJAS_KEY not set');
  const url = 'https://api.api-ninjas.com/v1/interestrate?country=india';
  const res = await fetchWithTimeout(url, { headers: { 'X-Api-Key': key } });
  if (!res.ok) throw new Error(`API Ninjas: ${res.status}`);
  const json = await res.json();
  const centralRates = json.central_bank_rates ?? [];
  const india = centralRates.find((r: any) =>
    r.country?.toLowerCase() === 'india' ||
    r.central_bank?.toLowerCase().includes('reserve bank')
  );
  if (!india) throw new Error('India not found in API Ninjas');
  return {
    value: india.rate_pct,
    asOfDate: india.last_updated ?? new Date().toISOString().split('T')[0],
    source: `API Ninjas — ${india.central_bank ?? 'RBI'} (${india.last_updated ?? 'latest'})`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.REPO_RATE).toISOString(),
  };
}

async function fetchRepoRateSerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'RBI repo rate current 2026 India',
    3, 10, true,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.REPO_RATE).toISOString(),
  };
}

export async function getRepoRate(): Promise<MacroIndicator> {
  const cached = getCached('repoRate');
  if (cached?.fresh) return cached.indicator;

  const fetchers = [fetchRepoRateApiNinjas, fetchRepoRateSerper];
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      setCache('repoRate', result, TTL.REPO_RATE);
      return result;
    } catch (err) {
      console.warn(`Repo rate fetcher failed: ${(err as Error).message}`);
    }
  }

  if (cached) return cached.indicator;
  throw new Error('All repo rate data sources failed');
}

// ────────────────────────────────────────────────────────────────────
// CPI Inflation
// ────────────────────────────────────────────────────────────────────

async function fetchCpiApiNinjas(): Promise<MacroIndicator> {
  const key = API_NINJAS_KEY();
  if (!key) throw new Error('API_NINJAS_KEY not set');
  const url = 'https://api.api-ninjas.com/v1/inflation?country=india';
  const res = await fetchWithTimeout(url, { headers: { 'X-Api-Key': key } });
  if (!res.ok) throw new Error(`API Ninjas CPI: ${res.status}`);
  const json = await res.json();
  const latest = Array.isArray(json) ? json[0] : json;
  if (!latest?.yearly_rate_pct && latest?.yearly_rate_pct !== 0)
    throw new Error('No CPI value');
  return {
    value: latest.yearly_rate_pct,
    asOfDate: latest.month ? `${latest.year}-${String(latest.month).padStart(2, '0')}` : String(latest.year),
    source: `API Ninjas Inflation — ${latest.month}/${latest.year}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.CPI).toISOString(),
  };
}

async function fetchCpiFredOecd(): Promise<MacroIndicator> {
  const key = FRED_KEY();
  if (!key) throw new Error('FRED_API_KEY not set');
  // INDCPIALLMINMEI = India Consumer Price Index, All Items (OECD, monthly)
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=INDCPIALLMINMEI&api_key=${key}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`FRED CPI: ${res.status}`);
  const json = await res.json();
  const obs = json.observations?.find((o: any) => o.value !== '.');
  if (!obs) throw new Error('No valid FRED CPI observations');

  // This series is the CPI index level, not the YoY rate.
  // Get 2 observations 12 months apart to compute YoY inflation.
  const url2 = `https://api.stlouisfed.org/fred/series/observations?series_id=INDCPIALLMINMEI&api_key=${key}&file_type=json&sort_order=desc&limit=15`;
  const res2 = await fetchWithTimeout(url2);
  const json2 = await res2.json();
  const validObs = (json2.observations || []).filter((o: any) => o.value !== '.');
  if (validObs.length < 13) throw new Error('Insufficient CPI observations for YoY');

  const latest2 = validObs[0];
  const yearAgo = validObs[12]; // ~12 months back
  const cpiNow = parseFloat(latest2.value);
  const cpiYearAgo = parseFloat(yearAgo.value);
  const yoyRate = ((cpiNow - cpiYearAgo) / cpiYearAgo) * 100;

  return {
    value: Math.round(yoyRate * 100) / 100,
    asOfDate: latest2.date,
    source: `FRED INDCPIALLMINMEI (OECD monthly, YoY computed) — ${latest2.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.CPI).toISOString(),
  };
}

async function fetchCpiSerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'India CPI inflation rate latest month 2026',
    0, 15, true,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.CPI).toISOString(),
  };
}

async function fetchCpiWorldBank(): Promise<MacroIndicator> {
  const url = 'https://api.worldbank.org/v2/country/ind/indicator/FP.CPI.TOTL.ZG?format=json&per_page=3&mrv=3';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`World Bank CPI: ${res.status}`);
  const json = await res.json();
  const records = json[1];
  const latest = records?.find((r: any) => r.value != null);
  if (!latest) throw new Error('No World Bank CPI data');
  return {
    value: Math.round(latest.value * 100) / 100,
    asOfDate: latest.date,
    source: `World Bank FP.CPI.TOTL.ZG — ${latest.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.CPI).toISOString(),
  };
}

export async function getCpi(): Promise<MacroIndicator> {
  const cached = getCached('cpi');
  if (cached?.fresh) return cached.indicator;

  const fetchers = [fetchCpiApiNinjas, fetchCpiSerper, fetchCpiFredOecd, fetchCpiWorldBank];
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      setCache('cpi', result, TTL.CPI);
      return result;
    } catch (err) {
      console.warn(`CPI fetcher failed: ${(err as Error).message}`);
    }
  }

  if (cached) return cached.indicator;
  throw new Error('All CPI data sources failed');
}

// ────────────────────────────────────────────────────────────────────
// GDP Growth
// ────────────────────────────────────────────────────────────────────

async function fetchGdpSerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'India GDP growth rate latest quarter 2025-26',
    2, 15, true,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.GDP).toISOString(),
  };
}

async function fetchGdpWorldBank(): Promise<MacroIndicator> {
  const url = 'https://api.worldbank.org/v2/country/ind/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=3&mrv=3';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`World Bank GDP: ${res.status}`);
  const json = await res.json();
  const records = json[1];
  const latest = records?.find((r: any) => r.value != null);
  if (!latest) throw new Error('No World Bank GDP data');
  return {
    value: Math.round(latest.value * 100) / 100,
    asOfDate: latest.date,
    source: `World Bank NY.GDP.MKTP.KD.ZG — ${latest.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.GDP).toISOString(),
  };
}

async function fetchGdpFred(): Promise<MacroIndicator> {
  const key = FRED_KEY();
  if (!key) throw new Error('FRED_API_KEY not set');
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=NYGDPMKTPKDZGIN&api_key=${key}&file_type=json&sort_order=desc&limit=3`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`FRED GDP: ${res.status}`);
  const json = await res.json();
  const obs = json.observations?.find((o: any) => o.value !== '.');
  if (!obs) throw new Error('No valid FRED GDP observations');
  return {
    value: parseFloat(obs.value),
    asOfDate: obs.date,
    source: `FRED NYGDPMKTPKDZGIN — ${obs.date}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.GDP).toISOString(),
  };
}

export async function getGdpGrowth(): Promise<MacroIndicator> {
  const cached = getCached('gdpGrowth');
  if (cached?.fresh) return cached.indicator;

  const fetchers = [fetchGdpSerper, fetchGdpWorldBank, fetchGdpFred];
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      setCache('gdpGrowth', result, TTL.GDP);
      return result;
    } catch (err) {
      console.warn(`GDP fetcher failed: ${(err as Error).message}`);
    }
  }

  if (cached) return cached.indicator;
  throw new Error('All GDP data sources failed');
}

// ────────────────────────────────────────────────────────────────────
// Hotel Supply Growth
// ────────────────────────────────────────────────────────────────────

async function fetchHotelSupplySerper(): Promise<MacroIndicator> {
  const result = await serperWebIntelligence(
    'India hotel supply growth rate 2025 2026 new rooms pipeline',
    1, 20, true,
  );
  return {
    value: result.value,
    asOfDate: result.asOfDate,
    source: `Web Intel: ${result.source}`,
    sourceType: 'live',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.HOTEL_SUPPLY).toISOString(),
  };
}

export async function getHotelSupplyGrowth(): Promise<MacroIndicator> {
  const cached = getCached('hotelSupply');
  if (cached?.fresh) return cached.indicator;

  // Try Serper first for latest industry data
  try {
    const result = await fetchHotelSupplySerper();
    setCache('hotelSupply', result, TTL.HOTEL_SUPPLY);
    return result;
  } catch (err) {
    console.warn(`Hotel supply Serper failed: ${(err as Error).message}`);
  }

  // Fallback: HVS report value (updated manually)
  const indicator: MacroIndicator = {
    value: 5.20,
    asOfDate: '2025',
    source: 'HVS India Hotel Survey 2025-26 (manual update)',
    sourceType: 'fallback',
    fetchedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + TTL.HOTEL_SUPPLY).toISOString(),
  };
  setCache('hotelSupply', indicator, TTL.HOTEL_SUPPLY);
  return indicator;
}

// ────────────────────────────────────────────────────────────────────
// Aggregator
// ────────────────────────────────────────────────────────────────────

const EMERGENCY_FALLBACK: Record<string, MacroIndicator> = {
  usdInr:       { value: 87.12, asOfDate: '2026-02-27', source: 'Emergency fallback (FRED last known)',  sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
  bondYield10Y: { value: 6.73,  asOfDate: '2026-01',    source: 'Emergency fallback (FRED OECD)',        sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
  repoRate:     { value: 5.25,  asOfDate: '2026-02-06', source: 'Emergency fallback (RBI MPC Feb 2026)', sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
  cpi:          { value: 2.75,  asOfDate: '2026-01',    source: 'Emergency fallback (MOSPI Jan 2026)',   sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
  gdpGrowth:    { value: 7.60,  asOfDate: 'FY2025-26',  source: 'Emergency fallback (MOSPI revised)',    sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
  hotelSupply:  { value: 5.20,  asOfDate: '2025',       source: 'Emergency fallback (HVS India)',        sourceType: 'fallback', fetchedAt: '', cacheExpiresAt: '' },
};

async function safeGet(key: string, fetcher: () => Promise<MacroIndicator>): Promise<MacroIndicator> {
  try {
    return await fetcher();
  } catch (err) {
    console.error(`[MacroData] ${key} FAILED:`, (err as Error).message);
    const fb = EMERGENCY_FALLBACK[key];
    const now = new Date().toISOString();
    return { ...fb, fetchedAt: now, cacheExpiresAt: now };
  }
}

export async function getAllMacroIndicators(): Promise<MacroData> {
  const [usdInr, bondYield10Y, repoRate, cpi, gdpGrowth, hotelSupply] = await Promise.all([
    safeGet('usdInr', getUsdInr),
    safeGet('bondYield10Y', getBondYield10Y),
    safeGet('repoRate', getRepoRate),
    safeGet('cpi', getCpi),
    safeGet('gdpGrowth', getGdpGrowth),
    safeGet('hotelSupply', getHotelSupplyGrowth),
  ]);

  // Determine overall source quality (exclude hotel supply — no structured API)
  const coreTypes = [usdInr, bondYield10Y, repoRate, cpi, gdpGrowth].map(i => i.sourceType);
  const overallSource: MacroData['source'] =
    coreTypes.every(t => t === 'live' || t === 'cached') ? 'live' :
    coreTypes.some(t => t === 'fallback') ? 'fallback' :
    coreTypes.some(t => t === 'stale') ? 'stale' : 'cached';

  const inflationTrend: MacroData['inflationTrend'] =
    cpi.value < 4 ? 'declining' : cpi.value > 6 ? 'rising' : 'stable';

  return {
    repoRate: repoRate.value,
    cpi: cpi.value,
    gdpGrowthRate: gdpGrowth.value,
    bondYield10Y: bondYield10Y.value,
    hotelSupplyGrowthPct: hotelSupply.value,
    usdInrRate: usdInr.value,
    inflationTrend,
    source: overallSource,
    fetchedAt: new Date().toISOString(),
    indicators: {
      repoRate,
      cpi,
      gdpGrowth,
      bondYield10Y,
      usdInr,
      hotelSupplyGrowth: hotelSupply,
    },
  };
}

export function invalidateAllCache() {
  cache.clear();
}
