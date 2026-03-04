# Gap Analysis vs. Specification Documents

**Date:** March 2026  
**Source:** The 5 comprehensive PDFs in `Documentation/` at the repository root.  
**Purpose:** Validate the v3grand-slice codebase against the specifications and identify gaps for build and deploy readiness.

---

## 1. Source Documents

| Document | Path | Focus |
|----------|------|--------|
| **Platform Blueprint v2** | `Documentation/V3-Grand-Platform-Blueprint-v2.pdf` | Domain model, event taxonomy, engine trigger matrix, workflows (Temporal-style), service architecture, roles, UI consumption pattern |
| **Implementation Plan** | `Documentation/V3-Grand-Implementation-Plan.pdf` | MVP scope, tech stack, engine contracts, PostgreSQL schema (BIGINT paisa), Temporal workflows, UI screens, delivery plan |
| **Developer Scaffolding Guide** | `Documentation/V3-Grand-Developer-Scaffolding.pdf` | Monorepo layout, domain types & DTOs, engine I/O, view DTOs, event types & envelope, API routes, DB schema, UI contracts |
| **Execution Playbook** | `Documentation/V3-Grand-Execution-Playbook.pdf` | Sprint 1 tasks (Zod schemas, PATCH validation, auth, assumption UI, revaluation, history, RoleGate, smoke tests, Docker/README) |
| **Next-Phase Roadmap** | `Documentation/V3-Grand-Next-Phase-Roadmap.pdf` | Layer 1 (Single-Deal MVP), Layer 2 (Events & Construction), Layer 3 (Multi-Deal & Hardening) |

All paths are relative to the repo root: `/Documentation/`.

---

## 2. Executive Summary

| Dimension | Spec (from PDFs) | Current Code | Gap Severity |
|-----------|------------------|--------------|--------------|
| **Domain model** | Deal + Property (roomTypes, amenities, landArea, grossBUA), CapexPlan phases/items, FinancingPlan, RiskRegister, DrawRequest, LifecyclePlan | Deal with normalized columns; Property/Partnership/assumptions in JSONB; risks table; no FinancingPlan, DrawRequest, deal_snapshots | Medium |
| **Events** | 15+ typed events, EventEnvelope (id, timestamp, source, payload), bus (NATS/Redis), trigger matrix | 3 event types in core; domain_events table with seq_no, idempotency; EventBus exists but **not wired** to routes/recompute | High |
| **Engines** | 6 engines, Factor/Underwriter/MC/Budget/S-Curve/Decision, sensitivity/rebase/history endpoints | All 6 engines implemented; no /sensitivity, /rebase, /history; buildAllScenarios not exposed; engine input+output stored | Low–Medium |
| **Workflows** | Temporal: MonthlyRevaluation, ChangeOrderApproval, OnAssumptionChange | **No** `packages/workflows`; recompute inline in API | High |
| **API** | REST + WebSocket, role matrix (ANALYST/INVESTOR/PM/AUDITOR/ADMIN), deal_access at query layer | REST only; roles lead-investor/co-investor/operator/viewer; deal_access implemented; user-scoped deal list | Medium |
| **DB** | Drizzle migrations, BIGINT paisa, deal_snapshots, alerts table | Seed creates tables (no Drizzle migrations); DECIMAL not paisa; no deal_snapshots; no alerts table | Medium |
| **UI** | Zustand, WebSocket, Recharts (MC histogram, S-curve, sparkline), RoleGate, RevalHistory, AlertBanner, 600ms debounce | React Query + context; no WebSocket; no Recharts; recommendation history in dashboard; no AlertBanner; no 600ms debounce; sessionStorage for auth (spec: in-memory) | Medium |
| **Auth** | Clerk/Auth0 or JWT (@fastify/jwt), bcrypt, 5 roles | Custom JWT (HMAC), scrypt, 4 role names | Low–Medium |
| **Build & deploy** | CI (typecheck, lint, test, build), Dockerfiles, migrations, health/ready | CI present; no Dockerfiles for API/UI; migrate script no-op; health has no DB check | Medium |

