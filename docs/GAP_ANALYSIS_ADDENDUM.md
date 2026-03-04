# Gap Analysis Addendum & Build/Deploy Readiness

**Date:** March 2025  
**Purpose:** (1) Re-verify implementation against the 5 PDF specification documents; (2) Assess readiness for **build** and **deploy**.

---

## 1. Scope and source documents

The original [GAP_ANALYSIS.md](GAP_ANALYSIS.md) compares the codebase to these **five PDF specification documents** (external to this repo):

| # | Document | Focus |
|---|----------|--------|
| 1 | **Platform Blueprint** | Domain model, event taxonomy, engine trigger matrix, workflow orchestration, service architecture |
| 2 | **Implementation Plan** | Tech stack, engine contracts, PostgreSQL schema, Temporal workflows, UI screen specs, alert rules |
| 3 | **Developer Scaffolding Guide** | Domain types, engine I/O DTOs, view DTOs, event definitions, engine skeletons |
| 4 | **Execution Playbook** | Sprint tasks, Zod schemas, auth spec, assumption editor spec |
| 5 | **Next-Phase Roadmap** | Layer 1 (Single-Deal MVP), Layer 2 (Events & Construction), Layer 3 (Multi-Deal & Hardening) |

**Note:** The PDFs are not stored in this repository. This addendum is based on the existing GAP_ANALYSIS plus a **fresh codebase review** to capture changes since the original analysis and to assess build/deploy readiness.

---

## 2. Delta since original gap analysis (now implemented)

The following items were previously marked **missing** or **partial** in [GAP_ANALYSIS.md](GAP_ANALYSIS.md) and are **now present** in the codebase:

### 2.1 Database (`packages/db`)

| Item | Status | Location |
|------|--------|----------|
| **deals.status / lifecycle_phase / current_month / version** | ✅ Implemented | `schema/index.ts`: `deals` table has `status`, `lifecyclePhase`, `currentMonth`, `version` columns (no longer single JSONB snapshot only). |
| **deal_access junction table** | ✅ Implemented | `deal_access` table with `userId`, `dealId`, `role`; `listDealsByUser`, `checkDealAccess`, `grantDealAccess`, `getDealAccessByDeal` in `queries/index.ts`. |
| **EngineResult stores input + output** | ✅ Implemented | `engine_results` has both `input` and `output` JSONB; `insertEngineResult` accepts both. |
| **risks / Risk Register table** | ✅ Implemented | `risks` table (title, description, category, likelihood, impact, status, mitigation, owner, createdBy); seed data for 4 sample risks. |
| **Budget line category** | ✅ Implemented | `budget_lines.category` (VARCHAR); seed uses categories (Land, Hard Costs, Soft Costs). |
| **Change order description, budget_line_id** | ✅ Implemented | `change_orders` has `description`, `budget_line_id` FK. |
| **RFI question, answer** | ✅ Implemented | `rfis` has `question`, `answer`, `answered_by`; `answerRFI` query. |
| **Milestone description, dependencies, percent_complete** | ✅ Implemented | `milestones` has `description`, `dependencies` JSONB, `percentComplete`. |
| **Domain events seq_no, idempotency_key** | ✅ Implemented | `domain_events` has `seq_no`, `idempotency_key`; insert/get/mark processed/failed/dead-letter. |
| **createUser** | ✅ Implemented | `queries/index.ts`: `createUser(db, { email, name, passwordHash, role })`. |
| **listDealsByUser (user-scoped deal list)** | ✅ Implemented | `listDealsByUser(db, userId)` using `deal_access`; used by `GET /deals`. |

### 2.2 API (`packages/api`)

| Item | Status | Location |
|------|--------|----------|
| **Deal list user-scoped** | ✅ Implemented | `GET /deals` uses `listDealsByUser` and `authGuard`; returns only deals the user has access to. |
| **Deal access check on GET /deals/:id** | ✅ Implemented | `checkDealAccess` before returning deal; 403 if no access. |
| **Risk register API** | ✅ Implemented | `GET /deals/:id/risks`, `POST /deals/:id/risks`, `PATCH /deals/:id/risks/:riskId` in `routes/risks.ts`. |
| **Recommendation history in dashboard** | ✅ Implemented | `GET /deals/:id/dashboard` returns `recommendationHistory` (latest 10 versions). |
| **Dashboard view includes recommendationHistory** | ✅ Implemented | `DealDashboardView` in core and API response include `recommendationHistory`. |

### 2.3 UI (`packages/ui`)

| Item | Status | Location |
|------|--------|----------|
| **Risks tab / Risk register UI** | ✅ Implemented | `RisksDashboard.tsx`, `use-risks.ts`; Risks tab on deal page. |
| **Recommendation history in dashboard** | ✅ Implemented | Consumed via `DealDashboardView.recommendationHistory` (API returns it). |

### 2.4 Seed (`packages/db/seed`)

| Item | Status | Location |
|------|--------|----------|
| **Deal access grants** | ✅ Implemented | Seed grants all demo users access to V3 Grand deal via `deal_access`. |
| **Deals table structure** | ✅ Implemented | Seed creates `deals` with `status`, `lifecycle_phase`, `current_month`, `version`, and all JSONB columns. |
| **Risks seed data** | ✅ Implemented | 4 sample risks (construction, market, financial, regulatory). |
| **domain_events and risks tables** | ✅ Implemented | Raw SQL in `run.ts` creates both tables. |

---

## 3. Remaining gaps (still missing or partial)

These remain as in the original GAP_ANALYSIS or have been re-confirmed:

