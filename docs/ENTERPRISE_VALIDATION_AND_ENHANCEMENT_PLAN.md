# Enterprise-Grade Validation & Enhancement Plan  
## Big 4 Partner Perspective — Investment Plan & Market Assessment

**Role:** Big 4 partner with high success rate on investment plan and market assessment recommendations.  
**Goal:** Validate the V3 Grand Investment OS and prescribe critical factors for deal create/update, plus Agentic AI workflows and guardrails, to position the app as a **top-tier enterprise-grade** platform.

---

## 1. Executive Summary

The platform already delivers **deal lifecycle, engines, stress/validation, and an agentic layer** (plan → execute → verify) that aligns with institutional expectations. To reach **enterprise-grade** and maximize **recommendation success rate**, we must:

- **Harden deal create/update** with mandatory market alignment, IC readiness, and risk/compliance checkpoints.
- **Extend the Agentic AI** with workflows that support **investment committee readiness**, **market assessment**, **validation and audit**, and **governance**.
- **Formalize guardrails** so every number and verdict is traceable to tools (anti-hallucination) and key actions follow four-eyes/approval where required.

This document sets out **critical factors for deal create/update**, **new workflows and tools for the Agentic AI**, and a **phased roadmap** to implement them.

---

## 2. Critical Factors for Deal Create / Update

These are the factors that, in practice, differentiate high-success investment memos and market assessments. They should be **required or strongly encouraged** at deal create and at material updates.

### 2.1 Market & Location (Must-Strengthen)

| Factor | Current State | Enhancement |
|--------|----------------|------------|
| **Market alignment** | Property has `location`, `city`; market tools exist (`get_city_profile`, `get_demand_signals`, `get_construction_costs`) but are **not** invoked at deal create/update | **At create/update:** Require or suggest city; call `get_city_profile` / `get_demand_signals` and **store snapshot** (e.g. `deal.marketSnapshotAtCreate`) and optionally flag if ADR/occupancy assumptions fall outside city benchmarks |
| **Comp set** | `marketAssumptions.compSet` exists but is often empty | **Mandatory for IC:** Minimum N comps (e.g. 3); agent workflow can **suggest comp set** from city profile or market data |
| **Macro consistency** | Engines use live `get_macro_indicators` at run time; deal create does not lock or display macro context | **At create:** Optionally fetch and store `macroSnapshotAtCreate` (repo rate, CPI, FX) for audit trail (“deal was created under these macro conditions”) |
| **Source of assumptions** | No explicit “source” for ADR, growth, cap rate | **Add:** Optional `sources` or `rationale` per key assumption (e.g. ADR: “City profile 2024 + 5% premium”) for IC and audit |

### 2.2 Investment Committee Readiness

| Factor | Current State | Enhancement |
|--------|----------------|------------|
| **IC memo / one-pager** | `POST /deals/:id/ic-memo` exists; not yet driven by agent | **Workflow:** “Prepare IC memo” workflow: pull dashboard, stress test, risks, recommendation → produce structured summary (and optionally PDF/export) |
| **Gate criteria** | Recommendation has `gateResults`; not always visible at create | **At create/update:** Show default gate thresholds; after first run, show **pass/fail by gate** and require acknowledgment for “proceed” |
| **Sensitivity & stress** | Stress/sensitivity run on demand; not required before status change | **Governance:** For status move Draft → Active (or to IC), require **at least one** stress test and one sensitivity run (or agent workflow that runs and attaches summary) |
| **Verdict and confidence** | Recommendation has verdict + confidence | **Deal create/update:** After recompute, require explicit “I have read the recommendation (PROCEED / DO-NOT-PROCEED) and confidence” before allowing promotion (optional four-eyes via `pending_actions`) |

### 2.3 Risk & Compliance (Enterprise Non-Negotiables)

