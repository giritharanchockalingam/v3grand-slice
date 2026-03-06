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

  // Append search_path via connection string options for pooler compatibility
  let connUrl = databaseUrl;
  if (databaseSchema && !databaseUrl.includes('options=')) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    connUrl = `${databaseUrl}${separator}options=-csearch_path%3D${databaseSchema}`;
  }

  cachedSql = postgres(connUrl, {
    ...(isSupabase ? { ssl: 'require' } : {}),
    ...(isPooler ? { prepare: false } : {}), // pooler transaction mode doesn't support prepared statements
    max: 3, // limit connections in serverless
    idle_timeout: 20,
  });

  cachedDb = drizzle(cachedSql);
  return cachedDb;
}