---

## 3. Validation by Package (vs. All 5 PDFs)

### 3.1 packages/core

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Deal: id, name, assetClass, status, lifecyclePhase, currentMonth, version, property, partnership, assumptions, capex, opex, scenarios | Blueprint, Scaffolding | ✅ | Types align; deal row has normalized columns in DB. |
| Property: location, landArea, grossBUA, keys, roomTypes[], amenities[], starRating | Scaffolding, Impl Plan | ⚠️ | Partial: location, keys, starRating in seed; no landArea, grossBUA, roomTypes[], amenities[] in type. |
| MarketAssumptions: segments[], revenueMix, seasonality[], compSet[] | Scaffolding | ⚠️ | revenueMix in seed; no segments, seasonality[], compSet[] in type. |
| FinancialAssumptions: debtTenorYears, incentiveFeePct, ffAndEReservePct, workingCapitalDays | Scaffolding | ✅ | Present in seed/types. |
| CapexPlan: phase1/phase2 with CapexLineItem (startMonth, endMonth, curveType) | Blueprint, Scaffolding | ⚠️ | Phase1/phase2 with items in seed; items have category, budgetAmount not full line-item spec. |
| OpexModel: departments, undistributed, fixedCharges, fixedVarSplit, fixedFloorMonthly, gmSavingsPct | Scaffolding | ⚠️ | departments, managementFee; missing undistributed, fixedCharges, etc. |
| Risk type: category, probability (1–5), impact (1–5), riskScore, mitigation, costExposureCr | Scaffolding | ⚠️ | Risks table has category, likelihood/impact as strings; no riskScore, costExposureCr in core type. |
| RecommendationState: factorSnapshot, proformaSnapshot, mcSnapshot, gateResults, flipConditions | Blueprint, Scaffolding | ✅ | recommendation row has proformaSnapshot, gateResults; factor/mc snapshots optional in spec. |
| EngineResult: input + output JSONB | Scaffolding, Impl Plan | ✅ | engine_results stores both. |
| EventEnvelope: id, timestamp, source, payload | Scaffolding | ❌ | Not in core. |
| 15+ domain event types | Blueprint | ⚠️ | Only 3 in core (assumption.updated, engine.completed, recommendation.changed). |
| Zod schemas with .describe() min/max/step/unit for assumptions | Execution Playbook Task 1 | ❌ | Schemas exist; no .describe() JSON metadata for sliders. |
| DealDashboardView: constructionProgress, recentEvents, recommendationHistory | Scaffolding | ✅ | Dashboard view has recentAudit, recommendationHistory; constructionSummary. |
| ScenarioExplorerView: mcSummary, factorSummary, comparisonTable | Scaffolding | ⚠️ | Scenarios API returns proforma per scenario; no factorSummary/mcSummary in view. |
| BudgetTrackerView: sCurveChart, topVariances, riskExposure | Scaffolding | ❌ | No dedicated budget-tracker view DTO/route. |

### 3.2 packages/engines

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Factor: scoreFactors(input) → FactorScoreOutput; domains global/local/asset/sponsor | Scaffolding, Impl Plan | ✅ | Implemented; weights differ from spec (0.25/0.25/0.30/0.20 vs 0.20/0.25/0.35/0.20). |
| /factor/sensitivity, /factor/history | Blueprint, Impl Plan | ❌ | Not implemented. |
| Underwriter: buildProForma, buildAllScenarios(deal) | Scaffolding, Impl Plan | ✅ / ⚠️ | buildProForma exists; buildAllScenarios not exported (recompute does 3 calls). |
| /underwrite/sensitivity, /underwrite/rebase | Blueprint, Impl Plan | ❌ | Not implemented. |
| Monte Carlo: 3000 iter default, probPhase2Trigger, sensitivityRanking | Scaffolding | ✅ / ⚠️ | 5000 iter; histogram; no probPhase2Trigger in output. |
| /mc/stress | Impl Plan | ❌ | Not implemented. |
| Budget: byCostCode, sCurveData in output | Scaffolding | ⚠️ | Variance and alerts; no sCurveData, byCostCode in engine output. |
| S-Curve: distribute; /scurve/rebase | Impl Plan | ✅ / ❌ | distribute implemented; no rebase endpoint. |
| Decision: evaluate with gateResults, flipConditions, riskFlags | Scaffolding, Impl Plan | ✅ | Implemented. scheduleRiskFlags input not in DecisionInput. |
| Shared: IRR (Newton-Raphson), NPV, distributions, percentile | Scaffolding | ✅ | Implemented. |
| Test coverage: all engines with golden values | Scaffolding, Execution Playbook | ⚠️ | Only underwriter test; no Factor/MC/Budget/Decision/S-Curve tests. |

