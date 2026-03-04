# V3 Grand Madurai — Comprehensive Gap Analysis

**Date:** June 2025
**Scope:** Comparison of 5 PDF specification documents vs. the current `v3grand-slice` implementation.

**Source Documents:**
1. *Platform Blueprint* — Domain model, event taxonomy, engine trigger matrix, workflow orchestration, service architecture
2. *Implementation Plan* — Tech stack, engine contracts, PostgreSQL schema, Temporal workflows, UI screen specs, alert rules
3. *Developer Scaffolding Guide* — Detailed domain types, engine I/O DTOs, view DTOs, event definitions, engine skeletons
4. *Execution Playbook* — Sprint tasks (12 for Sprint 1), Zod schemas, auth spec, assumption editor spec
5. *Next-Phase Roadmap* — 3 layers: Single-Deal MVP (Layer 1), Events & Construction (Layer 2), Multi-Deal & Hardening (Layer 3)

---

## A. WHAT IS IMPLEMENTED

### A.1 — `packages/core` (Domain Types & Schemas)

| Feature | Status | Notes |
|---------|--------|-------|
| `Deal` type | ✅ Implemented | Includes id, name, property, partnership, assumptions, capex, opex, scenarios, macroIndicators |
| `Property` type | ⚠️ Partial | Missing `landArea`, `grossBUA`, `roomTypes[]`, `amenities[]`, `lat`, `lng` from Scaffolding spec. Only `assetClass: 'hotel'` (spec allows multiple). Missing `starRating`. |
| `Partnership` / `Partner` types | ✅ Implemented | Matches spec. |
| `MarketAssumptions` type | ⚠️ Partial | Missing `segments[]` (MarketSegment with pctMix, adrPremium, seasonality), `revenueMix`, `seasonality[]` (12 monthly multipliers), `compSet[]` from Scaffolding spec. |
| `FinancialAssumptions` type | ⚠️ Partial | Missing `incentiveFeePct`, `ffAndEReservePct`, `workingCapitalDays`, `debtTenorYears` from spec. Has most core fields. |
| `CapexPlan` type | ⚠️ Partial | Flat structure (`totalInvestment`, `landCostCr`, etc.) vs spec's `phase1`/`phase2` with `CapexPhase[]` containing `CapexLineItem[]` with `startMonth`, `endMonth`, `curveType`. Missing per-item granularity. |
| `OpexModel` type | ⚠️ Partial | Has `departments` and `managementFee`, but missing `undistributed` departments, `fixedCharges`, `fixedVarSplit`, `fixedFloorMonthly`, `gmSavingsPct` per USALI spec. |
| `Scenario` / `ScenarioSet` types | ✅ Implemented | Bear/base/bull with occupancy, ADR, margin, phase2. Matches spec. |
| `MacroIndicators` type | ✅ Implemented | repoRate, cpi, hotelRevParIndex, stateGdpGrowth, airTrafficGrowth. |
| `ProFormaInput` / `Output` types | ✅ Implemented | 10-year projections, IRR, NPV, equity multiple, DSCR, payback. |
| `DecisionInput` / `Output` types | ✅ Implemented | Verdict, confidence, gates, explanation, flipConditions, riskFlags. |
| `FactorScoreInput` / `Output` types | ✅ Implemented | Composite score, domain scores, required return. |
| `MCInput` / `MCOutput` types | ✅ Implemented | Percentile sets, prob metrics, histogram, sensitivity ranking. |
| `BudgetAnalysisInput` / `Output` types | ✅ Implemented | Budget lines, variance, alerts. |
| `SCurveInput` / `Output` types | ✅ Implemented | Monthly/cumulative cashflows. |
| `RecommendationState` type | ✅ Implemented | Verdict, confidence, version, gates, flip detection. |
| `AuditLogEntry` type | ✅ Implemented | Matches spec shape. |
| `EngineResult` type | ✅ Implemented | Versioned, engine-specific result storage. |
| `BudgetLine` type | ⚠️ Partial | Missing `category` enum (CIVIL\|MEP\|INTERIORS\|FF_E\|SOFT_COSTS\|CONTINGENCY), `month`, `varianceToPlanned`, `varianceToCurrent`. Flatter than spec. |
| `ChangeOrder` type | ⚠️ Partial | Missing `description`, `scheduleImpactDays`, `approverRole`, `affectedCostCodes[]`, `impactAssessment` JSONB. Simplified vs spec. |
| `RFI` type | ⚠️ Partial | Missing `description`, `priority` field, `scheduleImpactDays`. |
| `Milestone` type | ⚠️ Partial | Missing `blockers` field, `actualMonth`. Has `actualDate` instead of month-based tracking. |
| `ConstructionSummary` / Views | ✅ Implemented | Dashboard aggregation types present. |
| `DealDashboardView` DTO | ⚠️ Partial | Missing `constructionProgress`, `recentEvents`, `recommendationHistory` from spec. Simplified `latestProforma`/`latestMC`/`latestFactor` shapes. |
| `ScenarioExplorerView` DTO | ⚠️ Partial | Has comparison rows but not the full `mcSummary`/`factorSummary` + pivoted table structure from spec. |
| `BudgetTrackerView` DTO | ⚠️ Partial | Missing `sCurveChart`, `topVariances`, `riskExposure` from spec. |
| Zod Schemas | ⚠️ Partial | Core schemas exist (MarketAssumptions, FinancialAssumptions, Property, Partnership, CapexPlan, OpexModel, Scenarios, MacroIndicators). **Missing `.describe()` JSON metadata** for slider min/max/step/unit as specified in Execution Playbook Task 1. |
| `AssumptionPatchSchema` | ✅ Implemented | Partial update schema with at-least-one-field validation. |
| Domain Events types | ⚠️ Minimal | Only 3 event types defined (`assumption.updated`, `engine.completed`, `recommendation.changed`). Spec defines **15+ event types** including `macro.refreshed`, `phase.advanced`, `milestone.completed`, `milestone.delayed`, `budget.actual.updated`, `rfi.created`, `rfi.resolved`, `change-order.submitted`, `change-order.approved`, `risk.escalated`, `covenant.breached`, `tranche.drawn`, `actuals.reported`, `phase2-gate.evaluated`. |
| `EventEnvelope` wrapper | ❌ Missing | Spec defines a standard envelope with `id`, `timestamp`, `source`, `payload`. Not implemented. |
| `Risk` type | ❌ Missing | Full risk register entity with category, probability, impact, riskScore, mitigation, costExposure. |
| `FinancingPlan` / `DebtTranches` | ❌ Missing | Debt tranche tracking, covenants, drawdown schedule. |
| `DrawRequest` type | ❌ Missing | Construction draw request tracking. |
| `LifecyclePlan` / `Tasks` types | ❌ Missing | Lifecycle phase management with tasks. |
| `RoomType` type | ❌ Missing | Room type mix with count, sqft, ADR premium. |
| Multiple Asset Classes | ❌ Missing | Only `hotel`. Spec envisions extensibility to other asset classes. |

