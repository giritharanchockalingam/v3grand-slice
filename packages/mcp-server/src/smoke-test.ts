#!/usr/bin/env node
/**
 * Phase 1 smoke-test: run MCP tool handlers in-process (no stdio/server).
 * Exercises all market tools and, when DATABASE_URL is set, deal/engine/validation tools.
 *
 * Tools covered:
 *   Market: get_macro_indicators, get_city_profile, get_demand_signals, get_construction_costs, market_health
 *   Deals:  list_deals, get_deal, get_deal_dashboard
 *   Engines: run_factor, run_montecarlo, run_budget, run_scurve
 *   Validation: get_validation_models, get_validation_model_card, run_stress_test, run_reverse_stress_test,
 *               run_sensitivity, verify_hash_chain, get_compliance_controls
 *
 * Usage (from repo root):
 *   pnpm --filter @v3grand/mcp-server run smoke   # use pnpm (this repo)
 *   ./scripts/smoke-test-mcp.sh
 * Or from package:
 *   cd packages/mcp-server && pnpm run smoke
 *   cd packages/mcp-server && npm run smoke       # npm has no --filter; run from package dir
 *
 * Requires: .env with optional DATABASE_URL (and DATABASE_SCHEMA) for deal/engine/validation tools.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createMarketDataService } from '@v3grand/mcp';
import { registerMarketTools } from './tools/market.js';
import { registerDealTools } from './tools/deals.js';
import { registerEngineTools } from './tools/engines.js';
import { registerValidationTools } from './tools/validation.js';

type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

function createToolRunner(): {
  registerTool: (name: string, schema: z.ZodType, handler: ToolHandler) => void;
  invoke: (name: string, args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
  toolNames: () => string[];
} {
  const tools = new Map<string, { handler: ToolHandler }>();
  return {
    registerTool(name: string, _schema: z.ZodType, handler: ToolHandler) {
      tools.set(name, { handler });
    },
    async invoke(name: string, args: unknown) {
      const t = tools.get(name);
      if (!t) throw new Error(`Unknown tool: ${name}`);
      return t.handler(args);
    },
    toolNames: () => [...tools.keys()],
  };
}

function assertContent(res: { content: Array<{ type: 'text'; text: string }> }, toolName: string): void {
  if (!Array.isArray(res.content) || res.content.length === 0) {
    throw new Error(`${toolName}: expected content[] with at least one item, got ${JSON.stringify(res)}`);
  }
  const first = res.content[0];
  if (first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error(`${toolName}: expected content[0].type='text' and .text string, got ${JSON.stringify(first)}`);
  }
}

/** Parse deal list from list_deals tool result (content may include JSON data). */
function parseDealIdFromListDeals(res: { content: Array<{ type: 'text'; text: string }> }): string | null {
  for (const c of res.content) {
    if (c.type === 'text' && c.text) {
      try {
        const data = JSON.parse(c.text) as { deals?: Array<{ id: string }> };
        if (Array.isArray(data.deals) && data.deals.length > 0 && data.deals[0].id) {
          return data.deals[0].id;
        }
      } catch {
        // not JSON or different shape
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const databaseSchema = process.env.DATABASE_SCHEMA ?? '';

  const marketService = createMarketDataService({
    rbiApiKey: process.env.RBI_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY,
    fallbackMode: (process.env.MCP_FALLBACK_MODE ?? 'true') === 'true',
    cacheTtlSeconds: Number(process.env.MCP_CACHE_TTL ?? 604800),
  });

  const runner = createToolRunner();
  registerMarketTools(runner, marketService);

  let db: PostgresJsDatabase | null = null;
  if (databaseUrl) {
    const isSupabase = databaseUrl.includes('supabase.co');
    const sql = postgres(databaseUrl, {
      ...(isSupabase ? { ssl: 'require' } : {}),
      ...(databaseSchema ? { connection: { search_path: databaseSchema } } : {}),
    });
    db = drizzle(sql);
    registerDealTools(runner, db);
    registerEngineTools(runner, db);
    registerValidationTools(runner, db);
  }

  const hasDb = !!db;

  type TestCase = { name: string; args: unknown; optional?: boolean };
  const cases: TestCase[] = [];

  // ─── Market (always) ───
  cases.push({ name: 'get_macro_indicators', args: {} });
  cases.push({ name: 'get_city_profile', args: { city: 'Mumbai' } });
  cases.push({ name: 'get_demand_signals', args: { city: 'Mumbai' } });
  cases.push({ name: 'get_construction_costs', args: {} });
  cases.push({ name: 'market_health', args: {} });

  let dealId: string | null = null;
  if (hasDb) {
    cases.push({ name: 'list_deals', args: { limit: 10 } });
    cases.push({ name: 'get_validation_models', args: {} });
    cases.push({ name: 'get_validation_model_card', args: { modelId: 'factor' } });
    cases.push({ name: 'get_compliance_controls', args: {} });
    // get_deal with non-existent id (expect DEAL_NOT_FOUND)
    cases.push({ name: 'get_deal', args: { dealId: '00000000-0000-0000-0000-000000000000' } });
  }

  console.log('MCP Phase 1 smoke-test (in-process)');
  console.log('Tools registered:', runner.toolNames().length);
  console.log('DB:', hasDb ? 'connected' : 'not set (market only)');
  console.log('');

  let failed = 0;
  for (const { name, args, optional } of cases) {
    try {
      const res = await runner.invoke(name, args);
      assertContent(res, name);
      if (name === 'list_deals') dealId = parseDealIdFromListDeals(res);
      if (name === 'get_deal' && res.content[0].text.includes('DEAL_NOT_FOUND')) {
        console.log(`  OK ${name} (expected not found)`);
      } else {
        console.log(`  OK ${name}`);
      }
    } catch (e) {
      if (optional) {
        console.log(`  SKIP ${name} (optional): ${e instanceof Error ? e.message : e}`);
      } else {
        console.error(`  FAIL ${name}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }
  }

  // ─── Deal-dependent tools (only when we have a real dealId) ───
  if (hasDb && dealId) {
    const dealCases: TestCase[] = [
      { name: 'get_deal', args: { dealId } },
      { name: 'get_deal_dashboard', args: { dealId } },
      { name: 'run_factor', args: { dealId } },
      { name: 'run_montecarlo', args: { dealId, iterations: 500 } },
      { name: 'run_budget', args: { dealId } },
      { name: 'run_scurve', args: { dealId, totalMonths: 24 } },
      { name: 'run_stress_test', args: { dealId } },
      { name: 'run_reverse_stress_test', args: { dealId } },
      { name: 'run_sensitivity', args: { dealId, parameter: 'occupancy', min: 0.5, max: 0.9, steps: 5 } },
      { name: 'verify_hash_chain', args: { dealId, engine: 'factor' } },
    ];
    for (const { name, args } of dealCases) {
      try {
        const res = await runner.invoke(name, args);
        assertContent(res, name);
        console.log(`  OK ${name}`);
      } catch (e) {
        console.error(`  FAIL ${name}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }
  } else if (hasDb) {
    console.log('  (no deals in DB — skipping get_deal, get_deal_dashboard, run_*, verify_hash_chain)');
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} tool(s) failed.`);
    process.exit(1);
  }
  console.log('All tools returned valid content.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke-test error:', err);
  process.exit(1);
});
