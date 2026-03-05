#!/usr/bin/env bash
# Verify the V3 Grand API is responding (GET /health).
# Usage: ./scripts/verify-api.sh [base_url]
#   base_url defaults to ${API_URL:-http://localhost:3001}
set -e

BASE_URL="${1:-${API_URL:-http://localhost:3001}}"
BASE_URL="${BASE_URL%/}"
HEALTH_URL="${BASE_URL}/health"

if ! command -v curl >/dev/null 2>&1; then
  echo "FAIL curl not found" >&2
  exit 1
fi

OUT=$(curl -sf --max-time 5 -w '\n%{http_code}' "$HEALTH_URL" 2>&1) || CURL_EXIT=$?
HTTP_CODE=$(echo "$OUT" | tail -n1)
RESPONSE=$(echo "$OUT" | sed '$d')

if [ -n "${CURL_EXIT:-}" ]; then
  case "$CURL_EXIT" in
    6)  echo "FAIL Could not resolve host for $HEALTH_URL" >&2 ;;
    7)  echo "FAIL Connection refused — is the API running? Start with: pnpm --filter @v3grand/api dev" >&2 ;;
    28) echo "FAIL Timeout connecting to $HEALTH_URL" >&2 ;;
    *)  echo "FAIL curl failed (exit $CURL_EXIT) for $HEALTH_URL" >&2 ;;
  esac
  exit 1
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL HTTP $HTTP_CODE from $HEALTH_URL" >&2
  exit 1
fi

if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo "OK API responding at $HEALTH_URL"
  exit 0
fi

echo "FAIL Unexpected response from $HEALTH_URL (no status ok)" >&2
exit 1