### A.2 — `packages/engines` (Computation Engines)

| Feature | Status | Notes |
|---------|--------|-------|
| **Underwriter Engine** | ✅ Implemented | Full 10-year hotel pro forma. ~130 lines of real financial calc. Occupancy ramp, ADR growth, GOP, EBITDA, debt service, FCFE, IRR, NPV, equity multiple, payback, DSCR. |
| `buildAllScenarios()` | ❌ Missing | Spec defines a `buildAllScenarios(deal)` convenience function. Recompute service does this manually. |
| Underwriter `/rebase` endpoint | ❌ Missing | Rebased pro forma incorporating actuals and approved COs. |
| Underwriter `/sensitivity` | ❌ Missing | 2-parameter sensitivity matrix. |
| **Decision Engine** | ✅ Implemented | 6 core gates + optional MC/Factor/Budget gates. Verdict, confidence, flip detection, risk flags. Well-implemented. |
| `scheduleRiskFlags` input | ❌ Missing | Spec adds `scheduleRiskFlags?: string[]` for milestone delay integration in DecisionInput. |
| **Factor Engine** | ✅ Implemented | 4-domain scoring (Global 0.25, Local 0.25, Asset 0.30, Sponsor 0.20). 17 factors. Composite score and implied required return. |
| Factor domain weights | ⚠️ Differs | Implementation: Global 0.25, Local 0.25, Asset 0.30, Sponsor 0.20. Scaffolding spec: Global 0.20, Local 0.25, Asset 0.35, Sponsor 0.20. **Weights differ.** |
| Factor `/sensitivity` | ❌ Missing | Spec defines factor sensitivity analysis endpoint. |
| Factor `/history` | ❌ Missing | Spec defines versioned factor history endpoint. |
| Hardcoded Madurai logic | ⚠️ Present | `scoreMaduraiLocal()` has hardcoded values. Non-extensible for other locations. |
| **Monte Carlo Engine** | ✅ Implemented | Full simulation with triangular/logNormal distributions, seeded PRNG, Pearson correlation sensitivity. Histogram. Default 5000 iterations (spec says 3000). |
| MC `/stress` endpoint | ❌ Missing | Spec defines stress scenario simulation (recession, rate-shock). |
| `probPhase2Trigger` | ❌ Missing | Spec includes probability of Phase 2 trigger in MC output. |
| **Budget Variance Engine** | ✅ Implemented | Per-line variance with GREEN/AMBER/RED thresholds. Portfolio alerts. |
| `sCurveData` in output | ❌ Missing | Spec includes S-curve overlay data (planned vs actual vs forecast by month) in budget output. |
| `byCostCode` breakdown | ❌ Missing | Spec includes per-cost-code variance breakdown. |
| **S-Curve Engine** | ✅ Implemented | 4 curve types (logistic, linear, front-loaded Beta(2,5), back-loaded Beta(5,2)). Monthly/cumulative cashflows. |
| **Shared: IRR solver** | ✅ Implemented | Newton-Raphson with convergence check. |
| **Shared: NPV calculator** | ✅ Implemented | Standard discounted NPV. |
| **Shared: Distributions** | ✅ Implemented | Seeded PRNG (Mulberry32), triangular, Box-Muller normal, logNormal, clamp. |
| **Shared: Percentile** | ✅ Implemented | Linear interpolation + histogram builder. |
| Vitest test suite | ⚠️ Minimal | Only `underwriter/index.test.ts` exists. No tests for other 5 engines. |
| Engine snapshot storage (input) | ❌ Missing | Spec's `EngineResult` stores both `input` and `output` JSONB. Implementation only stores output. |

