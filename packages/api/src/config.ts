// ─── Config Module ──────────────────────────────────────────────────
// Central place for all env-driven config with strong defaults.

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
} as const;
