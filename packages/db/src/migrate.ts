// ─── Migrate entrypoint ─────────────────────────────────────────────
// Local dev: schema is applied via seed (pnpm db:seed).
// Supabase:  use pnpm migrate:supabase to run SQL migrations.
// See docs/GAP_ANALYSIS_ADDENDUM.md for production migration strategy.

console.log('Migrations:');
console.log('  Local dev  → pnpm db:seed  (creates tables + demo data)');
console.log('  Supabase   → pnpm migrate:supabase  (runs SQL in packages/db/src/migrations/)');
process.exit(0);