### A.3 — `packages/db` (Database Layer)

| Feature | Status | Notes |
|---------|--------|-------|
| `users` table | ✅ Implemented | id, email, name, role, passwordHash, dealIds (JSONB array). |
| `deals` table | ✅ Implemented | id, name, snapshot (full JSONB blob). |
| `engineResults` table | ✅ Implemented | Versioned, per-engine result storage. |
| `recommendations` table | ✅ Implemented | Version, scenario-aware. Has `factorSnapshot`, `proformaSnapshot`, `mcSnapshot`. |
| `auditLog` table | ✅ Implemented | Append-only with module, action, diff JSONB. |
| `budgetLines` table | ✅ Implemented | dealId, costCode, name, budgeted, committed, spent, forecast. |
| `changeOrders` table | ✅ Implemented | dealId, number, title, amount, status, rfiId FK. |
| `rfis` table | ✅ Implemented | dealId, number, title, status, costImpact, scheduleImpact. |
| `milestones` table | ✅ Implemented | dealId, name, plannedDate, actualDate, status. |
| `domainEvents` table | ✅ Implemented | dealId, eventType, payload JSONB, status (pending/processed/failed/dead-letter), processedAt, error, retryCount. |
| `deals.status` / `lifecycle_phase` / `current_month` columns | ❌ Missing | Spec has these as separate columns. Implementation uses a single JSONB `snapshot`. |
| `deals.version` column | ❌ Missing | Spec tracks deal version for optimistic concurrency. |
| `deal_snapshots` table | ❌ Missing | Spec has separate versioned snapshot table (deal_id + version → JSONB). |
| `deal_access` junction table | ❌ Missing | Spec calls for proper many-to-many user↔deal. Current impl uses JSONB array in users table. |
| `alerts` table | ❌ Missing | Spec defines alerts with type, severity, message, metadata, acknowledged flag. |
| `risks` / Risk Register table | ❌ Missing | Risk entity with category, probability, impact, mitigation. |
| `financing_plan` / `debt_tranches` table | ❌ Missing | DebtTranches, covenants, drawdown schedule. |
| `draw_requests` table | ❌ Missing | Construction draw request tracking. |
| Budget line `category` enum column | ❌ Missing | Spec uses CIVIL\|MEP\|INTERIORS\|FF_E\|SOFT_COSTS\|CONTINGENCY. |
| Budget line `status` enum column | ❌ Missing | Spec uses PLANNED\|COMMITTED\|INVOICED\|PAID. |
| Milestone `blockers` column | ❌ Missing | Text field for blocked-by description. |
| Generated variance column | ❌ Missing | Spec uses `variance` as a generated (computed) column. |
| Monetary values as integers (paisa) | ❌ Not followed | Spec mandates BIGINT in paisa to avoid float errors. Impl uses `real` and `integer`. |
| Seed: 5 users (one per role) | ⚠️ Partial | Seed exists in `v3grand.ts` but creates 4 users matching 4 roles (lead-investor, co-investor, operator, viewer). Spec calls for 5 roles (ANALYST, INVESTOR, PM, AUDITOR, ADMIN). |
| Seed: Construction data | ⚠️ Partial | Seed includes budget lines, milestones, change orders, RFIs. Could be richer per spec (~20 budget lines, 8 milestones). |
| Drizzle migrations | ❌ Missing | No migration files found. Schema is push-only. |
| Query: `createDeal()` | ❌ Missing | No deal creation query. |
| Query: `listDeals(userId)` | ❌ Missing | No filtered deal listing by user access. |
| Query: User registration | ❌ Missing | No `createUser()` query. |
| Query: Risk CRUD | ❌ Missing | No risk register queries. |

