# Anti-Hallucination Contract (Enterprise)

All agent and workflow outputs that cite **deal data**, **metrics**, or **recommendations** must be traceable to tool results. Nothing may be fabricated.

## Evidence requirement

- **IRR, NPV, verdict, confidence, dealId:** Must come only from `get_deal_dashboard`, `get_deal`, `run_*` (factor, montecarlo, budget, scurve), `run_stress_test`, `run_sensitivity`, or `get_risks` / `deal_readiness` tool responses.
- **Market data (ADR, occupancy, macro):** Must come only from `get_macro_indicators`, `get_city_profile`, `get_demand_signals`, `get_construction_costs`, or from deal snapshots (`marketSnapshotAtCreate`, `macroSnapshotAtCreate`) stored at deal create.

## Never fabricate

The following must **never** be invented by the LLM; they may only be returned when present in a tool response:

- `dealId`, `deal.id`
- `irr`, `npv`, `verdict`, `confidence`, `gateResults`
- `shocks`, stress test outcomes
- `sensitivity` sweep results
- Risk counts, risk titles, audit entries
- Recommendation history, engine result versions

## Enforcement

- **System prompt** (agent-loop): Instructs the model to use only the provided tools and never invent numbers or verdicts.
- **Workflow executor**: All numeric and verdict outputs are produced by tool calls; the orchestrator does not generate content.
- **Audit**: Workflow execution is audited with `module: 'agent'`, `action: 'workflow.executed'`, and `diff` including workflow name and status when `dealId` is in scope.

## Reference

- [MCP_AGENTIC_ARCHITECTURE.md](MCP_AGENTIC_ARCHITECTURE.md) §10.4 (Aurora anti-hallucination)
- [AGENTIC_AI_IMPLEMENTATION_PLAN.md](AGENTIC_AI_IMPLEMENTATION_PLAN.md) (Phase 2/3)
