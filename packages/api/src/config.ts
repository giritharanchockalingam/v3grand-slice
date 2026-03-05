// ─── Config Module ──────────────────────────────────────────────────
// G-13/F-13: Environment separation, validation, and secrets management.
//
// All secrets come from environment variables (or .env in development).
// Production startup is refused if critical config is missing.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load repo-root .env (only in non-production — production should use vault/env)
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

const osUser = process.env.USER ?? process.env.USERNAME ?? 'postgres';

export const config = {
  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? `postgres://${osUser}@localhost:5432/v3grand`,

  /** PostgreSQL schema (e.g. 'v3grand' for Supabase). When set, all queries
   *  use this schema via search_path instead of the default 'public' schema. */
  databaseSchema: process.env.DATABASE_SCHEMA ?? '',

  /** API listen port */
  port: Number(process.env.PORT ?? 3001),

  /** JWT signing secret – override in production */
  jwtSecret: process.env.JWT_SECRET ?? 'v3grand-dev-secret-change-in-prod',

  /** CORS origin – defaults to allow all in dev */
  frontendUrl: process.env.FRONTEND_URL ?? '*',

  /** Node environment */
  nodeEnv,

  /** True in production */
  isProd: nodeEnv === 'production',

  /** True in development */
  isDev: nodeEnv === 'development',

  /** NATS server URL for JetStream event bus. If unset, in-process bus is used. */
  natsUrl: process.env.NATS_URL ?? '',

  /** OpenAI API key for agent (POST /agent/chat). When unset, agent returns 503. */
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  /** Agent model (default gpt-4o-mini for cost; use gpt-4o for best quality). */
  agentModel: process.env.AGENT_MODEL ?? 'gpt-4o-mini',
  /** Max tool-call rounds per request (default 10). */
  agentMaxToolRounds: Number(process.env.AGENT_MAX_TOOL_ROUNDS ?? 10),

  // ── MCP Market Intelligence ──
  /** RBI DBIE API key — free at data.rbi.org.in */
  rbiApiKey: process.env.RBI_API_KEY ?? '',
  /** FRED API key — free at fred.stlouisfed.org */
  fredApiKey: process.env.FRED_API_KEY ?? '',
  /** data.gov.in API key — free at data.gov.in */
  dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY ?? '',
  /** When true, engines use hardcoded defaults if all API calls fail */
  mcpFallbackMode: (process.env.MCP_FALLBACK_MODE ?? 'true') === 'true',
  /** Cache TTL in seconds (default: 7 days) */
  mcpCacheTtlSeconds: Number(process.env.MCP_CACHE_TTL ?? 604800),

  // ── G-6/F-15: Rate Limiting ──
  /** Max requests per rate limit window per IP */
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  /** Rate limit window in milliseconds (default: 1 minute) */
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),

  // ── G-7/F-15: CORS ──
  /** Allowed CORS origins (comma-separated in env) */
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',').map(s => s.trim()).filter(Boolean),
} as const;

// ── G-13: Production safety checks ──
if (config.isProd) {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL) errors.push('DATABASE_URL must be set in production');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be set to a secure value (≥32 chars) in production');
  }
  if (config.jwtSecret.includes('dev-secret')) {
    errors.push('JWT_SECRET contains dev default — set a production secret');
  }
  if (config.corsOrigins.some(o => o.includes('localhost'))) {
    console.warn('⚠️  CORS origins include localhost in production');
  }

  if (errors.length > 0) {
    console.error(`\n❌ Production configuration errors:\n${errors.map(e => `  • ${e}`).join('\n')}\n`);
    process.exit(1);
  }
}