### A.4 — `packages/api` (Fastify Server)

| Feature | Status | Notes |
|---------|--------|-------|
| Fastify bootstrap | ✅ Implemented | CORS, PostgreSQL via postgres.js + Drizzle, route registration, health check. |
| `POST /auth/login` | ✅ Implemented | Email/password with scrypt hashing. |
| `GET /auth/me` | ✅ Implemented | Returns current user from JWT. |
| `GET /deals` | ✅ Implemented | Lists all deals (no user-scoping). |
| `GET /deals/:id` | ✅ Implemented | Returns full deal snapshot. |
| `PATCH /deals/:id/assumptions` | ✅ Implemented | Zod-validated partial update + auto-recompute cascade. |
| `POST /deals/:id/underwrite` | ✅ Implemented | Runs underwriter for a deal. |
| `GET /deals/:id/dashboard` | ✅ Implemented | Aggregated dashboard view with metrics, recommendation, recent activity. |
| `GET /deals/:id/scenarios` | ✅ Implemented | Bear/base/bull scenario results. |
| `PATCH /deals/:id/active-scenario` | ✅ Implemented | Switch active scenario. |
| `GET /deals/:id/construction/dashboard` | ✅ Implemented | Full construction summary. |
| `POST /deals/:id/construction/change-orders` | ✅ Implemented | Create change order. |
| `POST /deals/:id/construction/change-orders/:coId/approve` | ✅ Implemented | Approve CO with role check + budget update + recompute. |
| `POST /deals/:id/construction/rfis` | ✅ Implemented | Create RFI. |
| `POST /deals/:id/engines/factor` | ✅ Implemented | Run factor engine. |
| `POST /deals/:id/engines/montecarlo` | ✅ Implemented | Run MC simulation. |
| `POST /deals/:id/engines/budget` | ✅ Implemented | Run budget analysis. |
| `POST /deals/:id/engines/scurve` | ✅ Implemented | Run S-curve. |
| `GET /deals/:id/engines/:engine/latest` | ✅ Implemented | Get latest engine result. |
| `recompute.ts` service | ✅ Implemented | Full 7-step cascade: Factor→Underwriter(×3)→MC→Budget→S-Curve→Decision. ~407 lines. Production-quality. |
| `event-bus.ts` | ⚠️ Exists but unwired | EventBus class with WAL persistence, mutex, dead-letter retry, replay-on-startup. **Not connected to any routes or recompute service.** |
| Auth middleware | ✅ Implemented | Custom JWT (HMAC SHA-256), `authGuard`, `attachUser`, `requireRole`. 24h expiry. |
| `POST /auth/register` | ❌ Missing | No user registration endpoint. |
| `POST /deals` (create deal) | ❌ Missing | No deal creation endpoint. |
| `DELETE /deals/:id` | ❌ Missing | No deal deletion. |
| `PATCH /deals/:id/milestones/:msId` | ❌ Missing | No milestone update route. |
| `GET /deals/:id/milestones` | ❌ Missing | No milestone list route. |
| `GET/PATCH /deals/:id/budget` | ❌ Missing | No budget line CRUD routes. |
| `PATCH /deals/:id/rfis/:rfiId` | ❌ Missing | No RFI update/resolve route. |
| `GET /deals/:id/alerts` | ❌ Missing | No alerts endpoint. |
| `GET /deals/:id/recommendations/history` | ❌ Missing | No recommendation history endpoint. |
| `POST /deals/:id/revalue` (advanceMonth) | ❌ Missing | No monthly revaluation with month advancement. Spec's Execution Playbook Task 10 calls for advanceMonth. |
| WebSocket `/deals/:id/events` | ❌ Missing | No real-time event push. |
| `@fastify/jwt` plugin | ❌ Missing | Spec says use @fastify/jwt. Implementation uses custom JWT (hand-rolled HMAC). |
| Scrypt vs Bcrypt | ⚠️ Differs | Implementation uses scrypt. Spec explicitly says bcrypt. |
| Event subscribers registration | ❌ Missing | Spec says register event subscribers at startup in index.ts. Not done. |
| Impact simulator service | ❌ Missing | Spec defines `impact-simulator.ts` that runs delta underwriter simulation for CO impact preview. |
| Redis cache | ❌ Missing | Spec includes Redis for caching live engine results and sessions. |
| Rate limiting / security plugins | ❌ Missing | No @fastify/rate-limit, @fastify/helmet, or similar. |

