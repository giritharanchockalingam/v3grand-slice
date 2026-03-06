// ─── MCP Tools: Web search for real-time market intelligence ──────────
// Gives agents the ability to search the web for current data:
// - Real hotel rates, occupancy data, competitive set
// - Current regulatory updates, RERA filings
// - Live cap rates, transaction comps
// - Tax law changes, GST council decisions
// - ESG standards, green building certifications
// - Insurance market rates
// - Construction cost indices

import { z } from 'zod';

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ): void;
};

/**
 * Brave Search API integration for real-time market intelligence.
 * Falls back to a structured "no results" response if API key is missing.
 */
async function braveSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string; age?: string }>;
  source: 'brave-api' | 'unavailable';
}> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return {
      results: [],
      source: 'unavailable',
    };
  }

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

    if (!response.ok) {
      console.error(`Brave Search API error: ${response.status}`);
      return { results: [], source: 'unavailable' };
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title?: string;
          url?: string;
          description?: string;
          age?: string;
        }>;
      };
    };

    const results = (data.web?.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      description: r.description ?? '',
      age: r.age,
    }));

    return { results, source: 'brave-api' };
  } catch (err) {
    console.error('Brave Search failed:', err instanceof Error ? err.message : err);
    return { results: [], source: 'unavailable' };
  }
}

/**
 * SerpAPI / Google Search fallback for when Brave is unavailable.
 * Uses the free tier (100 searches/month).
 */
async function serpApiSearch(query: string, count = 5): Promise<{
  results: Array<{ title: string; url: string; description: string }>;
  source: 'serpapi' | 'unavailable';
}> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return { results: [], source: 'unavailable' };
  }

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${count}&api_key=${apiKey}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { results: [], source: 'unavailable' };

    const data = await response.json() as {
      organic_results?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    };

    const results = (data.organic_results ?? []).slice(0, count).map((r) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      description: r.snippet ?? '',
    }));

    return { results, source: 'serpapi' };
  } catch {
    return { results: [], source: 'unavailable' };
  }
}

