/**
 * Server-side database connection for Next.js API routes.
 * Singleton pattern — reuses connection across requests in the same serverless instance.
 * Modeled after hms-aurora-portal's direct-to-Supabase pattern.
 *
 * RLS Integration:
 *   getDb()   — raw superuser connection (migrations, admin tasks)
 *   withRLS() — transaction-wrapped connection that impersonates v3grand_api
 *               role and sets JWT claims as session variables so PostgreSQL
 *               RLS policies can enforce per-user, per-deal access control.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
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

/**
 * Execute a callback within an RLS-enforced transaction.
 *
 * How it works:
 *   1. Opens a transaction on the superuser connection
 *   2. SET LOCAL role = 'v3grand_api'  — drops to non-superuser (RLS enforced)
 *   3. set_config() passes userId + role as session variables
 *   4. RLS policies read these via current_setting() / v3grand.current_user_id()
 *   5. SET LOCAL automatically resets at transaction end — safe for pooling
 *
 * Usage:
 *   const deals = await withRLS(user.userId, user.role, (db) =>
 *     db.select().from(deals)
 *   );
 */
export async function withRLS<T>(
  userId: string,
  role: string,
  fn: (db: PostgresJsDatabase) => Promise<T>
): Promise<T> {
  const db = getDb();
  return await db.transaction(async (tx) => {
    // Drop from superuser to v3grand_api — RLS policies now enforced
    await tx.execute(sql`SET LOCAL role = 'v3grand_api'`);
    // Pass JWT claims as session variables for RLS policy evaluation
    await tx.execute(
      sql`SELECT set_config('request.jwt.claim.user_id', ${userId}, true)`
    );
    await tx.execute(
      sql`SELECT set_config('request.jwt.claim.role', ${role}, true)`
    );
    return fn(tx as unknown as PostgresJsDatabase);
  });
}
