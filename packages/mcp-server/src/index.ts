// ─── V3 Grand MCP Server ─────────────────────────────────────────────
// Exposes market data, deals, engines, and validation as MCP tools for AI clients
// (Cursor, Claude Desktop, or a custom agent). Run with: pnpm start
//
// stdio transport: for Cursor/Claude, configure in mcp.json:
//   "v3grand": { "command": "pnpm", "args": ["--filter", "@v3grand/mcp-server", "start"], "cwd": "/path/to/repo" }
//
// Requires DATABASE_URL (and optionally DATABASE_SCHEMA, e.g. v3grand) for deal/engine/validation tools.
// Without DATABASE_URL, only market tools are registered.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// MCP SDK: use server subpath if available (SDK 1.27+)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SDK = await import('@modelcontextprotocol/sdk');
const McpServer = (SDK as any).McpServer ?? (SDK as any).Server;
const StdioServerTransport = (SDK as any).StdioServerTransport;

if (!McpServer || !StdioServerTransport) {
  console.error('MCP SDK missing McpServer or StdioServerTransport. Check @modelcontextprotocol/sdk exports.');
  process.exit(1);
}

import { createMarketDataService } from '@v3grand/mcp';
import { registerMarketTools } from './tools/market.js';
import { registerDealTools } from './tools/deals.js';
import { registerEngineTools } from './tools/engines.js';
import { registerValidationTools } from './tools/validation.js';
import { registerRiskTools } from './tools/risks.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseSchema = process.env.DATABASE_SCHEMA ?? '';

const marketService = createMarketDataService({
  rbiApiKey: process.env.RBI_API_KEY,
  fredApiKey: process.env.FRED_API_KEY,
  dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY,
  fallbackMode: (process.env.MCP_FALLBACK_MODE ?? 'true') === 'true',
  cacheTtlSeconds: Number(process.env.MCP_CACHE_TTL ?? 604800),
});

const server = new McpServer({
  name: 'v3grand',
  version: '0.1.0',
});

registerMarketTools(server, marketService);

if (databaseUrl) {
  const isSupabase = databaseUrl.includes('supabase.co');
  const sql = postgres(databaseUrl, {
    ...(isSupabase ? { ssl: 'require' } : {}),
    ...(databaseSchema ? { connection: { search_path: databaseSchema } } : {}),
  });
  const db = drizzle(sql);
  registerDealTools(server, db);
  registerEngineTools(server, db);
  registerValidationTools(server, db);
  registerRiskTools(server, db);
  process.stderr.write('V3 Grand MCP server: market + deal + engine + validation + risk/audit/readiness tools (DB connected).\n');
} else {
  process.stderr.write('V3 Grand MCP server: market tools only (set DATABASE_URL for deal/engine/validation tools).\n');
}

const transport = new StdioServerTransport();
await server.connect(transport);