export function registerWebSearchTools(
  server: Server,
): void {

  // ── web_search: General-purpose web search for real-time data ──
  server.registerTool(
    'web_search',
    z.object({
      query: z.string().min(3).max(500).describe(
        'Search query. Be specific and include location, year, and data type. ' +
        'Examples: "Goa hotel ADR occupancy rate 2025 2026", ' +
        '"RERA Goa registered projects 2026", ' +
        '"India hotel cap rate transaction 2025"'
      ),
      count: z.number().int().min(1).max(10).optional().describe('Number of results (default 5)'),
    }).describe(
      'Search the web for real-time market data, regulatory updates, competitive intelligence, ' +
      'and current industry benchmarks. Use this to verify and supplement internal data with ' +
      'live sources. Always cite the source URL in your analysis.'
    ),
    async (args) => {
      const { query, count = 5 } = args as { query: string; count?: number };

      // Try Brave first, then SerpAPI
      let searchResult = await braveSearch(query, count);
      let source = searchResult.source;

      if (searchResult.results.length === 0) {
        const serpResult = await serpApiSearch(query, count);
        if (serpResult.results.length > 0) {
          searchResult = { results: serpResult.results.map(r => ({ ...r, age: undefined })), source: 'brave-api' };
          source = serpResult.source as any;
        }
      }

      if (searchResult.results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query,
              results: [],
              source: 'unavailable',
              note: 'Web search is not available. No BRAVE_SEARCH_API_KEY or SERP_API_KEY configured. ' +
                    'Proceed with internal data and clearly state that web verification was not possible.',
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
            source,
            fetchedAt: new Date().toISOString(),
            note: 'These are real-time web results. Cite specific URLs when referencing this data.',
          }, null, 2),
        }],
      };
    },
  );

  // ── search_hotel_market: Specialized hotel market search ──
  server.registerTool(
    'search_hotel_market',
    z.object({
      city: z.string().min(2).describe('City name, e.g. Goa, Mumbai, Jaipur'),
      starRating: z.number().int().min(3).max(7).optional().describe('Hotel star rating'),
      metric: z.enum(['adr', 'occupancy', 'revpar', 'supply', 'demand', 'cap_rate', 'transaction']).describe(
        'What metric to search for'
      ),
    }).describe(
      'Search for specific hotel market metrics in a city. Returns real-time web results ' +
      'about hotel performance data, market transactions, and industry benchmarks.'
    ),
    async (args) => {
      const { city, starRating, metric } = args as { city: string; starRating?: number; metric: string };

      const metricQueries: Record<string, string> = {
        adr: `${city} hotel average daily rate ADR ${starRating ? starRating + '-star' : ''} 2025 2026 India`,
        occupancy: `${city} hotel occupancy rate percentage ${starRating ? starRating + '-star' : ''} 2025 2026`,
        revpar: `${city} hotel RevPAR revenue per available room 2025 2026`,
        supply: `${city} new hotel supply pipeline upcoming hotels ${starRating ? starRating + '-star' : ''} 2025 2026`,
        demand: `${city} hotel demand tourism growth arrivals 2025 2026`,
        cap_rate: `India hotel cap rate ${city} hospitality transaction yield 2025`,
        transaction: `India hotel acquisition sale transaction ${city} 2024 2025 price per key`,
      };

      const query = metricQueries[metric] ?? `${city} hotel ${metric} 2025 2026`;

      let searchResult = await braveSearch(query, 5);
      if (searchResult.results.length === 0) {
        const serpResult = await serpApiSearch(query, 5);
        if (serpResult.results.length > 0) {
          searchResult = { results: serpResult.results.map(r => ({ ...r, age: undefined })), source: 'brave-api' };
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            city,
            metric,
            starRating,
            results: searchResult.results,
            source: searchResult.source,
            fetchedAt: new Date().toISOString(),
            note: searchResult.results.length > 0
              ? 'Real-time hotel market data from web search. Cite URLs when referencing.'
              : 'No web search results available. Use internal benchmarks and clearly disclose they are estimates.',
          }, null, 2),
        }],
      };
    },
  );

  // ── search_regulatory: Specialized regulatory/legal search ──
  server.registerTool(
    'search_regulatory',
    z.object({
      state: z.string().min(2).describe('Indian state, e.g. Goa, Maharashtra'),
      topic: z.enum(['rera', 'zoning', 'environmental', 'tax', 'licensing', 'labor']).describe('Regulatory topic'),
    }).describe(
      'Search for current regulatory requirements, recent policy changes, and compliance ' +
      'updates for a specific Indian state. Returns real-time web results from government ' +
      'and legal sources.'
    ),
    async (args) => {
      const { state, topic } = args as { state: string; topic: string };

      const topicQueries: Record<string, string> = {
        rera: `${state} RERA real estate regulation 2025 2026 latest rules`,
        zoning: `${state} zoning regulation hotel hospitality FSI FAR 2025 2026`,
        environmental: `${state} environmental clearance CRZ hotel construction 2025 2026`,
        tax: `${state} GST hotel hospitality tax rate 2025 2026 India`,
        licensing: `${state} hotel license requirements tourism department 2025 2026`,
        labor: `${state} labor law hotel hospitality minimum wage 2025 2026`,
      };

      const query = topicQueries[topic] ?? `${state} ${topic} regulation 2025 2026`;

      let searchResult = await braveSearch(query, 5);
      if (searchResult.results.length === 0) {
        const serpResult = await serpApiSearch(query, 5);
        if (serpResult.results.length > 0) {
          searchResult = { results: serpResult.results.map(r => ({ ...r, age: undefined })), source: 'brave-api' };
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            state,
            topic,
            results: searchResult.results,
            source: searchResult.source,
            fetchedAt: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );
}
