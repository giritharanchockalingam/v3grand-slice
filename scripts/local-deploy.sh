#!/usr/bin/env bash
# ─── Local deploy: infra + build + seed + run API & UI ─────────────────────
# From repo root: ./scripts/local-deploy.sh
# Requires: Docker (running), Node 20+, pnpm

set -e
cd "$(dirname "$0")/.."

echo "=== 1. Environment ==="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
else
  echo ".env exists"
fi
# Ensure NATS_URL is set for local infra (so API uses event bus)
if ! grep -q '^NATS_URL=' .env 2>/dev/null; then
  echo "NATS_URL=nats://localhost:4222" >> .env
  echo "Appended NATS_URL to .env"
fi
# Load .env for later steps (db:seed, dev)
set -a
# shellcheck source=/dev/null
[ -f .env ] && . ./.env
set +a
# Default DATABASE_URL for Docker Compose Postgres (port 5433 to avoid conflict with local Postgres)
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5433/v3grand}"

echo ""
echo "=== 2. Start infrastructure (Postgres, Redis, NATS) ==="
cd packages/infra
docker compose up -d
cd ../..
echo "Waiting for Postgres (15s)..."
sleep 15
echo "Waiting for NATS (5s)..."
sleep 5

echo ""
echo "=== 3. Install & build ==="
pnpm install
pnpm build

echo ""
echo "=== 4. Database: create tables and seed ==="
pnpm db:seed

echo ""
echo "=== 5. Start API (port 3001) + UI (port 3000) ==="
echo "Cleaning Next.js cache to avoid 404s on static assets..."
rm -rf packages/ui/.next
echo "Open http://localhost:3000 and log in with lead@v3grand.com / demo123"
echo "Press Ctrl+C to stop."
echo ""
pnpm dev
