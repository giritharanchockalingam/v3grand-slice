// ─── Migrate entrypoint ─────────────────────────────────────────────
// Schema is currently applied via seed (pnpm db:seed). For production,
// introduce Drizzle migrations and run them here. See docs/GAP_ANALYSIS_ADDENDUM.md.

console.log('Migrations: schema is applied via seed (pnpm db:seed). For production, add Drizzle migrations.');
process.exit(0);
