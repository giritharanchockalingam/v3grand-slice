/**
 * Server-side database connection for Next.js API routes.
 * Singleton pattern — reuses connection across requests in the same serverless instance.
 * Modeled after hms-aurora-portal's direct-to-Supabase pattern.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

let cachedDb: PostgresJsDatabase | null = null;
let cachedSql: ReturnType<typeof postgres> | null = null;

export function getDb(): PostgresJsDatabase {
  if (cachedDb) return cachedDb;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isSupabase = databaseUrl.includes('supabase.co');
  const isPooler = databaseUrl.includes('pooler.supabase.com');
  const databaseSchema = process.env.DATABASE_SCHEMA || '';

  cachedSql = postgres(databaseUrl, {
    ...(isSupabase ? { ssl: 'require' } : {}),
    ...(isPooler ? { prepare: false } : {}), // pooler transaction mode doesn't support prepared statements
    ...(databaseSchema ? { connection: { search_path: databaseSchema } } : {}),
    max: 3, // limit connections in serverless
    idle_timeout: 20,
  });

  cachedDb = drizzle(cachedSql);
  return cachedDb;
}
