# V3 Grand — Pilot Runbook

## Prerequisites

| Tool       | Version   |
|------------|-----------|
| Node.js    | ≥ 20 LTS  |
| pnpm       | ≥ 8       |
| PostgreSQL | ≥ 15 (or use Supabase — see below) |

## Quick Start (fresh machine) — with Docker

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and edit if needed (defaults work with Docker Compose)
cp .env.example .env

# 3. Start infrastructure (PostgreSQL + Redis)
cd packages/infra && docker compose up -d && cd ../..

# 4. Create database + seed
pnpm --filter @v3grand/db run seed
#    Creates "v3grand" DB, all tables, demo users, V3 Grand deal, construction
#    data, risk register entries, and initial engine results.

# 5. Start API server (port 3001)
pnpm --filter @v3grand/api run dev

# 6. Start UI (port 3000) — in a separate terminal
pnpm --filter @v3grand/ui run dev

# 7. Open http://localhost:3000/login
```

## Quick Start — with Supabase (no Docker)

If you use Supabase and don’t want Docker running locally:

```bash
# 1. In .env set:
#    DATABASE_URL=<your Supabase Postgres connection string>
#    DATABASE_SCHEMA=v3grand
#    (Leave NATS_URL unset so the API uses in-process event bus.)

# 2. One-command deploy (install, build, migrate, seed, run API + UI):
./scripts/local-deploy-supabase.sh
```

Or manually:

```bash
pnpm install
cp .env.example .env   # then set DATABASE_URL and DATABASE_SCHEMA=v3grand
pnpm build
pnpm migrate:supabase  # create v3grand schema and tables on Supabase
pnpm db:seed           # demo users and V3 Grand deal
pnpm dev               # API (3001) + UI (3000)
```

Open http://localhost:3000/login and sign in with `lead@v3grand.com` / `demo123`.

## Agent (Phase 2)

The API exposes **POST /agent/chat** — an LLM-powered assistant that uses the same MCP tools (deals, engines, validation, market) in-process.

| Step | Check | Command or action |
|------|--------|-------------------|
| 1. Configure | Set `OPENAI_API_KEY` in `.env` | Without it, POST /agent/chat returns 503 |
| 2. Call | Send a message and get a reply | See below |
| 3. Response | Reply + optional toolCallsUsed | `{ reply, toolCallsUsed?, rounds, conversationId? }` |

**Option A — script (logs in and calls agent):**
```bash
./scripts/agent-chat.sh "List my deals and summarize the first one."
```
Uses `lead@v3grand.com` / `demo123` by default. Override with `LOGIN_EMAIL`, `LOGIN_PASSWORD`, or `API_URL`.

**Option B — manual (get a JWT, then call agent):**
```bash
# 1. Log in and copy the token from the response
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lead@v3grand.com","password":"demo123"}'

