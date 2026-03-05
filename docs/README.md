# Documentation

Central index for V3 Grand vertical slice documentation.

| Document | Description |
|----------|-------------|
| [RUNBOOK.md](RUNBOOK.md) | **Operational runbook** — Prerequisites, quick start (fresh machine), demo credentials, step-by-step walkthroughs (Investor Dashboard, Assumption Sensitivity, Scenario Comparison, Construction Monitoring, Risk Register), re-seeding, project structure, and troubleshooting. |
| [WORKFLOW_REFERENCE_MANUAL.md](WORKFLOW_REFERENCE_MANUAL.md) | **Workflow & recommendation reference** — User-friendly manual for everyone from novice to expert: what the platform does, core concepts, how the recommendation is built (gates, pass rate, verdict, confidence), end-to-end workflows, Feasibility and IC memo, reference tables, glossary, and FAQ. Big 4 / top SaaS style. |
| [GAP_ANALYSIS.md](GAP_ANALYSIS.md) | **Spec vs implementation** — Comparison of the codebase against the platform specification: what’s implemented, partial, or missing per package (core, engines, db, api, ui, infra, workflows), gap summaries by area, and overall completeness estimates. |
| [GAP_ANALYSIS_ADDENDUM.md](GAP_ANALYSIS_ADDENDUM.md) | **Addendum & build/deploy readiness** — Delta since the original gap analysis, build and deploy readiness checklists, and actions to be fully ready for build and deploy. |
| [GAP_ANALYSIS_VS_SPEC.md](GAP_ANALYSIS_VS_SPEC.md) | **Gap analysis vs. 5 PDF specs** — Validation of the codebase against the five specification documents in `../Documentation/` (Platform Blueprint, Implementation Plan, Developer Scaffolding, Execution Playbook, Next-Phase Roadmap). Package-by-package status and build/deploy readiness. |
| [MCP_AGENTIC_ARCHITECTURE.md](MCP_AGENTIC_ARCHITECTURE.md) | **MCP & HMS Aurora reference** — Agentic architecture, tool inventory, orchestrator (plan → execute → verify), and mapping from [HMS Aurora Portal](https://github.com/giritharanchockalingam/hms-aurora-portal). |
| [HMS_AURORA_UI_UX_REFERENCE.md](HMS_AURORA_UI_UX_REFERENCE.md) | **HMS Aurora–aligned UI/UX** — World-class UI/UX principles for the Agent and agentic surfaces: hierarchy, tiles, empty/loading/error states, accessibility. Use when building or refining the portal experience. |
| [HMS_AURORA_AGENT_ARCHITECTURE.md](HMS_AURORA_AGENT_ARCHITECTURE.md) | **HMS Aurora–style agent architecture** — Review of Aurora’s AI agent model (MCP, orchestrator, plan→execute→verify, anti-hallucination) and V3 Grand’s aligned design: component map, data flows, file reference, gaps and recommendations. Use when extending or auditing the agent. |
| [MARKET_INTELLIGENCE_SOURCES.md](MARKET_INTELLIGENCE_SOURCES.md) | **Market Intelligence source of truth** — Where every macro and city metric comes from (RBI, MOSPI, World Bank, FRED, data.gov.in). Big 4–grade factors that feed the Factor engine and recommendation. |
| [IAIP_PLATFORM_SPEC.md](IAIP_PLATFORM_SPEC.md) | **Investor Advisory Intelligence Platform (IAIP)** — Production-ready spec extending V3 Grand: architecture, schema, API contracts, 5 institutional features (DQ/NL, Backtest, Triangulation, SSM, AGAT), algorithms, UI structure, scaffolding plan, roadmap. |
| [EXCEL_MODEL_VALIDATION.md](EXCEL_MODEL_VALIDATION.md) | **Excel model validation** — Tab-by-tab validation of the platform against the Board-Ready Business Model Excel; gaps and added features (board criteria, capital structure scenarios, Phase 2 gate, WACC/hurdle, probability-weighted return). Big 4 / CFO perspective. |

**Specification PDFs:** The five comprehensive spec documents are in the repository at **[`/Documentation/`](../Documentation/)** (not in `docs/`): `V3-Grand-Platform-Blueprint-v2.pdf`, `V3-Grand-Implementation-Plan.pdf`, `V3-Grand-Developer-Scaffolding.pdf`, `V3-Grand-Execution-Playbook.pdf`, `V3-Grand-Next-Phase-Roadmap.pdf`. Use them together with [GAP_ANALYSIS_VS_SPEC.md](GAP_ANALYSIS_VS_SPEC.md) to validate the app.

For contribution guidelines and development setup, see the root [CONTRIBUTING.md](../CONTRIBUTING.md). For project overview and quick start, see the root [README.md](../README.md).