### 3.3 packages/db

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| deals: id, name, status, lifecycle_phase, current_month, version + JSONB columns | Impl Plan, Scaffolding | ✅ | Matches. |
| deal_snapshots (deal_id, version, snapshot JSONB) | Impl Plan, Scaffolding | ❌ | Not present. |
| engine_results: input + output JSONB, versioned | Impl Plan | ✅ | Implemented. |
| recommendations: version, verdict, confidence, gate_results, factor_snapshot, proforma_snapshot, mc_snapshot | Impl Plan | ✅ | proformaSnapshot, gateResults; factorSnapshot/mcSnapshot not required in current API. |
| budget_lines: BIGINT paisa, category enum | Impl Plan | ⚠️ | DECIMAL(15,2); category as varchar. |
| rfis: cost_impact, schedule_impact_days, assignee | Impl Plan, Scaffolding | ✅ | question, answer, status; costImpact/scheduleImpact in schema as optional. |
| change_orders: budget_line_id, rfi_id, amount, status | Impl Plan | ✅ | budgetLineId, description, amount, status. |
| domain_events: seq_no, idempotency_key, status | Roadmap Layer 2 | ✅ | Implemented. |
| risks table | Blueprint, Roadmap | ✅ | Implemented with category, likelihood, impact, status, mitigation. |
| deal_access junction (user_id, deal_id, role) | Impl Plan, Roadmap | ✅ | Implemented; listDealsByUser, checkDealAccess. |
| users: email, passwordHash, role | Execution Playbook | ✅ | Implemented; scrypt not bcrypt. |
| alerts table (type, severity, message, acknowledged) | Roadmap Layer 2 | ❌ | Not implemented. |
| Drizzle migrations (drizzle-kit generate, numbered SQL) | Impl Plan, Roadmap | ❌ | Schema in code; seed uses raw SQL CREATE TABLE; no migration files. |
| Monetary as BIGINT paisa | Impl Plan | ❌ | DECIMAL/real used. |