# 2. Use the "token" value in place of YOUR_JWT below
curl -X POST http://localhost:3001/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"message":"List my deals"}'
```

Optional env: `AGENT_MODEL` (default `gpt-4o-mini`), `AGENT_MAX_TOOL_ROUNDS` (default 10).

## Agent Workflows (Phase 3) and UI

**Workflow API (plan → execute → verify):**

| Endpoint | Description |
|----------|-------------|
| `GET /agent/workflows` | List available workflows (name, description, inputRequired). Requires auth. |
| `POST /agent/workflows/validate` | Pre-flight check: verifies DB schema and tool runner. Body: `{ workflowName?: string }`. Returns `{ ok: true }` or `{ ok: false, error, hint? }`. Called by the UI before Execute. |
| `POST /agent/workflows/:name/execute` | Execute a workflow by name. Body: `{}` or `{ dealId: "..." }` depending on workflow. Returns HMS-style report: `status`, `verification`, `timing`, `_debug` (stepResults, verificationResults). Requires auth. |

**Built-in workflows:** `deal_dashboard_stress` (no input: lists deals, runs dashboard + stress test for first deal, verifies); `deal_summary_validation` (input: `dealId`: dashboard + validation models, verifies recommendation).

**UI:** Open **Agent** in the nav (or http://localhost:3000/agent). Use **Workflows** to pick a workflow, optionally set Deal ID, and run **Execute**. Before running, the UI calls **POST /agent/workflows/validate**; if that fails (e.g. missing DB column), the error is shown and the workflow does not run — fix the issue (e.g. run `pnpm db:migrate`) and try again. Progress (phase, steps, verification) is shown HMS-style. Use **Assistant** to chat with the LLM (same as `POST /agent/chat`).

**Enterprise (Phase A–D):**
- **Deal snapshots:** Optional `marketSnapshotAtCreate` and `macroSnapshotAtCreate` on `POST /deals`; run migration `006_deal_snapshots.sql` (adds columns to `v3grand.deals`).
- **Capture context (Big 4):** Migration `007_deal_capture_context.sql` adds `capture_context` JSONB to deals. Run **pnpm db:migrate** (runs all SQL in `packages/db/src/migrations/`; local dev uses `public` schema). For Supabase use **pnpm migrate:supabase**. If you see `column "capture_context" does not exist`, run one of these.
- **Readiness:** `GET /deals/:id/readiness` returns `{ score, checks, message }` for IC readiness.
- **Status / risk gate:** `PATCH /deals/:id` with `{ status, lifecyclePhase }`; setting `status` to `active` requires at least one risk (returns 400 otherwise).
- **MCP tools:** `get_risks`, `create_risk`, `get_audit`, `deal_readiness`, `generate_ic_memo_summary` (see Agent/Assistant).
- **Workflows:** `deal_ic_readiness`, `deal_market_alignment`, `deal_full_recompute_verify`, `deal_stress_to_risks`, `market_snapshot_for_deal` (plus `market_and_deal_health`) — all in Agent UI dropdown.
- **Audit:** Workflow execution is audited when the workflow input includes `dealId` (`module: 'agent'`, `action: 'workflow.executed'`).
- **Anti-hallucination:** See `docs/ANTI_HALLUCINATION_CONTRACT.md`.

Use this checklist to verify API and UI connectivity:

| Step | Check | Command or action |
|------|--------|-------------------|
| 1. API responding | `GET /health` returns 200 and `{"status":"ok",...}` | `curl -s http://localhost:3001/health` or `./scripts/verify-api.sh` |
| 2. UI env | UI calls the correct API | Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env` (or your API base); restart UI after changes |
| 3. Login | No CORS/network errors | Open http://localhost:3000/login → sign in with `lead@v3grand.com` / `demo123` |
| 4. Dashboard | Data loads from API | Open a deal → Dashboard tab shows recommendation and metrics |
| 5. MCP tools (Phase 1) | All 19 tool handlers return valid content | `./scripts/smoke-test-mcp.sh` or `pnpm --filter @v3grand/mcp-server run smoke`. With npm: `cd packages/mcp-server && npm run smoke`. With `DATABASE_URL`: full set; without DB: market tools only. |

## Demo Credentials

| Email               | Password | Role            |
|---------------------|----------|-----------------|
| lead@v3grand.com    | demo123  | lead-investor   |
| co@v3grand.com      | demo123  | co-investor     |
| ops@v3grand.com     | demo123  | operator        |
| viewer@v3grand.com  | demo123  | viewer          |
| lp1@v3grand.com     | demo123  | co-investor     |
| lp2@v3grand.com     | demo123  | viewer          |

## Demo Walkthroughs

### 1. Investor Dashboard Flow (lead@ or co@)
1. Login → Deals list → click **V3 Grand Madurai Hotel**
2. **Dashboard tab** → view Recommendation Card, Key Metrics, 10-Year Pro Forma
3. Click **▶ Recompute Recommendation** → watch engine cascade run → metrics refresh
4. Note the toast confirmation banner at the top

### 2. Assumption Sensitivity (lead@)
1. Go to **Assumptions tab**
2. Drag "ADR Growth Rate" slider up to 8%
3. Click **Save & Recompute** → IRR/NPV update, verdict may flip
4. Try adjusting "Exit Multiple" and "Debt Ratio" — observe impact on recommendation

### 3. Scenario Comparison (any role)
1. Go to **Scenarios tab**
2. Compare Bear / Base / Bull side-by-side: IRR, NPV, Equity Multiple, Gate results
3. Click "Promote to Active" on Bull scenario → badge moves
4. Year-by-year revenue/EBITDA comparison table at the bottom

### 4. Construction Monitoring (ops@ or lead@)
1. Go to **Construction tab** (only visible to lead-investor, operator, co-investor)
2. View budget lines, milestones, existing change orders
3. Submit a new change order → appears with status "submitted"
4. Login as lead@ → approve the CO → triggers recompute with updated budget

### 5. Risk Register (any role with edit access)
1. Go to **Risks tab**
2. View summary strip: Total / Open / High Priority
3. Click "+ Add Risk" → fill form → Save
4. Mark existing risks as Mitigated / Accepted / Closed

## IAIP features (where to find them)

The **Feasibility Workbench**, **assumption governance (FEATURE E)**, **IC memo generate**, and **backtest** live inside the **deal dashboard** and API. You do **not** need to redeploy or reinstall unless you changed dependencies.

**If you don’t see the new features:**

| Step | Action |
|------|--------|
| 1. Migrations | Run **`pnpm db:migrate`** (or **`pnpm migrate:supabase`** if using Supabase) so IAIP tables exist (`assumptions`, `scenario_runs`, `reports`, etc.). Local migrate rewrites `v3grand.` → `public.` automatically. |
| 2. Run app | Start API + UI: **`pnpm dev`** (or `./scripts/local-deploy.sh` / `./scripts/local-deploy-supabase.sh`). No need to reinstall (`pnpm install`) unless you pulled new dependencies. |
| 3. Open a deal | Go to **Deals** → click a deal (e.g. **V3 Grand Madurai Hotel**). |

**Where each feature is:**

| Feature | Location |
|--------|----------|
| **Feasibility Workbench** | Deal dashboard → **Feasibility** tab (scenario toggles Base/Downside/Upside, assumptions table with status/approve, tornado placeholder, “Generate IC memo” button). |
| **Assumption governance (draft → approved → locked)** | Same **Feasibility** tab → “Assumption governance (FEATURE E)” table; or **Assumptions** tab for the existing slider-based market/financial assumptions. |
| **Generate IC memo** | Deal dashboard → **Feasibility** tab → “Reporting” section → **Generate IC memo**; response appears as JSON below. |
| **Backtest** | API only: **POST /models/backtest/run** (body: `engineName`, `testDealIds`, `metricKey`). No UI button yet. |
| **Assumptions API** | **GET /deals/:id/assumptions**, **PATCH /deals/:id/assumptions/:key**, **POST /deals/:id/assumptions/:key/approve**. Used by the Feasibility tab. |

If the **Feasibility** tab is missing, ensure the UI was built after the latest code: `pnpm build` then `pnpm dev`, or clear Next cache: `rm -rf packages/ui/.next` then `pnpm dev`.

## Re-Seeding

To reset the database and start fresh:

```bash
# Drop and recreate (when using Docker: database is v3grand, user postgres)
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS v3grand"
pnpm --filter @v3grand/db run seed
```

## Project Structure

```
packages/
  core/     — Types, schemas, logger (shared)
  engines/  — Pure computation (Factor, Underwriter, MC, Budget, S-Curve, Decision)
  db/       — Drizzle schema, queries, seed
  api/      — Fastify server, routes, recompute service
  ui/       — Next.js 14 App Router frontend
  infra/    — Docker Compose (PostgreSQL, Redis)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED :5432` | Start infra: `cd packages/infra && docker compose up -d` or `brew services start postgresql@15` |
| `database "v3grand" does not exist` | Run `pnpm --filter @v3grand/db run seed` |
| API CORS errors | Check `NEXT_PUBLIC_API_URL` in `.env` matches API port (default 3001) |
| "No access to this deal" | Run seed to create deal_access entries |
| Blank dashboard after seed | Click "Recompute" to generate initial engine results |
| `column "capture_context" does not exist` (workflows or MCP) | Run migrations: **pnpm db:migrate** (runs SQL in `packages/db/src/migrations/`; for local dev substitutes `public` for `v3grand`). For Supabase use **pnpm migrate:supabase**. Then retry. |
