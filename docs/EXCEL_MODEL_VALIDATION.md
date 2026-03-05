# Excel Model Validation — Board-Ready Business Model and Market Assessment

**Purpose:** Validate the platform against the Excel model **tab by tab** from a **Big 4 senior partner** and **CFO** perspective: ensure core capability and competence are present, and add missing features where deemed fit.

**Reference file:** `Documentation/Board-Ready_Business_Model_and_Market_Assessment-Genspark_AI_Sheets-20260224.xlsx`

---

## Summary

| Excel tab | Core capability | Platform status | Action taken |
|-----------|-----------------|-----------------|--------------|
| 0. Investment Memo | IC memo, recommendation, capital structure options, key risks | IC memo ✅; capital structure comparison ❌ | Added capital structure scenarios API + UI |
| 1. Executive Summary | Board scorecard, hurdle criteria, scenario analysis, risk table | Dashboard ✅; explicit board criteria ❌; probability-weighted return ❌ | Added board criteria to memo; probability-weighted return in scenarios |
| 2. Market Opportunity | Anchor/MOU revenue, occupancy floor | Market intel ✅; anchor revenue modeling ❌ | Documented; revenue_anchors schema exists (future) |
| 3. Key Assumptions | Scenario toggles, hurdle rates, MOU curves, validation checks | Assumptions ✅; multiple hurdle display ❌ | Added WACC/Hurdle card in Feasibility |
| 4. CAPEX & Phasing | Phase 1/2 breakdown, monthly phasing | Budget lines ✅; phased CAPEX by phase ❌ | Documented gap; construction has budget |
| 5–6. Revenue | Segment mix, anchor overlay, phased revenue | Underwriter revenue ✅; segment/anchor ❌ | Documented; future enhancement |
| 7. Operating Expenses | Department-level, fixed/variable, owner savings | Underwriter opex ✅; department breakdown ❌ | Documented |
| 8–9. EBITDA & CF | FCF to equity, debt schedule, phased CAPEX | Pro forma ✅; explicit FCFE/debt schedule in UI ❌ | Documented |
| 10. Returns Analysis | Phase 1 vs Phased, sensitivity, Gordon growth | Returns ✅; two-mode + terminal value ❌ | Documented |
| 11. Scenario Stress Test | Probability weights, bear safety net, revenue trajectory | Scenarios ✅; weighted expected ❌ | Added probability-weighted IRR/NPV |
| 12. Operating Model Decision | Independent vs franchise vs mgmt: fees, margin, 10-yr impact | ❌ | Documented; future module |
| 13. Phase 2 Gate | 8-point checklist at Month 36, Go/Delay/Optimize | ❌ | Added Phase 2 gate API + Feasibility card |
| 14. Capital Structure | 40/30/20% debt, interest/principal, NPV comparison | Single debt ratio ✅; multi-scenario ❌ | Added capital structure scenarios |
| 15. WACC Calculation | Rf, beta, ERP, WACC formula, hurdle | WACC in assumptions ✅; build-up display ❌ | Added WACC/Hurdle summary card |
| 16. Lite Alternative | 3-star vs 4-star comparison | ❌ | Documented; evaluation engine has lite logic |
| VALIDATION REPORT | Cross-sheet consistency, hurdle audit | Backtest ✅; deal-level validation ❌ | Documented |

---

## Tab-by-tab validation

### 0. Investment Memo
- **Excel:** IC memo, recommendation (CONDITIONAL APPROVAL), key risks (minimal IRR margin, occupancy ramp, amenity-demand mismatch), key metrics, **capital structure options** (40%/30%/20% debt with IRR, NPV, risk, recommendation), investment highlights.
- **Platform:** IC memo generate ✅; recommendation + narrative ✅. **Gap:** Capital structure comparison (multiple debt options with side-by-side IRR/NPV and recommendation). **Added:** `GET /deals/:id/capital-structure-scenarios` and Feasibility UI block.