- **Temporal / packages/workflows** — Not present; recompute is inline in API.
- **Event bus wiring** — EventBus/domain events exist but are not yet wired to trigger recompute or UI.
- **POST /deals** (create deal) — No deal creation endpoint.
- **POST /auth/register** — No user registration endpoint.
- **Alerts table and GET /deals/:id/alerts** — Not implemented.
- **Drizzle migrations** — No `migrate.ts`; seed uses raw SQL `CREATE TABLE IF NOT EXISTS`. The `package.json` script `"migrate": "tsx src/migrate.ts"` points to a **missing file**.
- **Production hardening** — No Dockerfile for API/UI, no Terraform/Helm, no production env validation (e.g. require `JWT_SECRET` in prod).
- **Observability** — No structured metrics/tracing; health check does not verify DB connectivity.

---

## 4. Build readiness

| Check | Status | Notes |
|-------|--------|--------|
| Monorepo builds | ✅ | `pnpm build` (Turbo) builds packages in order; `packages/core` → `engines` → `db` → `api` → `ui`. |
| TypeScript | ✅ | `pnpm typecheck` runs across packages. |
| Lint | ✅ | `pnpm lint` available. |
| Tests | ⚠️ | `pnpm test` runs Vitest in engines; coverage is minimal (e.g. only underwriter test). CI uses `continue-on-error: true` for typecheck and test. |
| DB at build time | ⚠️ | API and db packages do not require a live DB for `tsc`/build; seed and runtime do. CI provides `DATABASE_URL` for build step. |
| Missing script | ⚠️ | `pnpm db:migrate` runs `tsx src/migrate.ts` but **migrate.ts does not exist**; either add a no-op migrate script or remove the script. |

**Verdict:** The app **builds** successfully. Fixing the `db:migrate` script reference is recommended so `pnpm db:migrate` does not fail.

---

## 5. Deploy readiness

| Check | Status | Notes |
|-------|--------|--------|
| Health endpoint | ✅ | `GET /health` returns `{ status: 'ok', timestamp }`. |
| DB connectivity check | ❌ | Health does not verify DB; recommend adding a simple query (e.g. `SELECT 1`) or a `/health/ready` that fails if DB is down. |
| Config from env | ✅ | `config.ts` uses `DATABASE_URL`, `PORT`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`. |
| JWT secret in prod | ⚠️ | Default `jwtSecret` is a dev fallback; production should set `JWT_SECRET` and ideally validate it is not the default. |
| CORS | ✅ | Configurable via `FRONTEND_URL`. |
| Docker (app) | ❌ | No Dockerfile for API or UI; only `packages/infra/docker-compose.yml` for Postgres + Redis. |
| Migrations | ❌ | No migration pipeline; seed creates tables with raw SQL. For production, recommend Drizzle migrations and a migrate step in deploy. |
| CI/CD | ✅ | `.github/workflows/ci.yml` runs on push/PR: install, typecheck, build, test. |
| Production deploy config | ❌ | No Terraform, Helm, or deploy scripts. |

**Verdict:** The app is **not fully deploy-ready** for production without:

1. **Database:** Either formalize migrations (Drizzle generate + migrate script) or document that deploy runs seed (not ideal for prod).
2. **Containers:** Dockerfiles for API and UI (and optionally a single docker-compose for app + infra) for consistent deploy.
3. **Health:** Optional but recommended: readiness check that hits the DB.
4. **Secrets:** Ensure `JWT_SECRET` (and any other secrets) are set in production and not default.

---

## 6. Checklist: “Ready for build and deploy”

Use this to close gaps before considering the app fully ready for build and deploy.

### Build

- [x] `pnpm install` succeeds
- [x] `pnpm build` succeeds
- [x] `pnpm typecheck` passes (or is fixed)
- [ ] **Fix or remove `db:migrate`** — Add `packages/db/src/migrate.ts` (e.g. run Drizzle migrate) or remove the script from `package.json`
- [ ] (Optional) Improve test coverage and make CI fail on test failure

### Deploy (minimum)

- [ ] **Migrations:** Introduce Drizzle migrations and a single entrypoint (e.g. `pnpm db:migrate`) that applies them; do not rely on seed to create schema in prod
- [ ] **Readiness:** Add a readiness check (e.g. `GET /health/ready`) that verifies DB connectivity
- [ ] **Containers:** Add Dockerfiles for API and UI (and optionally docker-compose for full stack)
- [ ] **Secrets:** Document and enforce production env (e.g. `JWT_SECRET` required, no default in prod)
- [ ] (Optional) Production deploy config (Terraform/Helm/scripts) and CI deploy step

### Spec alignment (from PDFs)

- See [GAP_ANALYSIS.md](GAP_ANALYSIS.md) for full list. High-impact items still open: Temporal workflows, event bus wiring, deal creation, user registration, alerts, and production infra.

---

## 7. Summary

| Dimension | Build ready | Deploy ready |
|-----------|-------------|--------------|
| Codebase | ✅ Yes | ⚠️ Partial |
| Tests | ⚠️ Minimal | ⚠️ Minimal |
| CI | ✅ Yes | ✅ Yes (no deploy step) |
| DB schema / migrations | ⚠️ Seed-only | ❌ No migrations |
| Health / readiness | ✅ Basic health | ❌ No DB check |
| Containers / deploy config | ❌ No app images | ❌ No |

**Conclusion:** The app **builds** and runs locally with seed data and is suitable for **staging/demo deploy** if you run seed and set env. For **production-style build and deploy**, complete the deploy checklist above (migrations, readiness, Dockerfiles, secrets) and refer to the 5 PDF specs and [GAP_ANALYSIS.md](GAP_ANALYSIS.md) for full spec alignment.
