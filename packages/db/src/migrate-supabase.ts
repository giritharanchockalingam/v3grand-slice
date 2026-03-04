// ─── Supabase Migration Runner ──────────────────────────────────────
// Runs SQL migration files in packages/db/src/migrations/ against the
// Supabase Postgres instance defined by DATABASE_URL.
//
// Usage:  pnpm migrate:supabase
//         DATABASE_URL=postgres://... pnpm migrate:supabase

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  // Load repo-root .env
  try {
    // @ts-ignore - dotenv may not be installed
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  } catch {
    // dotenv not available, continue with environment variables as-is
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required. Set it in .env or pass it as an env var.');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // alphabetical → 001_, 002_, etc.

  console.log(`Running ${files.length} migration(s) against Supabase...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const migration = readFileSync(filePath, 'utf-8');
    console.log(`  → ${file}`);
    await sql.unsafe(migration);
    console.log(`    ✓ done`);
  }

  await sql.end();
  console.log('All migrations applied.');
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