### A.5 — `packages/ui` (Next.js Frontend)

| Feature | Status | Notes |
|---------|--------|-------|
| Next.js 14 App Router | ✅ Implemented | Layout, routing, globals.css. |
| `AuthProvider` context | ✅ Implemented | Login/logout, loading state. |
| Login page | ✅ Implemented | Email/password form with demo credentials. |
| Deal list page | ✅ Implemented | Cards for all deals. |
| Deal dashboard (tabbed) | ✅ Implemented | 4 tabs: Dashboard, Assumptions, Scenarios, Construction. |
| `MetricsStrip` | ✅ Implemented | 6 metrics with color coding (IRR, NPV, Equity Multiple, DSCR, Payback, Exit Value). |
| `CashFlowTable` | ✅ Implemented | 10-year projection table (Occ%, ADR, RevPAR, Revenue, GOP, EBITDA, Debt Service, FCFE). |
| `RecommendationCard` | ✅ Implemented | Verdict badge, confidence bar, version, flip indicator, gate results, explanation. |
| `ScenarioComparison` | ✅ Implemented | 3 scenario cards with promote-to-active button. Year-by-year comparison table. |
| `ConstructionDashboard` | ✅ Implemented | Summary cards, progress bar, tabbed sections for budget, COs, milestones, RFIs. CO approval button. |
| `AssumptionEditor` | ✅ Implemented | Slider-based editor for market + financial assumptions. Save & Recompute with result feedback. |
| `use-dashboard` hook | ✅ Implemented | React Query fetch + mutations for underwrite and assumptions. |
| `use-scenarios` hook | ✅ Implemented | Fetch scenarios + promote mutation. |
| `use-construction` hook | ✅ Implemented | Fetch construction + CO/RFI creation + CO approval mutations. |
| `api-client.ts` | ✅ Implemented | Typed fetch wrapper with auth header injection. |
| Construction tab role guard | ✅ Implemented | Only visible to operators. |
| Auth storage | ⚠️ Differs | Uses `sessionStorage`. Spec (Execution Playbook Task 9) says **in-memory only** (no sessionStorage/localStorage for security). |
| Slider `.describe()` metadata | ❌ Missing | Spec requires Zod `.describe()` with JSON `{min, max, step, unit}` to auto-generate slider config. Sliders are hardcoded. |
| Debounced assumption save | ❌ Missing | Spec (Task 8) calls for 600ms debounce on slider changes. Not implemented. |
| `RevalHistory.tsx` | ❌ Missing | Table showing all recommendation versions with month, verdict, confidence, IRR, NPV. |
| `AlertBanner.tsx` | ❌ Missing | Dashboard banner for unacknowledged WARN/CRITICAL alerts. |
| S-Curve Chart (Recharts) | ❌ Missing | Spec calls for a Recharts line chart overlaying planned vs actual vs forecast CAPEX. |
| MC Histogram Chart | ❌ Missing | Spec calls for Recharts bar chart of IRR distribution from MC output. |
| Sensitivity Tornado Chart | ❌ Missing | Spec calls for Recharts horizontal bar chart of sensitivity rankings. |
| Recommendation History Sparkline | ❌ Missing | Mini chart of confidence over time with verdict changes marked. |
| Lifecycle Phase Bar | ❌ Missing | Visual timeline showing 3 lifecycle phases, current position, percent complete. |
| Trend Arrows on KPI cards | ❌ Missing | Spec says each KPI card shows value + trend arrow vs previous month. |
| Deal creation form | ❌ Missing | No way to create a new deal from the UI. |
| Route guards component | ❌ Missing | `components/guards/` directory is empty. Spec defines role-based route protection. |
| Zustand state management | ❌ Missing | Spec calls for Zustand. Implementation uses React Query + Context only. |
| WebSocket subscription | ❌ Missing | No real-time event subscription in UI. |
| Risk register UI | ❌ Missing | No risk viewing/editing interface. |
| Financing / Debt Tranche UI | ❌ Missing | No financing plan or debt tracking interface. |
| Report generation UI | ❌ Missing | No investment memo / PDF report generation. |
| Audit log viewer | ❌ Missing | No dedicated audit log browsing interface (dashboard shows "recent activity" only). |
| Dark mode / theme | ❌ Missing | Not in spec but common expectation. |

