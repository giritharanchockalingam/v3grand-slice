# Market Intelligence — Source of Truth & Big 4–Grade Factors

This document defines **where every piece of information on the Market Intelligence page comes from** and how it aligns with **best-in-industry** practice (what Big 4 partners use to derive recommendations).

---

## 1. Principle: Most Accurate Source for the Investment's Geography

- **Macro indicators** are scoped to the **country** of the investment (e.g. **India**). All deal-level underwriting and Factor engine inputs use India macro when the deal is in India.
- **City-level data** (demand profile, airport, tourism, housing) is scoped to the **deal’s property location** (city and state). The UI and API use the deal’s `property.location.city` (and state) to fetch the relevant city profile.
- Every metric is sourced from the **most authoritative available source** for that geography. Fallbacks are clearly labeled (Cached / Fallback) and use curated values from official publications when APIs are unavailable.

---

## 2. India Macro Indicators — Source of Truth

| Indicator | Primary source | Fallback / alternative | Used for |
|-----------|----------------|------------------------|----------|
| **RBI Repo Rate** | RBI MPC Decision (RBI DBIE API when available) | Manually maintained value after each MPC meeting (6×/year) | Cost of funds, risk-free rate context |
| **CPI Inflation** | MOSPI Press Release (data.gov.in CPI API when available) | Manually maintained value after each monthly release | Real returns, inflation adjustment |
| **GDP Growth** | World Bank Open Data (annual) | MOSPI provisional estimates | Macro growth assumption |
| **10Y Bond Yield** | FRED INDIRLTLT01STM (India long-term govt bond yield) | CCIL / Trading Economics (RBI/CCIL reference) | Discount rate, WACC, risk-free benchmark |
| **USD/INR** | FRED DEXINUS → Open Exchange Rate API | Manual fallback (updated periodically) | FX risk, international capital |
| **Hotel Supply Growth** | Industry estimate (HVS / JLL) | No official API; curated annual estimate | Sector supply for hospitality deals |

These feed directly into the **Factor engine** and **underwriter** (WACC, discount rates, growth assumptions). The Market Intelligence tab shows per-indicator **source** and **as-of date** so partners can verify provenance.

---

## 3. City Demand Profile — Source of Truth

City data is **always** pulled for the **deal’s geographical location** (property city/state).

| Metric | Source | Fallback |
|--------|--------|----------|
| **Airport passengers** | data.gov.in (AAI traffic) | AAI Annual Traffic Report (e.g. FY2024-25 provisional) |
| **Domestic / foreign tourists** | data.gov.in / Ministry of Tourism | India Tourism Statistics (state-level) |
| **Housing Price Index** | RBI HPI (data.gov.in when available) | RBI Quarterly House Price Index (city-level) |

The **Composite Demand Score** (0–100) is computed from:

- **Tourism growth** (40% weight)
- **Air traffic growth** (30% weight)
- **GDP growth** (30% weight)

This score is used in the **Factor engine** and contributes to the **recommendation** (Invest / Hold / De-risk / Exit).

---

## 4. Big 4–Grade Factors — What Feeds the Recommendation

Partners expect the following to be explicitly sourced and visible:

1. **Risk-free rate** — RBI Repo and/or 10Y G-Sec (for discounting and WACC).
2. **Inflation** — CPI (real returns, indexation).
3. **Growth** — GDP growth (macro), tourism and air traffic (city demand).
4. **FX** — USD/INR (for cross-border capital and revenue).
5. **Sector supply** — Hotel supply growth (hospitality pipeline).
6. **Real estate context** — Housing Price Index (city-level collateral and market health).
7. **Demand composite** — Single 0–100 score from tourism, air traffic, and GDP used in scoring.

The **recommendation** (and Factor score) is derived from:

- Underwriter output (IRR, NPV, DSCR, etc.)
- Factor engine (using macro + deal assumptions)
- Decision engine (verdict and confidence)

Market Intelligence is the **single place** where partners can verify that every input is from the correct **source of truth for the investment’s geography**.

---

## 5. Code and Configuration

- **Macro data**: `packages/mcp/src/service.ts` — `getMacroIndicators()`, `getFactorMacro()`
- **City profile**: `packages/mcp/src/service.ts` — `getCityProfile(city)`
- **Demand signals**: `packages/mcp/src/service.ts` — `getDemandSignals(city)`
- **Clients**: `packages/mcp/src/clients/` — `rbi.ts`, `world-bank.js`, `fred.js`, `data-gov-in.js`
- **UI**: `packages/ui/src/components/dashboard/MarketIntelligenceTab.tsx`
- **Deal location**: Deal dashboard passes `property.location.city` (and optionally state) to the Market Intel tab so city data is always geography-specific.

API keys (optional but recommended for live data):

- `RBI_API_KEY` — RBI DBIE (repo rate)
- `FRED_API_KEY` — FRED (bond yield, USD/INR)
- `DATA_GOV_IN_API_KEY` — data.gov.in (CPI, airport, etc.)

When keys are missing or APIs are down, the service uses **curated fallbacks** from the same official publications (RBI MPC, MOSPI, World Bank, AAI, Ministry of Tourism, RBI HPI).
