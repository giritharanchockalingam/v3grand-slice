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
}