### A.6 — `packages/infra`

| Feature | Status | Notes |
|---------|--------|-------|
| `docker-compose.yml` | ✅ Implemented | PostgreSQL + Redis containers for dev. |
| Temporal container | ❌ Missing | Spec requires Temporal for durable workflows. |
| NATS container | ❌ Missing | Spec includes NATS JetStream for event bus (Layer 3). |
| CI/CD (GitHub Actions) | ⚠️ Added | Basic workflow in `.github/workflows/`. |
| Terraform / deploy scripts | ❌ Missing | No production deployment configuration. |

### A.7 — `packages/workflows` (Temporal)

| Feature | Status | Notes |
|---------|--------|-------|
| **Entire package** | ❌ Missing | Spec defines `packages/workflows/` with Temporal workflow + activity definitions. The package does not exist at all. |
| `MonthlyRevaluation` workflow | ❌ Missing | 8-step durable workflow: pull macro → Factor → Underwriter(×3) → MC → Decision → compare → alert. |
| `ChangeOrderApproval` workflow | ❌ Missing | Multi-step with routing by amount threshold, 72h escalation timer, majority vote for large COs. |
| `OnAssumptionChange` workflow | ❌ Missing | Event-driven recompute workflow. |
| Activity definitions | ❌ Missing | `refreshMacroData`, `runFactorEngine`, `runUnderwriterScenarios`, `runMonteCarlo`, `runDecisionEngine`, `storeEngineResult`, `storeRecommendation`, `emitEvent`, `sendAlerts`, `requestApproval`. |

---

## B. WHAT IS MISSING OR INCOMPLETE

