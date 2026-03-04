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
import { createNatsEventBus, type NatsEventBus } from './nats-event-bus.js';
import { recomputeDeal } from './services/recompute.js';

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.frontendUrl === '*' ? true : config.frontendUrl });

  // Database
  const sql = postgres(config.databaseUrl);
  const db = drizzle(sql);

  let natsBus: NatsEventBus | null = null;
  if (config.natsUrl) {
    natsBus = await createNatsEventBus({ natsUrl: config.natsUrl });
    natsBus.subscribe(async (event) => {
      await recomputeDeal(db, event.dealId, event.type, 'nats-subscriber');
    });
    app.log.info({ natsUrl: config.natsUrl }, 'NATS JetStream event bus connected, recompute subscriber active');
  }

  // Routes
  await authRoutes(app, db);
  await dealRoutes(app, db, natsBus);
  await constructionRoutes(app, db, natsBus);
  await engineRoutes(app, db);
  await riskRoutes(app, db);

  // Health check
  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Root: avoid 404 when hitting API base URL
  app.get('/', () => ({
    name: 'V3 Grand API',
    health: '/health',
    login: '/auth/login',
    deals: '/deals',
  }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`V3 Grand API running on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
