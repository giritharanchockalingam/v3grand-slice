# V3 Grand — Workflow & Recommendation Reference Manual

**From first deal to Investment Committee memo: concepts, workflows, and how your recommendation is built.**

This manual is written for everyone who uses the platform—from analysts seeing the system for the first time to partners and technical leads who need to explain or audit the logic. It explains **what** the platform does, **why** it works the way it does, and **how** to use it end to end.

---

## Table of contents

1. [Purpose and audience](#1-purpose-and-audience)
2. [Platform at a glance](#2-platform-at-a-glance)
3. [Core concepts](#3-core-concepts)
4. [How the recommendation is built](#4-how-the-recommendation-is-built)
5. [End-to-end workflows](#5-end-to-end-workflows)
6. [Feasibility and IC memo](#6-feasibility-and-ic-memo)
7. [Reference tables](#7-reference-tables)
8. [Glossary and FAQ](#8-glossary-and-faq)

---

## 1. Purpose and audience

### Why this document exists

Investment recommendations should be **transparent**, **repeatable**, and **auditable**. This manual:

- Gives **new users** a clear path from “what is this?” to “I can run a deal and explain the recommendation.”
- Gives **experienced users** a single place to check workflows, gate logic, and where each number comes from.
- Gives **partners and governance** the “what / why / how” in one place—suitable for IC discussions, internal training, or due diligence.

### Who it’s for

| Role | Use this manual to |
|------|---------------------|
| **Analyst** | Learn the deal → assumptions → recompute → recommendation flow; use the Feasibility tab and generate an IC memo. |
| **Associate / PM** | Understand scenarios, gates, and confidence; explain to stakeholders why a verdict is INVEST vs HOLD. |
| **Partner / IC** | See how the recommendation is built (gates, pass rate, narrative) and how governance (assumption workflow, audit trail) supports it. |
| **Technical / QA** | Trace data flow (engines, hashing, audit log) and validate behaviour against this reference. |

---

## 2. Platform at a glance

### What V3 Grand does

V3 Grand is an **investment advisory and deal management platform**. It helps teams:

1. **Model deals** — Property, financing, market and financial assumptions.
2. **Run a standardised engine pipeline** — Factor scoring, 10-year pro forma (Underwriter), Monte Carlo, budget variance, S-curve, and a **Decision** step that turns all of that into a single **recommendation** (verdict + confidence + narrative).
3. **Compare scenarios** — Bear / Base / Bull with side-by-side metrics and an “active” scenario for reporting.
4. **Govern assumptions** — Track key inputs (e.g. occupancy, ADR growth) through Draft → Reviewed → Approved → Locked so IC memos rest on agreed numbers.
5. **Produce IC-ready output** — Generate an Investment Committee memo that ties together thesis, metrics, recommendation, assumptions, and audit trail.

Everything is **deal-centric**: you work inside a deal; the dashboard, Feasibility workbench, and reports are all scoped to that deal.

### High-level flow

```
Create/load deal → Set or update assumptions → Recompute (engines run) → View recommendation & metrics
                                                                        → Compare scenarios
                                                                        → Manage governance assumptions
                                                                        → Generate IC memo
```

---

## 3. Core concepts

### Deal

A **deal** is one investment opportunity. It has:

- **Identity** — Name, asset class (e.g. hotel), lifecycle phase (e.g. feasibility, construction, operations), current month.
- **Property** — Location, size, type (used by Factor and Underwriter).
- **Assumptions** — Two main buckets:
  - **Market assumptions** — ADR, occupancy, growth rates, etc. (often used by Underwriter and scenarios).
  - **Financial assumptions** — Debt ratio, interest rate, WACC, target IRR, exit multiple, etc.
- **Optional** — Capture context (e.g. deal source, strategic intent), capex/opex models, scenarios.

When you **recompute**, the platform uses the current deal snapshot (including assumptions) and runs the full engine pipeline. Changing assumptions and recomputing is the main way you change the recommendation.

### Scenarios (Bear / Base / Bull)

Each deal is evaluated under three **scenarios**:

| Scenario | Typical meaning | Use |
|----------|------------------|-----|
| **Bear** | Conservative (e.g. lower occupancy, lower ADR growth) | Downside case. |
| **Base** | Central case | Main recommendation and dashboard metrics. |
| **Bull** | Optimistic (e.g. higher occupancy, higher growth) | Upside case. |

- The **Underwriter** runs once per scenario and produces a 10-year pro forma (IRR, NPV, DSCR, payback, etc.).
- The **Decision** engine runs once per scenario and produces a **recommendation** (verdict, confidence, gates, narrative) for that scenario.
- The **active scenario** is the one used for the main dashboard and for the **IC memo**. You can promote Bear, Base, or Bull to “active” from the Underwriting or Feasibility tab.

So: **one deal, three scenario-specific recommendations; the “current” view is the active scenario.**

### Assumptions (two kinds)

1. **Deal-level market and financial assumptions**  
   Stored on the deal (e.g. sliders in the **Assumptions** tab). They drive the Underwriter and scenarios. When you change them and click **Save & Recompute**, the full pipeline runs and the recommendation updates.

2. **Governance assumptions (FEATURE E — AGAT)**  
   Stored in the **assumptions** table (Feasibility tab: “Assumption governance”). These are **key–value** items (e.g. `occupancy_year_1`, `adr_growth`) with:
   - Owner, rationale, source, confidence
   - **Status**: Draft → Reviewed → Approved → Locked  

   They are used for **IC discipline**: only locked (or approved) assumptions should back the IC memo. The Feasibility workbench lets you add, edit, and move them through the workflow (Submit for review → Approve → Lock for IC).

### Engines (the pipeline)

The recommendation is **not** a single black box. It is produced by a fixed sequence of **engines**, each with a clear input and output:

| Order | Engine | What it does | Feeds into |
|-------|--------|--------------|------------|
| 1 | **Factor** | Scores the deal (global, local, asset, sponsor) using macro data (e.g. RBI, FRED) and deal structure. Outputs composite score, implied discount rate, implied cap rate. | Decision (as one gate). |
| 2 | **Underwriter** | Builds a 10-year pro forma from deal + assumptions + scenario. Outputs IRR, NPV, equity multiple, DSCR, payback, exit value, etc. | Decision (main input); Monte Carlo. |
| 3 | **Decision** | Evaluates **investment gates** (see below), computes **pass rate**, maps that to a **verdict** and **confidence**, and builds **explanation** and **narrative**. | Recommendation (stored per scenario). |
| 4 | **Monte Carlo** | Runs many (e.g. 5,000) simulations by perturbing assumptions. Outputs IRR/NPV distributions, P(NPV&lt;0), P(IRR&lt;WACC), etc. | Decision (extra gates); dashboard. |
| 5 | **Budget** | (Construction phase only.) Compares budget lines, change orders, RFIs, milestones to current plan. Outputs variance, alerts. | Decision (budget gate). |
| 6 | **S-Curve** | Distributes planned vs actual spend over time. | Construction / reporting. |

When you click **Recompute** (or trigger recompute via API), the pipeline runs in that order. Each engine result is **versioned and hash-chained** for auditability.

### Recommendation (verdict + confidence + narrative)

The **recommendation** is the output of the **Decision** engine for a given scenario (usually Base for the main dashboard). It is **not** a single “score”—it is a structured outcome:

- **Verdict** — One of: **INVEST**, **HOLD**, **DE-RISK**, **EXIT**, **DO-NOT-PROCEED**.
- **Confidence** — 0–100, reflecting how strongly the gates support the verdict (see [§4](#4-how-the-recommendation-is-built)).
- **Gate results** — Each gate: name, actual value, threshold, passed/failed.
- **Explanation** — Short technical summary (which gates passed/failed, key metrics).
- **Narrative** — Investor-grade, 2–3 sentence summary for IC or partners.
- **Top drivers / top risks / flip conditions** — What supports the verdict, what could flip it.

So when someone asks “how was this recommendation built?”, the answer is: **by running the engine pipeline (Factor → Underwriter → Decision, plus Monte Carlo and optional Budget), then evaluating all gates and turning the pass rate and headroom into a verdict and confidence.**

### Feasibility workbench

The **Feasibility** tab is the **end-to-end workflow** for taking a deal from scenario choice to IC-ready output:

1. **Scenario** — Choose Base / Downside / Upside (maps to bear/base/bull).
2. **Assumption governance** — Add and manage governance assumptions; move them through Draft → Reviewed → Approved → Locked.
3. **Sensitivity & Monte Carlo** — Trigger Recompute or “Run Monte Carlo only” so metrics and distributions are up to date.
4. **IC memo** — Generate the memo (title, thesis, market, outputs, recommendation, assumptions, optional audit trail); view, copy, or download JSON.

So “feasibility” here means: **getting the deal and its assumptions into a state where you can confidently generate and present an IC memo.**

### Investment Committee (IC) memo

The **IC memo** is a structured report generated from the **current deal + active scenario + latest engine results + governance assumptions + optional audit trail**. It includes:

- Title and generation metadata (who, when).
- Thesis (e.g. from capture context).
- Market summary (asset class, phase, property).
- **Outputs** — IRR, NPV, equity multiple, payback, DSCR (from the latest Underwriter result for the chosen scenario).
- **Recommendation** — Verdict, confidence, explanation.
- **Governance assumptions** — Key assumptions and their status (so IC sees what is locked/approved).
- **Audit trail** (optional) — Recent changes (who changed what, when).

It is designed so a partner or IC can see, in one place, **what we’re recommending and on what basis**.

---

## 4. How the recommendation is built

This section answers: **What is the recommendation? Why do we use gates and pass rate? How is the verdict and confidence actually computed?**

### What the recommendation is

- A **verdict** (INVEST / HOLD / DE-RISK / EXIT / DO-NOT-PROCEED).
- A **confidence** (0–100).
- **Gate results** — each gate has: name, actual value, threshold, passed (yes/no).
- **Explanation** (technical) and **narrative** (investor-grade).
- **Top drivers**, **top risks**, **flip conditions** (what could change the verdict).

All of this is produced by the **Decision** engine, which runs **after** the Underwriter (and optionally uses Factor, Monte Carlo, and Budget).

### Why we use gates and pass rate

- **Consistency** — Same rules for every deal and every run.
- **Explainability** — Every verdict can be traced to “X of Y gates passed; failed: …”.
- **Governance** — Thresholds (e.g. IRR &gt; WACC+200 bps, DSCR &gt; 1.3) are explicit and auditable.
- **No black box** — Partners and IC can see exactly which criteria were passed or failed.

So the recommendation is **rule-based on top of model outputs**, not a separate ML model.

### How the verdict is determined (logic)

1. **Gates are evaluated** using the Underwriter (pro forma) output and, when available, Monte Carlo, Factor, and Budget:

   **Core gates (always):**
   - IRR &gt; WACC + 200 bps  
   - NPV &gt; 0  
   - Equity multiple &gt; 1.8x  
   - Average DSCR &gt; 1.3x  
   - IRR &gt; Target IRR  
   - Payback ≤ 8 years  

   **If Monte Carlo is available:**
   - P(NPV &lt; 0) &lt; 20%  
   - Monte Carlo P10 IRR &gt; 5%  

   **If Factor is available:**
   - Factor composite score &gt; 3.0  

   **If Budget is available (construction):**
   - Budget variance &lt; 10%  

2. **Pass rate** = (number of gates passed) / (total number of gates).

3. **Verdict from pass rate:**

   | Pass rate | Verdict |
   |-----------|---------|
   | ≥ 85% | **INVEST** |
   | ≥ 70% | **HOLD** |
   | ≥ 50% | **DE-RISK** |
   | ≥ 30% | **EXIT** |
   | &lt; 30% | **DO-NOT-PROCEED** |

So: **more gates passed → higher pass rate → stronger verdict.** The exact thresholds (85%, 70%, etc.) are fixed in the Decision engine and can be reviewed in code or in documentation.

### How confidence is determined

Confidence is a **0–100** value that reflects:

- **Base** — Pass rate (e.g. pass rate × 80).
- **Headroom** — How much IRR exceeds WACC (positive headroom adds up to 20; negative can subtract up to 20).
- **Monte Carlo** — If available, how tight the IRR distribution is (less spread can add a small bonus).

The formula is designed so that **high pass rate + strong IRR headroom + stable MC distribution** yield higher confidence. The exact coefficients are in the Decision engine.

### Explanation and narrative

- **Explanation** — Short technical text: how many gates passed, which failed, key metrics (e.g. base IRR vs WACC, P(NPV&lt;0) if MC exists). Used for logs and power users.
- **Narrative** — 2–3 sentences in plain language for IC or partners: what the verdict is, why (e.g. “IRR exceeds hurdle; DSCR comfortable; Monte Carlo supports base case”), and any notable risks or flip conditions.

The UI shows both where relevant (e.g. recommendation card, IC memo).

### Flip detection

If there was a **previous** recommendation for the same deal and scenario, the Decision engine compares the new verdict to the old one. If they differ, the recommendation is marked as a **flip** (e.g. HOLD → INVEST). That supports “what changed?” discussions and audit.

---

## 5. End-to-end workflows

### 5.1 From zero to first recommendation

| Step | Where | Action |
|------|--------|--------|
| 1 | Login | Sign in (e.g. lead@v3grand.com / demo123). |
| 2 | Deals | Open **Deals** → create a new deal or open an existing one (e.g. “V3 Grand Madurai Hotel”). |
| 3 | Deal snapshot | Ensure property and assumptions are set (or use defaults). Optionally adjust **Assumptions** tab (market/financial sliders) and **Save & Recompute**. |
| 4 | Recompute | Click **Recompute** in the header. This runs Factor → Underwriter (×3 scenarios) → Decision (×3) → Monte Carlo → Budget (if construction) → S-Curve. |
| 5 | Dashboard | On the **Dashboard** tab, review the **Recommendation** card (verdict, confidence, narrative), **Key Metrics** (IRR, NPV, DSCR, etc.), and charts. |
| 6 | Scenarios | Open **Underwriting** to compare Bear / Base / Bull and optionally **Promote to Active** a different scenario. |

After this, you have a **first recommendation** and three scenario views. You can iterate by changing assumptions and recomputing.

### 5.2 Changing assumptions and updating the recommendation

| Step | Where | Action |
|------|--------|--------|
| 1 | Deal | Open the deal. |
| 2 | Assumptions tab | Change **market** and/or **financial** assumptions (e.g. ADR growth, debt ratio, target IRR). |
| 3 | Save & Recompute | Click **Save & Recompute**. The full pipeline runs; dashboard and recommendation refresh. |
| 4 | Dashboard / Underwriting | Confirm new verdict, confidence, and metrics; compare scenarios if needed. |

**Why this matters:** The recommendation is **fully driven by** the current deal and its assumptions. No hidden overrides—what you see is what the engines produced from that snapshot.

### 5.3 Scenario comparison and promoting active scenario

| Step | Where | Action |
|------|--------|--------|
| 1 | Underwriting tab | View Bear / Base / Bull side by side (IRR, NPV, equity multiple, gate results). |
| 2 | Promote | Click **Promote to Active** on the scenario you want for the main dashboard and for the IC memo. |
| 3 | Confirm | Dashboard and Feasibility tab now reflect the **active** scenario (Base / Downside / Upside). |

Promoting may require approval depending on configuration (four-eyes).

### 5.4 Assumption governance (Draft → Locked)

| Step | Where | Action |
|------|--------|--------|
| 1 | Feasibility tab | Open **2. Assumption governance**. |
| 2 | Add | Use **Add assumption**: Key (e.g. `occupancy_year_1`), Value, Unit, Rationale, Source, Confidence. Submit. |
| 3 | Workflow | For each row: **Submit for review** (draft → reviewed) → **Approve** (reviewed → approved) → **Lock for IC** (approved → locked). |
| 4 | Edit | For draft/reviewed rows, **Edit** to change value, rationale, source, confidence; **Save**. |
| 5 | IC memo | When generating the IC memo, governance assumptions (and their status) are included so IC sees what is locked/approved. |

Locked assumptions cannot be edited without a new version or unlock process (policy-dependent).

---

## 6. Feasibility and IC memo

### 6.1 Feasibility workflow (four steps)

The **Feasibility** tab is built as a single workflow:

| Step | Section | What to do |
|------|---------|------------|
| **1. Scenario** | Scenario | Choose **Base**, **Downside**, or **Upside** (maps to base / bear / bull). This becomes the scenario used for dashboard metrics and for the IC memo. |
| **2. Assumptions** | Assumption governance | Add and manage governance assumptions; move them through Draft → Reviewed → Approved → Locked. Optionally **Edit** any non-locked row. |
| **3. Sensitivity** | Sensitivity & Monte Carlo | Click **Recompute all (Underwriter + MC)** or **Run Monte Carlo only** to refresh metrics and distributions. The tornado chart is a placeholder until sensitivity data is wired. |
| **4. IC memo** | Investment Committee memo | Check **Include audit trail** if desired, then click **Generate IC memo**. The memo appears below with thesis, market, outputs, recommendation, assumptions, and (optional) audit trail. Use **Copy JSON** or **Download JSON** to share or archive. |

Do these in order when preparing for IC: set scenario → lock/approve assumptions → recompute so numbers are current → generate memo.

### 6.2 What the IC memo contains

- **Title** — e.g. “Investment Committee Memo — [Deal name]”.
- **Generated at / by** — Timestamp and user.
- **Thesis** — From deal capture context (e.g. strategic intent) or default.
- **Market** — Asset class, lifecycle phase, property summary.
- **Outputs** — IRR, NPV, equity multiple, payback, DSCR (from latest Underwriter for the chosen scenario).
- **Recommendation** — Verdict, confidence, explanation/narrative.
- **Governance assumptions** — List of key/value/status (so IC sees what is approved/locked).
- **Audit trail** (optional) — Recent actions (who, what, when).

The memo is **generated on demand** from current data; it is not a separate stored “report” unless your deployment persists it.

---

## 7. Reference tables

### Verdicts (Decision engine)

| Verdict | Meaning (in brief) |
|---------|---------------------|
| **INVEST** | Strong pass rate (≥85%); recommend proceeding. |
| **HOLD** | Moderate pass rate (≥70%); hold position or gather more information. |
| **DE-RISK** | Weak pass rate (≥50%); take action to reduce risk before proceeding. |
| **EXIT** | Low pass rate (≥30%); consider exit or material restructuring. |
| **DO-NOT-PROCEED** | Very low pass rate (&lt;30%); do not proceed under current assumptions. |

### Core gates (summary)

| Gate | Typical threshold | Data source |
|------|--------------------|-------------|
| IRR &gt; WACC + 200 bps | WACC + 2% | Underwriter (pro forma) |
| NPV &gt; 0 | 0 | Underwriter |
| Equity multiple &gt; 1.8x | 1.8 | Underwriter |
| Avg DSCR &gt; 1.3x | 1.3 | Underwriter |
| IRR &gt; Target IRR | Deal financial assumption | Underwriter |
| Payback ≤ 8 years | 8 | Underwriter |
| P(NPV&lt;0) &lt; 20% | 0.20 | Monte Carlo |
| MC P10 IRR &gt; 5% | 0.05 | Monte Carlo |
| Factor score &gt; 3.0 | 3.0 | Factor |
| Budget variance &lt; 10% | 0.10 | Budget (construction) |

### Assumption governance statuses

| Status | Meaning | Editable? |
|--------|---------|-----------|
| **Draft** | Work in progress. | Yes. |
| **Reviewed** | Submitted for review. | Yes (edit) or move to Approved. |
| **Approved** | Approved for use. | No value edit; can move to Locked. |
| **Locked** | Locked for IC; no further edits. | No. |

### Roles (typical)

| Role | Typical permissions |
|------|----------------------|
| **lead-investor** | Full access; recompute; approve change orders; approve scenario promotion (if four-eyes on). |
| **co-investor** | View; often construction tab; may have limited edit. |
| **operator** | Construction (budget, COs, RFIs, milestones); view deal/dashboard. |
| **viewer** | Read-only deal and dashboard. |

*(Exact permissions depend on your deployment and configuration.)*

---

## 8. Glossary and FAQ

### Glossary

- **Active scenario** — The scenario (Bear/Base/Bull) used for the main dashboard and for the IC memo.
- **Assumption governance** — Workflow (Draft → Reviewed → Approved → Locked) for key assumptions used in IC materials (FEATURE E — AGAT).
- **Deal** — Single investment opportunity; container for property, assumptions, and engine results.
- **Decision engine** — Engine that evaluates gates and produces verdict, confidence, narrative, and related outputs.
- **Factor engine** — Engine that scores deal and macro to produce composite score and implied rates.
- **Gate** — A single pass/fail criterion (e.g. “IRR &gt; WACC+200 bps”); inputs are actual vs threshold.
- **Governance assumption** — A key–value assumption with owner, rationale, source, confidence, and status (draft/reviewed/approved/locked).
- **IC memo** — Investment Committee memo: thesis, market, outputs, recommendation, governance assumptions, optional audit trail.
- **Monte Carlo** — Simulation engine that perturbs assumptions and produces IRR/NPV distributions and tail probabilities.
- **Pass rate** — Fraction of gates that passed; used to determine verdict.
- **Pro forma** — 10-year cash flow and metrics (IRR, NPV, DSCR, etc.) from the Underwriter.
- **Recommendation** — Verdict + confidence + gate results + explanation + narrative (+ drivers/risks/flip conditions).
- **Recompute** — Run the full engine pipeline (Factor → Underwriter ×3 → Decision ×3 → Monte Carlo → Budget → S-Curve) and persist results.
- **Scenario** — Bear, Base, or Bull; each has its own Underwriter and Decision output.
- **Underwriter** — Engine that builds the 10-year pro forma from deal and assumptions.
- **Verdict** — INVEST | HOLD | DE-RISK | EXIT | DO-NOT-PROCEED.

### FAQ

**Q: Where does the recommendation come from?**  
From the **Decision** engine, which runs after the **Underwriter** (and optionally uses Factor, Monte Carlo, Budget). It evaluates all gates, computes pass rate, and maps that to a verdict and confidence.

**Q: Can I change the gate thresholds?**  
Thresholds are defined in the Decision engine code (e.g. 1.3 for DSCR, 1.8 for equity multiple). Changing them requires a code/config change and a new deployment.

**Q: What’s the difference between “Assumptions” tab and “Feasibility → Assumption governance”?**  
The **Assumptions** tab edits the deal’s **market and financial assumptions** (sliders) that feed the Underwriter. **Assumption governance** is a separate list of **key–value** items with workflow (draft → locked) for IC discipline; both can be included in the IC memo.

**Q: When I generate the IC memo, is it saved?**  
By default the memo is **generated on demand** and returned (and can be copied or downloaded as JSON). Whether it is also stored in a `reports` table or file store depends on your deployment.

**Q: Why do I see “No governance assumptions yet”?**  
Governance assumptions are added explicitly in the Feasibility tab (“Add assumption”). Until you add at least one, the table is empty. Deal-level market/financial assumptions are still used by the Underwriter regardless.

**Q: What triggers a recompute?**  
Typically: **Recompute** in the UI, **Save & Recompute** after changing deal assumptions, or **Recompute all** in the Feasibility tab. API: `POST /deals/:id/underwrite` (and related triggers). Any of these runs the full pipeline.

**Q: How do I explain the recommendation to IC?**  
Use the **narrative** (investor-grade summary) and the **gate results** (how many passed, which failed). The IC memo pulls these together with outputs and governance assumptions so you can say: “We recommend INVEST at 78% confidence; 9 of 10 gates pass; the only failure is …”

---

*This manual reflects the V3 Grand / IAIP implementation as of the date of the release it ships with. For runbooks, quick start, and troubleshooting, see [RUNBOOK.md](RUNBOOK.md). For the full IAIP platform spec (schema, APIs, algorithms), see [IAIP_PLATFORM_SPEC.md](IAIP_PLATFORM_SPEC.md).*
