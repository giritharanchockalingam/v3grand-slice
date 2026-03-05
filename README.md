# V3 Grand — Vertical Slice

**One Deal → Underwriter → Decision → Dashboard.**

A thin end-to-end slice of the **V3 Grand Investment Platform**: create a deal, run the Underwriter engine, get a Recommendation, and view it on the Deal Dashboard. This repo demonstrates the full computation pipeline (Factor → Underwriter → Monte Carlo → Budget → S-Curve → Decision) with a Fastify API and Next.js 14 UI.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Verification](#verification)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [API overview](#api-overview)
- [Demo credentials](#demo-credentials)
- [Verified engine output](#verified-engine-output)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

- **Deal dashboard**: Recommendation card, key metrics (IRR, NPV, DSCR, Equity Multiple, Payback, Exit Value), 10-year pro forma cash flow table.
- **Assumption editing**: Slider-based market and financial assumptions with **Save & Recompute** triggering the full engine cascade.
- **Scenario comparison**: Bear / Base / Bull scenarios with side-by-side metrics and “Promote to Active.”
- **Construction**: Budget lines, milestones, change orders, RFIs; CO approval with role check and recompute.
- **Risks**: Risk register summary and CRUD (add, mitigate, accept, close).
- **Auth**: JWT-based login with role-based access (lead-investor, co-investor, operator, viewer).

---

## Tech stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Monorepo    | pnpm workspaces, Turborepo           |
| Core        | TypeScript, Zod                      |
| Engines     | Pure TS (Vitest for tests)           |
| Database    | PostgreSQL, Drizzle ORM              |
| API         | Fastify, CORS, custom JWT auth        |
| UI          | Next.js 14 (App Router), React Query, Tailwind CSS |
| Infra       | Docker Compose (PostgreSQL 16, Redis 7) |

**Node:** ≥ 20  
**Package manager:** pnpm 9.x (see `packageManager` in root `package.json`)

---

## Project structure

Industry-standard layout:

```
v3grand-slice/
├── .github/
│   └── workflows/
│       └── ci.yml           # CI: install, typecheck, build, test
├── docs/
│   ├── RUNBOOK.md           # Operational runbook & demo walkthroughs
│   └── GAP_ANALYSIS.md      # Spec vs implementation gap analysis
├── packages/
│   ├── core/                # Shared types, schemas, logger
│   ├── engines/             # Factor, Underwriter, MC, Budget, S-Curve, Decision
│   ├── db/                  # Drizzle schema, queries, seed
│   ├── api/                 # Fastify server, routes, recompute service
│   ├── ui/                  # Next.js 14 App Router frontend
│   └── infra/               # Docker Compose (Postgres + Redis)
├── .env.example
├── CONTRIBUTING.md
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── turbo.json
└── tsconfig.json
```

| Package      | Role |
|-------------|------|
| `@v3grand/core`   | TypeScript types (Deal, ProForma, Decision, Recommendation, Events), Zod schemas, logger. Consumed by all other packages. |
| `@v3grand/engines`| Pure computation: Factor (4-domain score), Underwriter (10-year cash flow + IRR/NPV), Monte Carlo, Budget variance, S-Curve, Decision (gate logic). |
| `@v3grand/db`     | Drizzle schema (users, deals, engineResults, recommendations, auditLog, budgetLines, changeOrders, rfis, milestones, domainEvents), queries, V3 Grand seed. |
| `@v3grand/api`    | Fastify server: auth, deals, assumptions, underwrite, dashboard, scenarios, construction, engines. Recompute cascade in `services/recompute.ts`. |
| `@v3grand/ui`     | Next.js 14: login, deal list, deal dashboard (tabs: Dashboard, Assumptions, Scenarios, Construction, Risks). |
| `packages/infra`  | Docker Compose for local PostgreSQL and Redis. |

---

## Prerequisites

- **Node.js** ≥ 20 LTS  
- **pnpm** ≥ 8 (recommend 9.x per `packageManager`)  
- **Docker** (for PostgreSQL and Redis via `packages/infra`)  
- Optional: local PostgreSQL ≥ 15 if not using Docker

---

## Quick start

**One-command local deploy (recommended, uses Docker):**

```bash
./scripts/local-deploy.sh
```

This will: start Docker (Postgres, Redis, NATS), install & build, seed the database, then start the API and UI. Open **http://localhost:3000**, log in with `lead@v3grand.com` / `demo123`. Press Ctrl+C to stop.

**Requirements:** Docker running, Node ≥ 20, pnpm 9.x.

---

**One-command local deploy with Supabase (no Docker):**

If you use Supabase for Postgres and don’t want Docker running locally:

1. In `.env`, set `DATABASE_URL` to your Supabase Postgres connection string (Project Settings → Database) and `DATABASE_SCHEMA=v3grand`.
2. Run:

```bash
./scripts/local-deploy-supabase.sh
```

This will: install & build, run Supabase migrations, seed the database, then start the API and UI. The API uses an in-process event bus (NATS and Redis are not required). Open **http://localhost:3000**, log in with `lead@v3grand.com` / `demo123`.

**Requirements:** Node ≥ 20, pnpm 9.x, Supabase project with connection string in `.env`.

---

**Manual steps (alternative):**

```bash
# 1. Install
pnpm install

# 2. Environment
cp .env.example .env
# Edit .env if needed (defaults work with Docker Compose below)

# 3. Start infrastructure (PostgreSQL, Redis, NATS)
cd packages/infra && docker compose up -d && cd ../..

# 4. Build (core first, then dependents)
pnpm build

# 5. Database: create DB, tables, and seed data
pnpm db:seed

# 6. Start API (port 3001)
pnpm --filter @v3grand/api dev

# 7. Start UI (port 3000) — in another terminal
pnpm --filter @v3grand/ui dev
```

Then open **http://localhost:3000/login** and sign in with a [demo account](#demo-credentials).

To run API and UI together (parallel):

```bash
pnpm dev
```

---

## Configuration

| Variable               | Description                    | Default (example)        |
|------------------------|--------------------------------|--------------------------|
| `DATABASE_URL`         | PostgreSQL connection string   | `postgres://postgres:postgres@localhost:5432/v3grand` (Docker) |
| `PORT`                 | API server port                | `3001`                   |
| `JWT_SECRET`           | Secret for signing JWTs        | Set in `.env` (e.g. 64-char hex) |
| `FRONTEND_URL`         | Allowed CORS origin for API     | `http://localhost:3000`  |
| `NEXT_PUBLIC_API_URL`  | API base URL used by the UI    | `http://localhost:3001`  |

Copy `.env.example` to `.env` and adjust. Never commit `.env`.

---

## Verification

**API responding (item 7)** — With the API running (e.g. after `./scripts/local-deploy.sh` or `pnpm --filter @v3grand/api dev`):

```bash
curl -s http://localhost:3001/health
# Expect: {"status":"ok","timestamp":"..."}
```

Or use the script (exits 0 if OK, 1 if not):

```bash
./scripts/verify-api.sh
# Override URL: API_URL=https://api.example.com ./scripts/verify-api.sh
```

**UI → API URL (item 8)** — Ensure `.env` has `NEXT_PUBLIC_API_URL` set to your API base (e.g. `http://localhost:3001` for local). Restart or rebuild the UI after changing it.

**End-to-end connectivity (item 9)** — Checklist:

1. **API up** — `curl -s http://localhost:3001/health` returns `{"status":"ok",...}` or run `./scripts/verify-api.sh`.
2. **UI env** — `NEXT_PUBLIC_API_URL` in `.env` points to that API URL.
3. **Login** — Open http://localhost:3000/login, sign in with `lead@v3grand.com` / `demo123`; no CORS or network errors.
4. **Dashboard** — Open a deal and confirm the dashboard and data load.

---

## Scripts

From the **repository root**:

| Script         | Description |
|----------------|-------------|
| `pnpm install` | Install dependencies for all packages |
| `pnpm build`   | Turborepo build (respects dependency order) |
| `pnpm dev`     | Run API and UI in parallel (persistent, no cache) |
| `pnpm test`    | Run tests in all packages (e.g. Vitest in engines) |
| `pnpm lint`    | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:seed` | Run DB seed (`@v3grand/db`): create DB, tables, demo users, V3 Grand deal, construction data, risks, initial engine results |
| `pnpm db:migrate` | Run DB migrations (if/when migrations are added) |
| `./scripts/verify-api.sh` | Check API health (exits 0 if `GET /health` returns ok) |
| `./scripts/local-deploy.sh` | One-command local deploy (Docker + build + seed + API + UI) |
| `./scripts/local-deploy-supabase.sh` | Local deploy using Supabase only (no Docker: migrations + seed + API + UI) |

Package-specific (examples):

- `pnpm --filter @v3grand/api dev` — API only  
- `pnpm --filter @v3grand/ui dev` — UI only  
- `pnpm --filter @v3grand/ui dev:clean` — UI with fresh Next.js cache (fixes 404s on CSS/JS)  
- `pnpm --filter @v3grand/db seed` — Seed only  

---

## Troubleshooting

**UI shows 404 for `/_next/static/...` (login or app looks broken)**  
Stop the dev server (Ctrl+C), clear the Next.js cache, then start again:

```bash
rm -rf packages/ui/.next
pnpm dev
```

Or run the UI with a clean cache only: `pnpm --filter @v3grand/ui dev:clean`

---

## Architecture

- **Data flow**: UI → API (REST) → services (recompute) → engines + db. Engines are pure functions; `recompute` runs Factor → Underwriter (×3 scenarios) → Monte Carlo → Budget → S-Curve → Decision and persists results.
- **Auth**: Email/password login; server issues JWT (HMAC SHA-256, 24h expiry). Middleware: `authGuard`, `attachUser`, `requireRole`.
- **Deal state**: Deal document stored as JSONB in `deals.snapshot`. Engine outputs and recommendations stored in `engineResults` and `recommendations` with versioning and scenario awareness.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/auth/login` | Login (email, password) → JWT |
| GET    | `/auth/me`    | Current user (requires auth) |
| GET    | `/deals`      | List deals |
| GET    | `/deals/:id`  | Deal by id (full snapshot) |
| PATCH  | `/deals/:id/assumptions` | Partial assumptions update + recompute |
| POST   | `/deals/:id/underwrite`  | Run underwriter (single scenario) |
| GET    | `/deals/:id/dashboard`   | Dashboard view (metrics, recommendation, activity) |
| GET    | `/deals/:id/scenarios`   | Bear/base/bull scenario results |
| PATCH  | `/deals/:id/active-scenario` | Set active scenario |
| GET    | `/deals/:id/construction/dashboard` | Construction summary |
| POST   | `/deals/:id/construction/change-orders` | Create change order |
| POST   | `/deals/:id/construction/change-orders/:coId/approve` | Approve CO (role-gated) |
| POST   | `/deals/:id/construction/rfis` | Create RFI |
| POST   | `/deals/:id/engines/factor` | Run factor engine |
| POST   | `/deals/:id/engines/montecarlo` | Run Monte Carlo |
| POST   | `/deals/:id/engines/budget` | Run budget analysis |
| POST   | `/deals/:id/engines/scurve` | Run S-curve |
| GET    | `/deals/:id/engines/:engine/latest` | Latest result for an engine |
| GET    | `/health`     | Health check |

---

## Demo credentials

| Email              | Password | Role          |
|--------------------|----------|---------------|
| lead@v3grand.com   | demo123  | lead-investor |
| co@v3grand.com     | demo123  | co-investor   |
| ops@v3grand.com    | demo123  | operator      |
| viewer@v3grand.com  | demo123  | viewer        |
| lp1@v3grand.com    | demo123  | co-investor   |
| lp2@v3grand.com    | demo123  | viewer        |

---

## Verified engine output (base scenario)

For the seeded V3 Grand Madurai deal, the Underwriter engine (base scenario) produces:

```
IRR:    19.8%   (vs WACC 13.8%)
NPV:    13.38 Cr
DSCR:   1.98x
Eq Mult: 5.61x
→ Decision: INVEST at high confidence
```

---

## Documentation

- **[docs/](docs/)** — Documentation index.
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — Prerequisites, step-by-step runbook, demo walkthroughs (dashboard, assumptions, scenarios, construction, risks), re-seeding, troubleshooting.
- **[docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md)** — Spec vs implementation: what’s implemented, what’s missing or partial, and overall completeness estimates.
- **[docs/GAP_ANALYSIS_ADDENDUM.md](docs/GAP_ANALYSIS_ADDENDUM.md)** — Addendum and **build & deploy readiness**: delta since original gap analysis, build/deploy checklists, and remaining actions.
- **[docs/GAP_ANALYSIS_VS_SPEC.md](docs/GAP_ANALYSIS_VS_SPEC.md)** — **Gap analysis vs. 5 PDF specs**: validation against the specification documents in `Documentation/` (Platform Blueprint, Implementation Plan, Developer Scaffolding, Execution Playbook, Next-Phase Roadmap).
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to set up for development, project structure, code standards, and PR guidelines.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and pull request process. Ensure `pnpm build`, `pnpm typecheck`, and `pnpm test` pass before submitting.

---

## License

See repository license file if present.