### 3.4 packages/api

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Fastify, CORS, auth middleware | Impl Plan | ✅ | Implemented. |
| POST /auth/login, GET /auth/me | Scaffolding, Execution Playbook | ✅ | Implemented. |
| POST /auth/register (admin-only) | Roadmap | ❌ | Not implemented. |
| JWT: @fastify/jwt, HS256, 24h, role in claim | Execution Playbook Task 4 | ⚠️ | Custom JWT (HMAC); 24h; role in token. |
| GET /deals (user-scoped via deal_access) | Impl Plan, Roadmap | ✅ | listDealsByUser. |
| GET /deals/:id (with access check) | Impl Plan | ✅ | checkDealAccess. |
| POST /deals (create deal) | Roadmap Layer 3 | ❌ | Not implemented. |
| PATCH /deals/:id/assumptions (Zod validation, return dashboard view) | Execution Playbook Task 2 | ✅ | Merge patch; recompute; return recommendation/proforma; no Zod on PATCH body. |
| POST /deals/:id/underwrite (optional advanceMonth) | Roadmap Layer 1, Execution Playbook Task 7 | ❌ | Recompute exists; no advanceMonth parameter. |
| GET /deals/:id/dashboard (DealDashboardView) | Impl Plan | ✅ | Returns view with recommendationHistory, constructionSummary. |
| GET /deals/:id/scenarios | Impl Plan | ✅ | Bear/base/bull proforma + recommendation. |
| GET /deals/:id/recommendations/history | Impl Plan | ⚠️ | History embedded in dashboard; no dedicated GET /history. |
| Engine routes: POST /deals/:id/engines/factor|underwriter|montecarlo|budget|scurve, GET .../latest | Impl Plan | ✅ | Implemented; scenario-aware where needed. |
| GET /deals/:id/construction/dashboard, POST change-orders, approve | Impl Plan, Roadmap | ✅ | Construction routes; CO approve triggers recompute. |
| GET/POST/PATCH /deals/:id/risks | Roadmap | ✅ | Implemented. |
| GET /deals/:id/alerts | Roadmap Layer 2 | ❌ | No alerts table/route. |
| WebSocket /deals/:id/events | Blueprint, Impl Plan | ❌ | Not implemented. |
| Event bus: persist then emit; subscribers trigger recompute | Roadmap Layer 2 | ❌ | EventBus + domain_events exist; not wired to routes or recompute. |
| Recompute service: Factor → Underwriter(×3) → MC → Budget → S-Curve → Decision | Impl Plan | ✅ | Implemented. |

### 3.5 packages/ui

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Next.js 14 App Router, React Query | Impl Plan | ✅ | Implemented. |
| Zustand for client state | Impl Plan, Scaffolding | ❌ | Context only. |
| Auth: JWT in-memory only (no sessionStorage) | Execution Playbook Task 6 | ⚠️ | sessionStorage used. |
| Login page, redirect to deal | Impl Plan | ✅ | Login → deals list → deal. |
| Deal list (portfolio) | Roadmap | ✅ | User-scoped deal list. |
| Dashboard tab: RecommendationCard, MetricsStrip, CashFlowTable, recommendation history | Impl Plan | ✅ | Implemented. |
| Assumptions tab: sliders from Zod .describe(), 600ms debounce | Execution Playbook Task 5, 8 | ⚠️ | Sliders present; no .describe() metadata; no 600ms debounce. |
| Scenarios tab: Bear/Base/Bull, promote active | Impl Plan | ✅ | Implemented. |
| Construction tab: budget, milestones, RFIs, change orders | Impl Plan, Roadmap | ✅ | ConstructionDashboard. |
| Risks tab | Roadmap | ✅ | RisksDashboard. |
| RevalHistory table (version, verdict, confidence, IRR, NPV) | Roadmap Layer 1, Execution Playbook Task 8 | ⚠️ | recommendationHistory in dashboard view; no dedicated RevalHistory component. |
| Run Monthly Revaluation button, Month N badge | Execution Playbook Task 9 | ❌ | Recompute button exists; no advanceMonth; no Month badge. |
| RoleGate (hide Assumptions/Revaluation for INVESTOR) | Execution Playbook Task 10 | ⚠️ | Construction tab gated by role; no ANALYST/INVESTOR/ADMIN matrix. |
| Recharts: MC histogram, S-curve chart, sparkline, Factor radar | Impl Plan, Scaffolding | ❌ | No charts. |
| AlertBanner for unacknowledged alerts | Roadmap Layer 2 | ❌ | Not implemented. |
| WebSocket subscription for real-time updates | Blueprint, Impl Plan | ❌ | Not implemented. |

### 3.6 packages/infra

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Docker Compose: Postgres, Redis | Impl Plan | ✅ | Postgres 16, Redis 7. |
| Healthchecks (pg_isready, redis ping) | Execution Playbook Task 12 | ✅ | In docker-compose. |
| NATS, Temporal | Impl Plan | ❌ | Not in compose. |
| Dockerfiles for API, UI | Impl Plan | ❌ | Not present. |

### 3.7 packages/workflows

