// ─── Fastify API Server Bootstrap ───────────────────────────────────
import Fastify from 'fastify';
import cors from '@fastify/cors';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from './config.js';
import { dealRoutes } from './routes/deals.js';
import { authRoutes } from './routes/auth.js';
import { constructionRoutes } from './routes/construction.js';
import { engineRoutes } from './routes/engines.js';
import { riskRoutes } from './routes/risks.js';
import { sseRoutes } from './routes/sse.js';
import { evaluationRoutes } from './routes/evaluation.js';
import { validationRoutes } from './routes/validation.js';
import { approvalRoutes } from './routes/approvals.js';
import { createNatsEventBus, type NatsEventBus } from './nats-event-bus.js';
import { recomputeDeal } from './services/recompute.js';
import { createMarketDataService } from '@v3grand/mcp';
import { insertMarketDataHistory } from '@v3grand/db';
import { marketRoutes } from './routes/market.js';
import { registerSecurityMiddleware } from './middleware/rate-limit.js';

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.frontendUrl === '*' ? true : config.frontendUrl });

  // Database – when DATABASE_SCHEMA is set (e.g. 'v3grand' on Supabase),
  // route all queries through that schema via search_path.
  const isSupabase = config.databaseUrl.includes('supabase.co');
  const sql = postgres(config.databaseUrl, {
    ...(isSupabase ? { ssl: 'require' } : {}),
    ...(config.databaseSchema
      ? { connection: { search_path: config.databaseSchema } }
      : {}),
  });
  const db = drizzle(sql);

  // ── G-6,G-7/F-15: Security middleware (rate limiting, security headers) ──
  registerSecurityMiddleware(app);

  // ── MCP Market Intelligence Service ──
  const marketService = createMarketDataService({
    rbiApiKey: config.rbiApiKey || undefined,
    fredApiKey: config.fredApiKey || undefined,
    dataGovInApiKey: config.dataGovInApiKey || undefined,
    fallbackMode: config.mcpFallbackMode,
    cacheTtlSeconds: config.mcpCacheTtlSeconds,
  });

  // ── G-4/F-8: Wire market data history logger for auditor traceability ──
  marketService.connectHistoryDB(async (entries) => {
    await insertMarketDataHistory(db, entries);
  });

  app.log.info('MCP MarketDataService initialized (fallbackMode=%s)', config.mcpFallbackMode);

  let natsBus: NatsEventBus | null = null;
  if (config.natsUrl) {
    natsBus = await createNatsEventBus({ natsUrl: config.natsUrl });
    natsBus.subscribe(async (event) => {
      const dealId = 'dealId' in event ? event.dealId : undefined;
      if (dealId) {
        await recomputeDeal(db, dealId, event.type, 'nats-subscriber');
      }
    });
    app.log.info({ natsUrl: config.natsUrl }, 'NATS JetStream event bus connected, recompute subscriber active');
  }

  // Routes
  await authRoutes(app, db);
  await dealRoutes(app, db, natsBus);
  await constructionRoutes(app, db, natsBus);
  await engineRoutes(app, db);
  await riskRoutes(app, db);
  await evaluationRoutes(app, db);
  await validationRoutes(app, db);       // G-9/F-1: Model validation, stress testing, SOC 2
  await approvalRoutes(app, db);          // G-11/F-2: Four-eyes approval workflow
  await sseRoutes(app);
  await marketRoutes(app, marketService);

  // Health check
  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Root: avoid 404 when hitting API base URL
  app.get('/', () => ({
    name: 'V3 Grand API',
    version: '2.0.0',
    health: '/health',
    login: '/auth/login',
    deals: '/deals',
    market: '/market/macro',
    compliance: '/compliance/controls',
    validation: '/validation/models',
  }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`V3 Grand API running on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
