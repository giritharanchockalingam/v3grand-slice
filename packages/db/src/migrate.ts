// ─── Migrate entrypoint ─────────────────────────────────────────────
// Runs SQL files in packages/db/src/migrations/ against DATABASE_URL.
// - Local dev (no DATABASE_SCHEMA): tables are in public → we substitute "v3grand." with "public."
// - Supabase (DATABASE_SCHEMA=v3grand): run as-is or set search_path.
// Alternative: pnpm migrate:supabase (Supabase URL check, runs migrations as-is).

import postgres from 'postgres';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  } catch {
    // dotenv not available
  }

  const osUser = process.env.USER ?? process.env.USERNAME ?? 'postgres';
  const DEFAULT_URL = `postgres://${osUser}@localhost:5432/v3grand`;
  const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_URL;
  const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA ?? '';

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!existsSync(migrationsDir)) {
    console.log('No migrations directory found. Nothing to run.');
    process.exit(0);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No .sql migration files found.');
    process.exit(0);
  }

  // For local dev, seed creates tables in public; migrations reference v3grand.deals.
  const tableSchema = DATABASE_SCHEMA || 'public';

  const sql = postgres(DATABASE_URL, {
    max: 1,
    ...(DATABASE_SCHEMA ? { connection: { search_path: DATABASE_SCHEMA } } : {}),
  });

  console.log(`Running ${files.length} migration(s) (schema: ${tableSchema})...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    let migration = readFileSync(filePath, 'utf-8');
    if (!DATABASE_SCHEMA) {
      migration = migration.replace(/\bv3grand\./g, 'public.');
    }
    console.log(`  → ${file}`);
    await sql.unsafe(migration);
    console.log('    ✓ done');
  }

  await sql.end();
  console.log('All migrations applied.');
}

run().catch((e: Error & { code?: string }) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