### 1. Executive Summary
- **Excel:** Investment committee scorecard (total investment, IRR, NPV, payback, return multiple), **board hurdle criteria** (NPV @ 17.5%, IRR > 17.5%, Bear IRR > 17.5%, payback < 10, multiple > 2x, EBITDA margin > 35%), **scenario analysis** with **probability weights** (Bear 20%, Base 60%, Bull 20%), **expected (weighted) IRR/NPV**, risk assessment table (category, impact, likelihood, mitigation).
- **Platform:** Dashboard has metrics and scenario comparison ✅. **Gap:** Explicit “board criteria” checklist (pass/fail vs hurdle); **probability-weighted expected return**. **Added:** Board criteria in IC memo (from gate results); probability-weighted expected IRR/NPV in scenarios API and Feasibility.

### 2. Market Opportunity
- **Excel:** Medical/corporate anchor revenue (partners, room-nights, ADR, revenue range), combined occupancy floor, strategic value of anchors.
- **Platform:** Market intel and data sources ✅. **Gap:** Anchor/MOU revenue modeling (partners, room-nights, occupancy floor). **Note:** `revenue_anchors` table exists (migration 012); UI/API for anchor overlay not yet built. Documented for future.

### 3. Key Assumptions
- **Excel:** Project parameters (keys, phase investments, timeline), scenario parameters (stabilized occupancy, ADR, EBITDA margin, MOU realization, Phase 2 triggered), occupancy ramp, ADR, **revised hurdle rates** (original vs WACC, conservative/base/aggressive), model error checks.
- **Platform:** Deal assumptions and governance ✅; scenario toggles ✅. **Gap:** Clear **WACC / hurdle** display (what hurdle is used, recommended). **Added:** WACC & Hurdle summary card in Feasibility.

### 4. CAPEX & Phasing
- **Excel:** Phase 1/2 CAPEX breakdown by category (Land, Civil, MEP, Interior, FF&E, Pre-op, Contingency), timing, monthly phasing, cumulative investment.
- **Platform:** Budget lines and construction ✅. **Gap:** Phased CAPEX by phase (P1 vs P2) and monthly S-curve in one structured view. Documented; construction can be extended later.

### 5–6. Revenue — Phase 1 / Phased
- **Excel:** Room inventory, occupancy/ADR, revenue (Room, F&B, Other), **segment breakdown** (Medical, Corporate, Leisure, MICE, Airline), **anchor MOU overlay** (realization %, occupancy floor), phased 55→72 keys.
- **Platform:** Underwriter produces revenue and pro forma ✅. **Gap:** Revenue by segment mix; anchor overlay. Documented for future.

### 7. Operating Expenses
- **Excel:** Department-level (Rooms, F&B COGS, S&M, Utilities, R&M, A&G, Property tax), fixed vs variable, owner-operator savings.
- **Platform:** Underwriter uses opex model ✅. **Gap:** Department-level and fixed/variable breakdown in UI. Documented.

### 8–9. EBITDA & CF — P1 / Phased
- **Excel:** P&L, EBITDA, FCF to equity (PAT + D&A − Principal − FF&E − WC), cumulative FCF, phased CAPEX in Year 4.
- **Platform:** Pro forma has IRR, NPV, DSCR, cash flows ✅. **Gap:** Explicit FCFE and debt schedule in reporting. Documented.

### 10. Returns Analysis
- **Excel:** Phase 1 only vs Phased metrics, multi-way sensitivity (occupancy × ADR, CAPEX × margin), Gordon growth terminal value.
- **Platform:** Returns and sensitivity UI ✅. **Gap:** “Phase 1 only” vs “Phased” toggle and terminal value in UI. Documented.

### 11. Scenario Stress Test
- **Excel:** Bear/Base/Bull with **probability weights**, **probability-weighted expected IRR/NPV**, bear case safety narrative, 10-year revenue by scenario.
- **Platform:** Scenarios API returns bear/base/bull ✅. **Gap:** **Probability-weighted expected return**. **Added:** Weighted expected IRR/NPV in scenarios response and Feasibility.

### 12. Operating Model Decision
- **Excel:** Independent vs IHG vs IHCL vs Marriott vs Lemon Tree: min keys, fees, margin impact, 10-year EBITDA comparison.
- **Platform:** No operating model comparison. **Gap:** Full comparison (franchise vs mgmt vs independent). Documented as future module.