| Spec Requirement | Document | Status | Notes |
|------------------|----------|--------|-------|
| Temporal package: workflows + activities | Impl Plan, Scaffolding | ❌ | Package does not exist. |
| MonthlyRevaluation workflow | Blueprint, Impl Plan | ❌ | Recompute is inline in API. |
| ChangeOrderApproval workflow (routing by amount, 72h escalation) | Blueprint, Impl Plan | ❌ | CO approval in route handler. |
| OnAssumptionChange workflow | Impl Plan | ❌ | PATCH assumptions calls recompute directly. |

---

## 4. Role and Auth Alignment

| Spec (Execution Playbook, Roadmap) | Code | Gap |
|------------------------------------|------|-----|
| Roles: ANALYST, INVESTOR, PM, AUDITOR, ADMIN | lead-investor, co-investor, operator, viewer | Different names and count; permission matrix differs. |
| INVESTOR: read-only dashboard, no Assumptions, no Revaluation | viewer/co-investor: read; lead/operator: more access | Partial; no explicit ANALYST/ADMIN for revaluation. |
| Password hashing: bcrypt | scrypt | Different algorithm. |
| @fastify/jwt | Custom JWT | Different implementation. |

---

## 5. Build and Deploy Readiness (vs. Specs)

| Criterion | Spec | Current |
|-----------|------|---------|
| **Build** | pnpm build, typecheck, lint, test | ✅ build; typecheck/test in CI with continue-on-error. |
| **Migrations** | Drizzle migrations, db:migrate | ❌ No migration files; db:migrate is no-op. |
| **Seed** | Idempotent seed, ON CONFLICT | ✅ Seed creates tables and data. |
| **Health** | /health, optional /health/ready with DB | ✅ /health only; no DB check. |
| **Secrets** | JWT_SECRET, DATABASE_URL, etc. | ✅ .env.example; config from env. |
| **CI** | typecheck, lint, test, build | ✅ All run; test/typecheck non-blocking. |
| **Containers** | Dockerfiles for API, UI | ❌ Missing. |
| **Production deploy** | Terraform/Fly.io, migrations, observability | ❌ Not in repo. |

**Verdict:** The app **builds** and runs for **local/demo** with seed. For **production** build and deploy per the PDFs, add: Drizzle migrations, readiness check, Dockerfiles, and (per spec) event bus wiring, Temporal workflows, and role/schema alignment.

---

## 6. Recommendations

1. **Documentation folder:** Keep the 5 PDFs in `Documentation/` and reference them in README and this gap analysis.
2. **High-impact gaps (for full spec compliance):**  
   - Wire event bus to mutations and recompute (or document that recompute is synchronous by design for the slice).  
   - Add `packages/workflows` with Temporal (or document deferral to post-slice).  
   - Add Drizzle migrations and migrate script; optionally move monetary to paisa (BIGINT).  
   - Add alerts table and GET /deals/:id/alerts; optional AlertBanner in UI.  
   - Align roles with spec (ANALYST/INVESTOR/PM/AUDITOR/ADMIN) if product requires it.
3. **Medium-impact (polish):**  
   - Zod .describe() for assumption sliders; 600ms debounce in UI.  
   - GET /deals/:id/history (revaluation history); RevalHistory component.  
   - advanceMonth in POST /underwrite; Month N badge.  
   - WebSocket for real-time updates; Recharts for MC histogram, S-curve.
4. **Build/deploy:** Add Dockerfiles for API and UI; add /health/ready with DB check; enforce JWT_SECRET in production.

---

## 7. References

- **Existing gap analysis:** [docs/GAP_ANALYSIS.md](GAP_ANALYSIS.md) (earlier, broader narrative).  
- **Build & deploy addendum:** [docs/GAP_ANALYSIS_ADDENDUM.md](GAP_ANALYSIS_ADDENDUM.md).  
- **Spec PDFs:** `Documentation/V3-Grand-*.pdf` (5 files).

This document is the **authoritative gap analysis** against the five specification PDFs in `Documentation/`.