| Factor | Current State | Enhancement |
|--------|----------------|------------|
| **Risk register** | Risks table and UI; not mandatory at create | **At create/update:** Require at least one **risk entry** (even placeholder) for deals moving to Active; agent workflow can **suggest risks** from stress scenarios (e.g. “Rate hike +300bps” → risk “Interest rate shock”) |
| **Hash chain / model integrity** | `verify_hash_chain`, `get_compliance_controls` exist | **Workflow:** “Pre-IC integrity check”: verify hash chain for deal + list compliance controls; store result on deal or audit |
| **Audit trail** | `audit_log`, `insertAuditEntry` on key actions | **Extend:** Ensure every **assumption change**, **scenario promote**, **status change** and **agent-triggered run** is audited with `triggeredBy` (e.g. `mcp-agent` / `workflow:deal_ic_readiness`) |
| **Four-eyes / maker-checker** | `pending_actions` table and approval flow exist | **Governance:** For material assumption changes and “promote to Active”, enforce four-eyes (already partially there); agent workflows that **change** deal state should create a **pending action** instead of applying directly where policy requires approval |

### 2.4 Data Quality & Completeness

| Factor | Current State | Enhancement |
|--------|----------------|------------|
| **Completeness score** | No formal “readiness” score | **Add:** Computed **deal readiness** or **completeness** (e.g. % of required fields, market snapshot present, risk count, stress run present); show on dashboard and in workflows |
| **Validation before save** | Some validation in API | **At create/update:** Validate property (keys, BUA, location), financial (WACC, ratios), market (ADR, occupancy ramp) against schema and optional **ranges**; return clear errors so UI/agent can correct |
| **Versioning** | Deal has `version`; engine results are versioned | **Expose:** “Deal version” and “last full recompute” in dashboard and in agent tool results so agents and users can cite “as of version X” |

---

## 3. Agentic AI: Workflows to Add

These workflows extend the existing **plan → execute → verify** model and should be implemented as fixed recipes (like `deal_dashboard_stress`) and, where useful, exposed in the UI and to the assistant.

### 3.1 Market & Deal Health (Reference Only — Implement)

- **Name:** `market_and_deal_health`
- **Steps:** `get_macro_indicators` → `market_health` → `list_deals` (limit 5) → for first deal `get_deal_dashboard`.
- **Verification:** Macro returns data; market_health cache hit rate above threshold; dashboard returns deal.
- **Purpose:** System health and “market + deal pipeline” snapshot for support or IC prep.

### 3.2 Deal IC Readiness (New)

- **Name:** `deal_ic_readiness`
- **Input:** `dealId`
- **Steps:**  
  1. `get_deal_dashboard`  
  2. `run_stress_test` (shocks)  
  3. `run_sensitivity` (key drivers)  
  4. `verify_hash_chain` for deal  
  5. (Optional) `get_compliance_controls`  
  6. (If tool exists) get risks for deal or summarize from stress scenarios.
- **Verification:** Dashboard has recommendation; stress returned shocks; sensitivity returned results; hash chain valid.
- **Output:** Structured summary (recommendation, stress highlights, sensitivity highlights, chain OK, risk count) suitable for **IC memo** or one-pager. Optionally call `POST /deals/:id/ic-memo` with generated summary.

### 3.3 Market-Aligned Deal Check (New)

- **Name:** `deal_market_alignment`
- **Input:** `dealId`
- **Steps:**  
  1. `get_deal` (for location/city and ADR/occupancy assumptions)  
  2. `get_city_profile` (city from deal)  
  3. `get_demand_signals` (city)  
  4. `get_construction_costs`  
- **Verification:** City profile exists; deal has city; optional: ADR within band of city benchmark.
- **Output:** Comparison summary: deal assumptions vs. market benchmarks (ADR, demand, construction trend). Flag material variances for IC or update.

### 3.4 Full Recompute & Verify (New)

- **Name:** `deal_full_recompute_verify`
- **Input:** `dealId`
- **Steps:**  
  1. `run_factor`  
  2. `run_montecarlo`  
  3. `run_budget`  
  4. `run_scurve`  
  5. (Recommendation is typically updated by API on recompute)  
  6. `get_deal_dashboard`  
  7. `verify_hash_chain`  
- **Verification:** Dashboard has latest recommendation; hash chain valid.
- **Purpose:** Post–assumption-change or pre-IC full run with integrity check; can be triggered by agent or “Recompute & verify” button.

### 3.5 Risk Suggestions from Stress (New)

- **Name:** `deal_stress_to_risks`
- **Input:** `dealId`
- **Steps:**  
  1. `run_stress_test` (shocks)  
  2. Parse shocks → map to risk categories (e.g. rate hike → financial risk, demand crash → market risk)  
  3. (If tool exists) create or suggest risk register entries via API.  
