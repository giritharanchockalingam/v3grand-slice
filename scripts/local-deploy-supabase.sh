#!/usr/bin/env bash
# ─── Local deploy with Supabase (no Docker) ─────────────────────────────
# From repo root: ./scripts/local-deploy-supabase.sh
# Requires: Node 20+, pnpm. Uses Supabase Postgres; NATS and Redis are not started.

set -e
cd "$(dirname "$0")/.."

echo "=== 1. Environment ==="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — please set DATABASE_URL to your Supabase connection string and DATABASE_SCHEMA=v3grand"
  exit 1
fi

# Load .env for later steps
set -a
# shellcheck source=/dev/null
[ -f .env ] && . ./.env
set +a

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in .env. Set it to your Supabase Postgres connection string."
  exit 1
fi

if [[ "$DATABASE_URL" != *"supabase"* ]]; then
  echo "Warning: DATABASE_URL does not look like a Supabase URL. For Supabase, use the connection string from Project Settings → Database."
fi

# Use v3grand schema for Supabase (recommended)
export DATABASE_SCHEMA="${DATABASE_SCHEMA:-v3grand}"
echo "Using DATABASE_SCHEMA=$DATABASE_SCHEMA"
# Leave NATS_URL unset so the API uses in-process event bus (no Docker NATS needed)
export NATS_URL=

echo ""
echo "=== 2. Install & build ==="
pnpm install
pnpm build

echo ""
echo "=== 3. Database: run Supabase migrations (idempotent) ==="
pnpm migrate:supabase

echo ""
echo "=== 4. Database: seed demo users and V3 Grand deal ==="
pnpm db:seed

echo ""
echo "=== 5. Start API (port 3001) + UI (port 3000) ==="
echo "Cleaning Next.js cache to avoid 404s on static assets..."
rm -rf packages/ui/.next
echo "Open http://localhost:3000 and log in with lead@v3grand.com / demo123"
echo "Press Ctrl+C to stop."
echo ""
pnpm dev