### B.1 — Architecture & Infrastructure Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| **No Temporal workflows** — entire `packages/workflows` package missing. Recompute cascade is inline in API route handlers. No durable, resumable, compensating workflows. | 🔴 High | Blueprint §3.4, Impl Plan §5, Scaffolding §2.1 |
| **No external event bus** — NATS JetStream / Kafka / Redis Streams not used. In-process EventBus exists but is **not wired to any routes or the recompute service**. | 🔴 High | Blueprint §3.2, Roadmap §2.1 |
| **No Redis cache** — no caching of live engine results or sessions. | 🟡 Medium | Impl Plan §1.2, Blueprint §4.1 |
| **No WebSocket support** — no real-time event push to UI. | 🟡 Medium | Impl Plan §6.1, Blueprint §4.1 |
| **No CI/CD pipeline** — no GitHub Actions, no automated builds or deploys. | 🟡 Medium | Impl Plan §1.2 |
| **No production deployment config** — no Terraform, no ECS/Fly.io setup. | 🟡 Medium | Impl Plan §1.2 |
| **No report/document generation** — no docx-js or Puppeteer for investment memos. | 🟡 Medium | Impl Plan §1.2 |
| **No observability** — no structured logging, no metrics, no tracing. | 🟡 Medium | Roadmap Layer 3 |
| **Auth library mismatch** — hand-rolled JWT instead of `@fastify/jwt`. Scrypt instead of bcrypt. | 🟠 Low-Med | Execution Playbook Task 4 |
| **Auth provider mismatch** — custom auth instead of Clerk/Auth0 (spec's recommendation). | 🟠 Low-Med | Impl Plan §1.2 |

### B.2 — Domain Model Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| **Risk Register** entirely absent — no `Risk` type, no DB table, no API routes, no UI. | 🔴 High | Scaffolding §2.2, Blueprint §2.1 |
| **Financing Plan / Debt Tranches** absent — no tranche tracking, covenants, drawdown schedule, covenant breach events. | 🔴 High | Blueprint §2.1 |
| **Draw Requests** absent — no construction draw request tracking. | 🟡 Medium | Blueprint §2.1, Roadmap §2.2 |
| **Lifecycle phases** not modeled — no `lifecyclePhase` tracking, no phase advancement, no `phase.advanced` events. | 🟡 Medium | Blueprint §2.1, Scaffolding §2.2 |
| **Property enrichment** missing — no room types, amenities, lat/lng, land area, gross BUA, star rating. | 🟡 Medium | Scaffolding §2.2 |
| **Market segments** missing — no pctMix, ADR premium, seasonality per segment. | 🟡 Medium | Scaffolding §2.2 |
| **Revenue mix** missing — no rooms/F&B/banquet/other split. | 🟡 Medium | Scaffolding §2.2 |
| **Seasonality** (12 monthly multipliers) missing. | 🟡 Medium | Scaffolding §2.2 |
| **CompSet** (competitive set) data missing. | 🟠 Low-Med | Scaffolding §2.2 |
| **Role model mismatch** — 4 roles (`lead-investor`, `co-investor`, `operator`, `viewer`) vs spec's 5 roles (`ANALYST`, `INVESTOR`, `PM`, `AUDITOR`, `ADMIN`). Different names and different permission matrices. | 🟡 Medium | Execution Playbook Task 4, Roadmap §1.2 |

### B.3 — Event System Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| Only 3 of 15+ event types defined in core. | 🔴 High | Blueprint §3.1, Scaffolding §2.5 |
| `EventEnvelope` standard wrapper not implemented. | 🟡 Medium | Scaffolding §2.5 |
| Engine trigger matrix not implemented — no mapping of which events trigger which engines. | 🔴 High | Blueprint §3.3 |
| EventBus not wired into routes or recompute — events are not emitted on mutations. | 🔴 High | Roadmap §2.1 |
| No event subscribers registered at startup. | 🔴 High | Roadmap §2.4 |

### B.4 — API & Workflow Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| No deal creation (`POST /deals`). | 🔴 High | Roadmap §3.1 |
| No user registration (`POST /auth/register`). | 🟡 Medium | Execution Playbook Task 4 |
| No monthly revaluation / `advanceMonth`. | 🔴 High | Execution Playbook Task 10, Impl Plan §5.1 |
| No milestone CRUD routes. | 🟡 Medium | Roadmap §2.3 |
| No budget line CRUD routes (via API). | 🟡 Medium | Roadmap §2.3 |
| No RFI update/resolve route. | 🟡 Medium | Roadmap §2.3 |
| No alerts endpoint. | 🟡 Medium | Roadmap §2.5 |
| No recommendation history endpoint. | 🟡 Medium | Roadmap §1.3 |
| No impact simulator service (CO impact preview). | 🟡 Medium | Roadmap §2.3 |
| No underwriter `/sensitivity` or `/rebase`. | 🟡 Medium | Blueprint §4.2 |
| No factor `/sensitivity` or `/history`. | 🟡 Medium | Blueprint §4.2 |
| No MC `/stress` endpoint. | 🟡 Medium | Blueprint §4.2 |
| No CO rejection flow. | 🟡 Medium | Blueprint §3.4.1, Roadmap §2.4 |
| No escalation timer / approval routing by amount. | 🟡 Medium | Blueprint §3.4.1 |

### B.5 — UI Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| **No data visualizations** — no Recharts charts (S-curve, MC histogram, sensitivity tornado, recommendation sparkline). | 🔴 High | Impl Plan §6, Scaffolding §2.4 |
| No deal creation form in UI. | 🔴 High | Roadmap §3.1 |
| No revaluation history view. | 🟡 Medium | Roadmap §1.3 |
| No alert banner component. | 🟡 Medium | Roadmap §2.5 |
| No lifecycle phase bar. | 🟡 Medium | Impl Plan §6.1 |
| No KPI trend arrows. | 🟡 Medium | Impl Plan §6.1 |
| No route guards (empty `guards/` directory). | 🟡 Medium | Roadmap §1.2 |
| No Zustand state management. | 🟠 Low-Med | Impl Plan §1.2 |
| Auth stored in sessionStorage, not in-memory. | 🟠 Low-Med | Execution Playbook Task 9 |
| No 600ms debounce on assumption sliders. | 🟠 Low-Med | Execution Playbook Task 8 |
| No milestone timeline (Gantt-style). | 🟡 Medium | Roadmap §2.6 |
| No RFI detail expansion / response thread. | 🟠 Low-Med | Roadmap §2.6 |

### B.6 — Testing & Quality Gaps

| Gap | Severity | Spec Reference |
|-----|----------|---------------|
| Only 1 test file (`underwriter/index.test.ts`). No tests for Factor, Decision, MC, Budget, S-Curve engines. | 🔴 High | General best practice |
| No API route integration tests. | 🟡 Medium | Roadmap Layer 3 |
| No E2E tests (Playwright/Cypress). | 🟡 Medium | Roadmap Layer 3 |
| No snapshot/regression tests for engine outputs. | 🟡 Medium | General best practice |
| `vitest.config.ts` exists but test coverage is minimal. | 🟡 Medium | — |

### B.7 — Database Schema Mismatches

| Gap | Severity | Notes |
|-----|----------|-------|
| `deals` table stores entire state as single JSONB `snapshot`. Spec separates `status`, `lifecycle_phase`, `current_month`, `version` as columns for queryability. | 🟡 Medium | Limits filtering/sorting |
| No `deal_snapshots` versioned history table. | 🟡 Medium | No audit trail of full deal state |
| Monetary values as `real`/`integer` instead of `BIGINT` (paisa). | 🟡 Medium | Float precision risk |
| User→Deal access via JSONB array instead of junction table. | 🟡 Medium | Not scalable |
| Milestone uses `plannedDate`/`actualDate` (Date) instead of `plannedMonth`/`actualMonth` (int). | 🟠 Low-Med | Different model than spec |

---

## C. OVERALL COMPLETENESS ESTIMATE

### By Package

| Package | Spec Scope | Implemented | Completeness |
|---------|-----------|-------------|-------------|
| `packages/core` | ~30 types, 15+ events, rich DTOs, Zod schemas with metadata | ~18 types (simplified), 3 events, basic DTOs, Zod without metadata | **40%** |
| `packages/engines` | 6 engines + sensitivity/stress/rebase variants, full test coverage | 6 engines (core functions only), 1 test file | **55%** |
| `packages/db` | 12+ tables, junction tables, generated columns, migrations, comprehensive queries | 10 tables (simplified), no migrations, basic queries | **45%** |
| `packages/api` | 25+ endpoints, Temporal integration, event wiring, WebSocket, Redis, impact simulator | 16 endpoints, inline recompute, unwired event bus | **40%** |
| `packages/workflows` | Full Temporal package with 3+ durable workflows, activities, compensation | **Does not exist** | **0%** |
| `packages/ui` | 15+ components, Recharts, Zustand, route guards, deal creation, reval history | 10 components, no charts, no state mgmt, no guards | **35%** |
| `packages/infra` | Docker Compose + Redis + Temporal + NATS, CI/CD, Terraform | Docker Compose (Postgres + Redis) | **15%** |

### By Spec Document Layer

| Layer | Description | Completeness |
|-------|-------------|-------------|
| **Layer 1** (Single-Deal MVP) | Auth, assumption editing, manual revaluation, reval history, 5 roles, auth guards | **55%** — auth works but roles/guards incomplete; assumptions work but missing metadata/debounce; no revaluation; no history view |
| **Layer 2** (Events & Construction) | Event bus, 4 construction tables, 8 API endpoints, CO approval workflow, milestone delay workflow, construction UI, alerts | **35%** — construction tables exist; some routes exist; event bus exists but unwired; no workflows; no alerts; UI partial |
| **Layer 3** (Multi-Deal & Hardening) | Multi-deal, deal creation, junction tables, error handling, observability, testing, NATS upgrade | **10%** — deal list renders but no creation; no junction table; no observability; minimal tests |

### Overall Project Completeness

| Dimension | Score |
|-----------|-------|
| **Core domain model** | 40% |
| **Computation engines** | 55% |
| **Data persistence** | 45% |
| **API surface** | 40% |
| **Workflow orchestration** | 0% |
| **Event-driven architecture** | 10% |
| **UI / UX** | 35% |
| **Infrastructure / DevOps** | 15% |
| **Testing** | 10% |
| **Documentation** | 20% |

### **OVERALL COMPLETENESS: ~30–35%**

The project represents a functional **thin end-to-end slice** — you can log in, view a deal, edit assumptions, trigger a full engine cascade, see scenarios, view construction data, and approve change orders. The 6 financial computation engines are the strongest implemented area. However, the project is missing:

- The entire workflow orchestration layer (Temporal)
- Meaningful event-driven reactivity (event bus exists but is disconnected)
- ~40% of required API endpoints
- All data visualizations (charts/graphs)
- Risk management, financing/debt tracking, and alerts
- Production infrastructure, CI/CD, and testing
- Role model alignment with spec (different role names and count)

The slice successfully demonstrates the core computation pipeline (Factor → Underwriter → MC → Budget → S-Curve → Decision) and basic CRUD + UI, which was its stated purpose. Completing the full specification would require approximately 8–10 additional weeks of engineering based on the Roadmap's own sprint estimates.
