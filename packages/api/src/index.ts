// ─── Fastify API Server Bootstrap ───────────────────────────────────
import Fastify from 'fastify';
import cors from '@fastify/cors';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { dealRoutes } from './routes/deals.js';
import { authRoutes } from './routes/auth.js';
import { constructionRoutes } from './routes/construction.js';
import { engineRoutes } from './routes/engines.js';

const osUser = process.env.USER ?? process.env.USERNAME ?? 'postgres';
const DATABASE_URL = process.env.DATABASE_URL ?? `postgres://${osUser}@localhost:5432/v3grand`;
const PORT = Number(process.env.PORT ?? 3001);

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Database
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  // Routes
  await authRoutes(app, db);
  await dealRoutes(app, db);
  await constructionRoutes(app, db);
  await engineRoutes(app, db);

  // Health check
  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`V3 Grand API running on http://localhost:${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