### 13. Phase 2 Gate
- **Excel:** **8-point decision gate** at Month 36: Phase 1 occupancy ≥70%, ADR ≥₹4,800, EBITDA margin ≥38%, OTA ratings ≥4.2, MOU room-nights, corporate contracts ≥8, no new 4-star within 5 km, macro stable. Go/Delay/Optimize. GO/NO-GO comparison (55 vs 72 keys).
- **Platform:** Decision engine has investment gates ✅; no **Phase 2 expansion gate**. **Added:** `GET /deals/:id/phase2-gate` and Feasibility card (8 criteria, thresholds; current values from latest base pro forma where available).

### 14. Capital Structure Analysis
- **Excel:** 40%/30%/20% debt scenarios: debt amount, equity required, 10-year interest/principal, NPV comparison.
- **Platform:** Single debt ratio in deal ✅. **Gap:** **Multiple capital structure scenarios** with IRR, NPV, recommendation. **Added:** Capital structure scenarios API + UI.

### 15. WACC Calculation
- **Excel:** Risk-free rate, comparables, unlevered beta, risk premiums, levered beta, WACC formula, hurdle.
- **Platform:** WACC and target IRR in assumptions ✅; evaluation engine has WACC build-up. **Gap:** WACC/hurdle **summary** in Feasibility. **Added:** WACC & Hurdle card (from deal assumptions).

### 16. Lite Alternative
- **Excel:** 3-star vs 4-star: investment, occupancy, ADR, margin, IRR, NPV, CAPEX comparison.
- **Platform:** Evaluation engine has `computeLiteAlternatives`; main deal dashboard does not. **Gap:** Lite alternative as first-class comparison in deal flow. Documented; can be added later.

### VALIDATION REPORT
- **Excel:** Cross-sheet metric consistency, hurdle rate audit, assumption propagation, issues, recommendations.
- **Platform:** Backtest validates models ✅. **Gap:** Deal-level “model validation report” (cross-check metrics, hurdle consistency). Documented.

---

## Features added (implementation)

1. **Board criteria in IC memo** — Gate results from latest recommendation returned as `boardCriteria` (name, threshold, actual, passed) in `POST /reports/ic-memo/generate` and displayed in IC memo view.
2. **GET /deals/:id/board-criteria** — Returns current board criteria (from latest base recommendation gate results) for use in dashboard or Feasibility.
3. **GET /deals/:id/capital-structure-scenarios** — Runs base-case underwriter with debt ratio 40%, 30%, 20%; returns IRR, NPV, DSCR, risk level, and recommendation label per scenario.
4. **Probability-weighted expected return** — Scenarios API extended (or new endpoint) to return `expectedIRR` and `expectedNPV` with default weights 0.2 / 0.6 / 0.2 for bear/base/bull. Feasibility or dashboard shows “Expected (weighted)”.
5. **GET /deals/:id/phase2-gate** — Returns 8-point Phase 2 gate (criterion, threshold, current value, passed, notes). Current values from latest base pro forma where applicable (e.g. occupancy, ADR, EBITDA margin); others TBD/stub.
6. **WACC & Hurdle summary** — Feasibility section showing WACC (from deal), recommended hurdle (e.g. WACC+200 bps or target IRR), and short narrative.
7. **Feasibility UI** — New cards/sections: Board criteria, Capital structure scenarios, Probability-weighted expected return, Phase 2 gate, WACC/Hurdle.

---

## Recommendations (Big 4 / CFO)

- **Governance:** Use board criteria and Phase 2 gate in IC packs so the board sees explicit pass/fail vs agreed hurdles and expansion discipline.
- **Capital structure:** Always show at least two debt options (e.g. base and conservative) so the committee can see trade-off between leverage and risk.
- **Transparency:** WACC and hurdle should be visible and consistent across memo, Feasibility, and any export.
- **Anchor/MOU:** When revenue_anchors and anchor overlay are built, tie occupancy floor and MOU realization to scenario assumptions and Phase 2 gate.
- **Operating model:** Prioritize operating model comparison (independent vs franchise vs mgmt) for hospitality deals in a later release.

---

*This validation aligns the platform with the Excel model’s core capabilities and documents remaining gaps for roadmap.*
