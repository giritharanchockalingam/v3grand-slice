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

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.frontendUrl === '*' ? true : config.frontendUrl });

  // Database
  const sql = postgres(config.databaseUrl);
  const db = drizzle(sql);

  // Routes
  await authRoutes(app, db);
  await dealRoutes(app, db);
  await constructionRoutes(app, db);
  await engineRoutes(app, db);
  await riskRoutes(app, db);

  // Health check
  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`V3 Grand API running on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
