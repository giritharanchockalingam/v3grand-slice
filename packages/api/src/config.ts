// ─── Config Module ──────────────────────────────────────────────────
// Central place for all env-driven config with strong defaults.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load repo-root .env (works regardless of cwd)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const osUser = process.env.USER ?? process.env.USERNAME ?? 'postgres';

export const config = {
  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? `postgres://${osUser}@localhost:5432/v3grand`,

  /** API listen port */
  port: Number(process.env.PORT ?? 3001),

  /** JWT signing secret – override in production */
  jwtSecret: process.env.JWT_SECRET ?? 'v3grand-dev-secret-change-in-prod',

  /** CORS origin – defaults to allow all in dev */
  frontendUrl: process.env.FRONTEND_URL ?? '*',

  /** Node environment */
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** True in production */
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',

  /** NATS server URL for JetStream event bus. If unset, in-process bus is used. */
  natsUrl: process.env.NATS_URL ?? '',
} as const;
