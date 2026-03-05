#!/usr/bin/env bash
# Get a JWT by logging in, then call POST /agent/chat with your message.
# Usage: ./scripts/agent-chat.sh "Your message here"
# Or:    ./scripts/agent-chat.sh "List my deals"
# Uses lead@v3grand.com / demo123 by default. Override with LOGIN_EMAIL, LOGIN_PASSWORD, API_URL.
set -e

API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${LOGIN_EMAIL:-lead@v3grand.com}"
PASSWORD="${LOGIN_PASSWORD:-demo123}"
MESSAGE="${1:-List my deals and summarize the first one.}"

LOGIN_RESP=$(curl -sf -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}") || {
  echo "Login failed. Is the API running at ${API_URL}? Try: pnpm --filter @v3grand/api dev" >&2
  exit 1
}

TOKEN=$(echo "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "Could not get token from login response." >&2
  echo "$LOGIN_RESP" | head -c 500 >&2
  exit 1
fi

BODY=$(node -e "console.log(JSON.stringify({message: process.argv[1]}))" "$MESSAGE")
echo "Calling agent: $MESSAGE" >&2
curl -sf -X POST "${API_URL}/agent/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$BODY" | jq . 2>/dev/null || cat
