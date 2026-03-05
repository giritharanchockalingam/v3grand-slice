// ─── Reusable Fastify App Builder (used by both local dev & Vercel serverless) ──
import Fastify, { type FastifyInstance } from 'fastify';
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
import { agentRoutes } from './routes/agent.js';
import { registerSecurityMiddleware } from './middleware/rate-limit.js';
import { assumptionRoutes } from './routes/assumptions.js';
import { modelsRoutes } from './routes/models.js';
import { reportsRoutes } from './routes/reports.js';
import { dealCreateRoutes } from './routes/deal-create.js';
import { alertRoutes } from './routes/alerts.js';
import { recommendationRoutes } from './routes/recommendations.js';
import { revaluationRoutes } from './routes/revaluation.js';
import { lpPortalRoutes } from './routes/lp-portal.js';
import { fundAdminRoutes } from './routes/fund-admin.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { websocketRoutes } from './routes/websocket.js';

let cachedApp: FastifyInstance | null = null;

export async function buildApp(): Promise<FastifyInstance> {
  if (cachedApp) return cachedApp;

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.frontendUrl === '*' ? true : config.frontendUrl });

  const isSupabase = config.databaseUrl.includes('supabase.co');
  const sql = postgres(config.databaseUrl, {
    ...(isSupabase ? { ssl: 'require' } : {}),
    ...(config.databaseSchema
      ? { connection: { search_path: config.databaseSchema } }
      : {}),
  });
  const db = drizzle(sql);

  registerSecurityMiddleware(app);

  const marketService = createMarketDataService({
    rbiApiKey: config.rbiApiKey || undefined,
    fredApiKey: config.fredApiKey || undefined,
    dataGovInApiKey: config.dataGovInApiKey || undefined,
    fallbackMode: config.mcpFallbackMode,
    cacheTtlSeconds: config.mcpCacheTtlSeconds,
  });

  marketService.connectHistoryDB(async (entries) => {
    await insertMarketDataHistory(db, entries);
  });

  let natsBus: NatsEventBus | null = null;
  if (config.natsUrl) {
    try {
      natsBus = await createNatsEventBus({ natsUrl: config.natsUrl });
      natsBus.subscribe(async (event) => {
        const dealId = 'dealId' in event ? event.dealId : undefined;
        if (dealId) {
          await recomputeDeal(db, dealId, event.type, 'nats-subscriber');
        }
      });
      app.log.info('NATS event bus connected');
    } catch (err) {
      app.log.warn({ err }, 'NATS connection failed — using in-process event bus. Unset NATS_URL in .env to silence.');
      natsBus = null;
    }
  }

  await authRoutes(app, db);
  await dealRoutes(app, db, natsBus);
  await constructionRoutes(app, db, natsBus);
  await engineRoutes(app, db);
  await riskRoutes(app, db);
  await evaluationRoutes(app, db);
  await validationRoutes(app, db);
  await approvalRoutes(app, db);
  await sseRoutes(app);
  await marketRoutes(app, marketService);
  await agentRoutes(app, db, marketService);
  await assumptionRoutes(app, db);
  await modelsRoutes(app, db);
  await reportsRoutes(app, db);
  await dealCreateRoutes(app, db, natsBus);
  await alertRoutes(app, db);
  await recommendationRoutes(app, db);
  await revaluationRoutes(app, db);
  await lpPortalRoutes(app, db);
  await fundAdminRoutes(app, db);
  await portfolioRoutes(app, db);
  await websocketRoutes(app);

  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/', () => ({
    name: 'V3 Grand API',
    version: '3.0.0',
    health: '/health',
    login: '/auth/login',
    deals: '/deals',
    market: '/market/macro',
    compliance: '/compliance/controls',
    validation: '/validation/models',
    agent: '/agent/chat',
    alerts: '/deals/:id/alerts',
    recommendations: '/deals/:id/recommendations/history',
    revaluation: '/deals/:id/revalue',
    lpPortal: '/lp/dashboard',
    fundWaterfall: '/fund/:id/waterfall',
    portfolio: '/portfolio/overview',
    ws: '/ws/deals/:dealId',
  }));

  cachedApp = app;
  return app;
}