- **Verification:** Stress returned shocks; at least one suggestion generated.
- **Purpose:** Populate risk register from stress output to meet “at least one risk” and improve IC readiness.

### 3.6 Pre-Create Market Snapshot (New)

- **Name:** `market_snapshot_for_deal`
- **Input:** `city` (optional from body)
- **Steps:** `get_macro_indicators` → `get_city_profile`(city) → `get_demand_signals`(city) → `get_construction_costs`.
- **Verification:** All return data.
- **Output:** Single payload to attach to **deal create** as `marketSnapshotAtCreate` / `macroSnapshotAtCreate` so every deal has a reproducible “market at creation” record.

---

## 4. New or Extended MCP Tools (For Agent & Workflows)

To support the above, the following tools (or API wrappers) are recommended:

| Tool | Purpose | Priority |
|------|---------|----------|
| **get_risks** | List risks for a deal (wrap GET /deals/:id/risks) | High |
| **create_risk** | Add risk (wrap POST /deals/:id/risks) — agent can suggest risks from stress | High |
| **get_audit** | Last N audit entries for deal (wrap GET /deals/:id/audit) | Medium |
| **get_ic_memo** / **generate_ic_memo** | Get or trigger IC memo (wrap existing ic-memo endpoint) | High |
| **deal_readiness** | Computed completeness/readiness score (new API + tool) | Medium |
| **get_market_snapshot** | Single call returning macro + city + demand + construction for a city (or use workflow `market_snapshot_for_deal`) | Medium |

No change to existing tool semantics is required; add new tools and call existing APIs from the MCP server.

---

## 5. Anti-Hallucination & Governance (Enterprise Guardrails)

- **Evidence requirement:** IRR, NPV, verdict, dealId, and stress/sensitivity results **must** come from tool responses only (already in system prompt; formalize in a short `EvidenceRequirement` / `NeverFabricate` contract in code or docs).
- **Agent-triggered writes:** When the agent (or a workflow) triggers a **state-changing** action (e.g. create deal, update assumptions, promote scenario), either:  
  - Use existing **pending_actions** where four-eyes is required, or  
  - Ensure **audit log** always records `triggeredBy: 'mcp-agent'` or `workflow:<name>`.
- **Workflow approval:** For workflows that modify deal data (e.g. create risk, update deal), consider an optional **approval step** (e.g. “Run workflow X? It will create 3 risk entries”) before execution, especially for enterprise tenants.

---

## 6. Implementation Roadmap (Phased)

| Phase | Focus | Deliverables |
|-------|--------|--------------|
| **A** | Deal create/update hardening | Market snapshot at create (optional); validation rules; completeness score (API + optional UI); require 1 risk for Active |
| **B** | Agent workflows | Implement `market_and_deal_health`; `deal_ic_readiness`; `deal_market_alignment`; `deal_full_recompute_verify`; register in workflow registry and expose in UI |
| **C** | Risk & IC from agent | Tools: `get_risks`, `create_risk`; workflow `deal_stress_to_risks`; IC memo generation from `deal_ic_readiness` output |
| **D** | Market snapshot & governance | Workflow `market_snapshot_for_deal`; attach snapshot to deal create; formalize anti-hallucination contract and audit `triggeredBy` for all agent-triggered actions |

---

## 7. Summary: What Makes This Enterprise-Grade

- **Deal create/update:** Mandatory or strongly encouraged **market alignment**, **risk entry**, **validation**, and **IC readiness** checkpoints; **market/macro snapshot** at create for audit.
- **Agentic AI:** Workflows for **IC readiness**, **market alignment**, **full recompute + verify**, **stress → risks**, and **market snapshot**; new tools for **risks** and **IC memo**.
- **Governance:** Four-eyes where required; full **audit trail** for agent and workflow actions; **hash chain verification** and **compliance controls** in workflows.
- **Traceability:** Every number and verdict traceable to tools; no fabrication of dealId, IRR, NPV, or verdicts (anti-hallucination contract).

This plan, implemented in phases, will position V3 Grand as a **top-notch enterprise-grade** platform for investment plan and market assessment with high recommendation success rate and full auditability.
