#!/usr/bin/env bash
# Phase 1 MCP smoke-test: run tool handlers in-process (market, deal, validation).
# Usage: ./scripts/smoke-test-mcp.sh
# Requires: .env (optional DATABASE_URL for deal/validation tools).
# Note: This repo uses pnpm; for npm use: cd packages/mcp-server && npm run smoke
set -e

cd "$(dirname "$0")/.."
pnpm --filter @v3grand/mcp-server run smoke
