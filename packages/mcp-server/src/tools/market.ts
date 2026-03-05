// ─── MCP Tools: Market data (wraps @v3grand/mcp MarketDataService) ─────
import type { MarketDataService } from '@v3grand/mcp';
import { z } from 'zod';

/** Register market tools on an MCP server. Server must have registerTool(name, inputSchema, handler). */
export function registerMarketTools(
  server: {
    registerTool(
      name: string,
      inputSchema: z.ZodType,
      handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
    ): void;
  },
  marketService: MarketDataService,
): void {
  server.registerTool(
    'get_macro_indicators',
    z.object({}),
    async () => {
      const data = await marketService.getMacroIndicators();
      const stats = marketService.getCacheStats();
      return {
        content: [{ type: 'text', text: JSON.stringify({ data, cacheStats: stats }, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_city_profile',
    z.object({ city: z.string().min(2).describe('City name, e.g. Mumbai, Chennai') }),
    async (args) => {
      const { city } = args as { city: string };
      const data = await marketService.getCityProfile(city);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_demand_signals',
    z.object({ city: z.string().min(2).describe('City name') }),
    async (args) => {
      const { city } = args as { city: string };
      const data = await marketService.getDemandSignals(city);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_construction_costs',
    z.object({}),
    async () => {
      const data = await marketService.getConstructionCostTrend();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    'market_health',
    z.object({}),
    async () => {
      const health = await marketService.healthCheck();
      const stats = marketService.getCacheStats();
      return {
        content: [{ type: 'text', text: JSON.stringify({ sources: health, cache: stats }, null, 2) }],
      };
    },
  );

  // ── Canonical answer for "What are market intel factors and why are they considered?" (HMS-style structured tiles)
  server.registerTool(
    'get_market_intel_factors',
    z.object({}).describe('Returns the list of market intel factors and why they are considered. Use when the user asks about market intel factors, market indicators, or why they matter.') as z.ZodType<Record<string, never>>,
    async () => {
      const tiles: Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }> = [
        {
          type: 'section',
          title: 'Market intel factors',
          body: "Market intel factors are the macro and city-level indicators used by the platform to ground underwriting and the Factor engine in the most accurate source of truth for the investment's geography (e.g. India and the deal's city).",
        },
        {
          type: 'list',
          title: 'India macro indicators (country-level)',
          items: [
            'RBI Repo Rate — Cost of funds, risk-free rate context (source: RBI MPC / DBIE).',
            'CPI Inflation — Real returns, indexation (source: MOSPI / data.gov.in).',
            'GDP Growth — Macro growth assumption (source: World Bank / MOSPI).',
            '10Y Bond Yield — Discount rate, WACC, risk-free benchmark (source: FRED / CCIL).',
            'USD/INR — FX risk, international capital (source: FRED / Open Exchange).',
            'Hotel Supply Growth — Sector supply for hospitality deals (source: HVS / JLL or curated estimate).',
          ],
        },
        {
          type: 'list',
          title: 'City demand profile (deal location)',
          items: [
            'Airport passengers — Demand proxy (source: data.gov.in / AAI).',
            'Domestic / foreign tourists — Tourism demand (source: Ministry of Tourism / data.gov.in).',
            'Housing Price Index — Real estate and collateral context (source: RBI HPI / data.gov.in).',
          ],
        },
        {
          type: 'list',
          title: 'Why they are considered',
          items: [
            'They feed the Factor engine and underwriter (WACC, discount rates, growth assumptions).',
            'The Composite Demand Score (0–100), from tourism growth, air traffic growth, and GDP growth, contributes to the recommendation (Invest / Hold / De-risk / Exit).',
            'Partners use Market Intelligence to verify that every input comes from the correct source of truth for the investment\'s geography (Big 4–grade practice).',
          ],
        },
      ];
      const text = tiles
        .map((t) => (t.title ? `## ${t.title}\n\n` : '') + (t.body ?? '') + (t.items ? '\n' + t.items.map((i) => `- ${i}`).join('\n') : ''))
        .join('\n\n');
      return {
        content: [
          { type: 'text' as const, text },
          { type: 'data' as const, data: { tiles } },
        ] as Array<{ type: 'text'; text: string }>,
      };
    },
  );

  // ── Canonical answer for "WACC and hurdle rate" (HMS-style structured tiles)
  server.registerTool(
    'get_wacc_hurdle_explainer',
    z.object({}).describe('Explains WACC and hurdle rate. Use when the user asks about WACC, hurdle rate, or discount rate.') as z.ZodType<Record<string, never>>,
    async () => {
      const tiles: Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }> = [
        {
          type: 'section',
          title: 'WACC and hurdle rate',
          body: 'WACC (Weighted Average Cost of Capital) is the discount rate used to value cash flows and compute NPV. The hurdle rate is the minimum return required to approve an investment; in this portal it is typically WACC or target IRR from deal assumptions.',
        },
        {
          type: 'list',
          title: 'How WACC is used here',
          items: [
            'NPV is computed by discounting free cash flows at WACC.',
            'Target IRR and target DSCR in Financial Assumptions are the main hurdle criteria for investment gates.',
            'The Feasibility and IC memo show WACC and hurdle so partners can verify consistency.',
          ],
        },
        {
          type: 'list',
          title: 'Formula (plain text)',
          items: [
            'WACC = (cost of equity × E/(D+E)) + (after-tax cost of debt × D/(D+E)).',
            'Deal-level WACC is set in Assumptions; it drives the hurdle used for NPV and IRR checks.',
          ],
        },
      ];
      const text = tiles
        .map((t) => (t.title ? `## ${t.title}\n\n` : '') + (t.body ?? '') + (t.items ? '\n' + t.items.map((i) => `- ${i}`).join('\n') : ''))
        .join('\n\n');
      return {
        content: [
          { type: 'text' as const, text },
          { type: 'data' as const, data: { tiles } },
        ] as Array<{ type: 'text'; text: string }>,
      };
    },
  );

  // ── Canonical answer for "How EBITDA is used here" (HMS-style structured tiles)
  server.registerTool(
    'get_ebitda_explainer',
    z.object({}).describe('Explains how EBITDA is used in the portal. Use when the user asks about EBITDA, GOP, or operating profit.') as z.ZodType<Record<string, never>>,
    async () => {
      const tiles: Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }> = [
        {
          type: 'section',
          title: 'EBITDA in this portal',
          body: 'EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization) is derived from the underwriter pro forma: GOP (Gross Operating Profit) minus management fee, incentive fee, and FF&E reserve. It drives debt service coverage (DSCR) and exit valuation.',
        },
        {
          type: 'list',
          title: 'Where it appears',
          items: [
            'Deal dashboard and 10-year pro forma show EBITDA by year.',
            'DSCR = EBITDA / debt service; target DSCR is a key investment gate.',
            'Exit value = final-year EBITDA × exit multiple (from assumptions).',
          ],
        },
        {
          type: 'list',
          title: 'Related terms',
          items: [
            'GOP — Gross Operating Profit (revenue minus departmental costs).',
            'FF&E reserve — Furniture, Fixtures & Equipment reserve (from revenue).',
            'FCFE — Free Cash Flow to Equity (after debt service and tax); used for IRR.',
          ],
        },
      ];
      const text = tiles
        .map((t) => (t.title ? `## ${t.title}\n\n` : '') + (t.body ?? '') + (t.items ? '\n' + t.items.map((i) => `- ${i}`).join('\n') : ''))
        .join('\n\n');
      return {
        content: [
          { type: 'text' as const, text },
          { type: 'data' as const, data: { tiles } },
        ] as Array<{ type: 'text'; text: string }>,
      };
    },
  );
}
