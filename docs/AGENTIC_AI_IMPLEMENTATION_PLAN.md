# Smart Agentic AI for V3 Grand Investment OS — Implementation Plan

This plan turns the [MCP architecture](MCP_AGENTIC_ARCHITECTURE.md) and [HMS Aurora reference](MCP_AGENTIC_ARCHITECTURE.md#10-reference-hms-aurora-portal) into a working **smart agentic AI** inside V3 Grand. For **enterprise-grade** validation, critical factors for deal create/update, and additional workflows (IC readiness, market alignment, etc.), see [ENTERPRISE_VALIDATION_AND_ENHANCEMENT_PLAN.md](ENTERPRISE_VALIDATION_AND_ENHANCEMENT_PLAN.md).

---

## Readiness: What We Have

| Item | Status | Notes |
|------|--------|--------|
| **Architecture doc** | Done | Goals, concepts, full tool inventory, transports, agent loop options, security, Aurora reference (orchestrator, anti-hallucination, errors). |
| **Reference model** | Done | HMS Aurora: MCP servers (HTTP), plan → execute → verify, tool result shape, MCPError, workflow registry, anti-hallucination contract. |
| **MCP server (stdio)** | Done | `packages/mcp-server` with **market + deal + engine + validation** tools. Run with `pnpm --filter @v3grand/mcp-server start`. |
| **DB/API surface** | Done | `getDealById`, `listDeals`, dashboard, engines, validation routes. |
| **Deal / engine / validation tools** | Done | Phase 1 complete: `list_deals`, `get_deal`, `get_deal_dashboard`, `run_factor`, `run_montecarlo`, `run_budget`, `run_scurve`, `get_validation_models`, `run_stress_test`, `run_reverse_stress_test`, `run_sensitivity`, `verify_hash_chain`, `get_compliance_controls`. |
| **Phase 1 smoke-test** | Done | `pnpm --filter @v3grand/mcp-server run smoke` or `./scripts/smoke-test-mcp.sh` (in-process tool calls). |
| **Agent loop** | Done | POST /agent/chat with OpenAI + in-process tool runner (HMS-style). Auth via authGuard; optional userId/role for future deal scoping. |
| **API for UI** | Done | POST /agent/chat returns { reply, toolCallsUsed?, rounds, conversationId? }. |
| **Anti-hallucination contract** | Partial | System prompt enforces “use only tools; never invent numbers or verdicts”. Formal contract (Phase 3) optional. |

**Conclusion:** We have the design and reference; we do **not** yet have the full tool set, the agent service, or the API. The plan below gets us to a minimal “smart agentic AI” and then to a fuller one.

---

## Phase 1: Full MCP tool set (no LLM yet)

**Goal:** The MCP server exposes all tools the agent will call. Cursor/Claude can already use them; later the in-repo agent will call the same tools.

1. **Deal tools** (in `packages/mcp-server`, need DB)
   - Add `@v3grand/db` to mcp-server (or call API via HTTP; prefer DB for one less hop).
   - Implement `list_deals` (limit, optional userId if we pass context), `get_deal`, `get_deal_dashboard`.
   - Dashboard: reuse logic from API (get deal, latest recommendation, latest engine results, activity). Either import a shared “buildDashboard” from api or duplicate minimal logic in mcp-server.
   - **Auth:** For stdio, no user context. For HTTP/agent, pass `userId`/`role` in context and filter deals by `listDealsByUser` or allow list_deals with limit only (no user filter) for first version.

2. **Engine tools** (run and persist)
   - `run_factor`, `run_montecarlo`, `run_budget`, `run_scurve`: wrap engines + `insertEngineResult` + optional `insertAuditEntry` with `triggeredBy: 'mcp-agent'`.
   - Inputs: `dealId` + optional overrides (e.g. `macroIndicators`, `iterations`). Require `dealId`; get deal from DB, reconstitute, run engine, persist, return output.
   - Add `@v3grand/engines` and `@v3grand/db` to mcp-server (and any recompute helpers if we want `recompute_deal` as one tool).

3. **Validation tools**
   - `get_validation_models`, `run_stress_test`, `verify_hash_chain`, `get_compliance_controls`: wrap existing validation routes / services. May need to import from api or move shared logic to a package used by both api and mcp-server.

4. **Tool result shape**
   - Align with Aurora: return `content: [{ type: 'text', text }, { type: 'data', data }]` where useful so the agent can parse structured data.

5. **Errors**
   - Introduce small `MCPError`-style codes and a formatter in mcp-server so every tool returns `{ content: [...], isError: true }` with a consistent structure.

**Deliverable:** One MCP server (stdio) with market + deal + engine + validation tools, callable from Cursor/Claude or from an in-process runner.

**Smoke-test:** Run `pnpm --filter @v3grand/mcp-server run smoke` or `./scripts/smoke-test-mcp.sh`. With `DATABASE_URL` set, tests `get_macro_indicators`, `market_health`, `list_deals`, `get_validation_models`, `get_compliance_controls`. Without DB, tests market tools only.

---

## Phase 2 decision: Follow HMS Aurora pattern

Phase 2 (in-repo agent) will **follow the HMS Aurora Portal** reference (see [MCP_AGENTIC_ARCHITECTURE.md §10](MCP_AGENTIC_ARCHITECTURE.md#10-reference-hms-aurora-portal)):

- **Unified assistant endpoint** — One entry point (e.g. `POST /agent/chat` or a Supabase/API function) that accepts user message and returns reply after tool use, analogous to Aurora’s unified-ai-assistant / mcp-orchestrator.
- **Plan → execute → verify** — Use orchestrator-style types: `ExecutionPlan`, `WorkflowStep` (id, server/tool, args, dependsOn, isReadOnly, isVerification), `StepResult`, `VerificationCheck`, `ExecutionReport`. Execute steps (call MCP tools in-process or over HTTP), then run verification steps that assert on tool outputs.
- **Tool result shape** — Align with Aurora: `content: [{ type: 'text', text }, { type: 'data', data }]`, `isError` for failures (already done in mcp-server).
- **Anti-hallucination contract** — Define V3 Grand–specific `EvidenceRequirement`, `neverFabricate` (e.g. IRR, NPV, verdict, dealId only from tools), and enforce via system prompt and optional response checks.
- **Error handling** — Use `MCPError`-style codes and consistent error content (already in mcp-server); orchestrator can map to `OrchestrationError` for multi-step failures.
- **Optional workflow registry** — Later we can add YAML/fixed recipes (e.g. “dashboard → stress_test → deal”) as in Aurora’s workflow-registry; first version can use LLM-generated or fixed plans only.

**Where it lives:** Prefer **Option B** (routes under `packages/api`, e.g. `POST /agent/chat`) so one deployable hosts both API and agent, and we reuse auth. The agent will call the same MCP tool handlers in-process (no HTTP to self), matching Aurora’s orchestrator calling MCP servers.

---

## Phase 2: In-repo agent (LLM + tools)

**Goal:** A service that accepts a user message, calls an LLM with tool definitions, executes tool_calls, and returns a final answer.

1. **Where it lives**
   - **Option A:** New package `packages/agent` that depends on mcp-server (in-process tool runner, no HTTP to self) and an LLM client (OpenAI/Anthropic/other).
   - **Option B:** New routes under `packages/api` (e.g. `POST /agent/chat`) that build the same tool runner in-process and call the LLM from the API. Keeps one deployable and avoids a separate agent process.

2. **Agent loop (minimal)**
   - Receive: `{ message: string, conversationId?: string }`.
   - Load tool definitions from the same registry the MCP server uses (or call `tools/list` in-process).
   - Call LLM with system prompt + user message + tools; system prompt states “You are the V3 Grand Investment OS assistant. Use only the provided tools for deal data, metrics, and engine runs; never invent numbers or verdicts.”
   - If LLM returns tool_calls: for each, run the corresponding tool handler (same as mcp-server), collect results, append to messages, call LLM again (with tool results). Repeat until LLM returns a final text reply (no more tool_calls) or max iterations (e.g. 10).
   - Return: `{ reply: string, toolCallsUsed?: string[], conversationId?: string }`.

3. **LLM provider**
   - Config: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (or both; we choose one as default). Use a small provider-agnostic layer (e.g. OpenAI-compatible client) so we can switch.

4. **Auth**
   - If under API: reuse existing auth (e.g. `authGuard`). Pass `userId` (and role) into the agent context so deal tools can scope to `listDealsByUser` and dashboard.

**Deliverable:** `POST /agent/chat` (or equivalent) that returns one reply after zero or more tool calls, with optional conversationId for future multi-turn.

**RAG-style context enrichment (HMS Aurora–aligned):** Before the first LLM call, the agent can inject **retrieved context** (e.g. `list_deals` + `get_macro_indicators`) into the user message so the model has grounded deal names/IDs and macro snapshot. This is implemented in `packages/api/src/agent/agent-loop.ts` (`buildRetrievedContext` + `useRetrievedContext`). Full RAG (embeddings + vector store over runbooks or deal docs) can be added later as an optional enhancement.

---

## Phase 3: Plan–execute–verify (optional)

**Goal:** Align with Aurora-style orchestrator for multi-step workflows with verification.

1. **ExecutionPlan / WorkflowStep types**
   - **Done:** `packages/api/src/agent/orchestrator-types.ts`: `WorkflowStep`, `ExecutionPlan`, `StepResult`, `VerificationCheck`, `AssertionRule`, `VerificationResult`, `ExecutionReport`, `WorkflowStatus`, `OrchestrationError`. Single logical server `v3grand`.

2. **Planner**
   - **Done:** Fixed recipes in `workflow-registry.ts` (no YAML): `deal_dashboard_stress`, `deal_summary_validation`. Build plan from workflow name + input; variable resolution `$stepId.path` from prior step results.

3. **Executor**
   - **Done:** `packages/api/src/agent/executor.ts`: topological step order, resolve args from step results, call tool runner, collect `StepResult`; then run verification checks, evaluate assertions, build `ExecutionReport`.

4. **Verifier**
   - **Done:** Verification checks run after steps; each check calls a tool, gets value by field path from result content, evaluates assertion (eq/neq/gt/lt/exists/etc.). Results in `ExecutionReport.verificationResults`.

5. **API**
   - **Done:** `GET /agent/workflows` (list), `POST /agent/workflows/:name/execute` (body: input). Auth via authGuard. Response: HMS-style `WorkflowExecuteResponse` with `status`, `verification`, `timing`, `_debug` (full report).

**Deliverable:** Orchestrated workflows: list workflows, execute by name with input, get execution report with step and verification results.

---

## Phase 4: UI and polish

- **UI:** **Done.** `packages/ui`: Agent page at `/agent` with (1) **Workflows**: list from `GET /agent/workflows`, select workflow, optional dealId input, Execute → `POST /agent/workflows/:name/execute`; HMS-style **WorkflowProgress** (phase, progress bar, steps with status/duration, verification results, errors). (2) **Assistant**: chat input → `POST /agent/chat`, message list with user/assistant; **assistant replies rendered as tiles** (HMS Aurora–style) via `AgentReplyTiles` (paragraph, list, section, and metric-style blocks as cards). Nav link “Agent” in layout. Uses `useWorkflow` hook and `WorkflowProgress` component aligned with HMS Aurora behaviour (no code copied).
- **Streaming:** Optional: stream LLM tokens and/or tool-call progress for better UX.
- **MCP over HTTP:** Optional: expose the same tools via Streamable HTTP so external clients (e.g. another Cursor workspace) can call the V3 Grand MCP server remotely.

---

## Dependencies and env

- **Phase 1:** Existing deps (db, engines, mcp, core). For mcp-server: add `@v3grand/db`, `@v3grand/engines`; ensure DATABASE_URL and schema (e.g. Supabase) are available when running the server.
- **Phase 2:** LLM client (e.g. `openai` or `@anthropic-ai/sdk`), and `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in env.
- **Phase 3:** No new external deps; only internal types and logic.

---

## Order of implementation

1. **Phase 1** — Full MCP tool set in mcp-server (deals, engines, validation, errors, result shape).  
2. **Phase 2** — Agent loop under API (`POST /agent/chat`) with one LLM provider and in-process tool execution.  
3. **Phase 3** — Plan/execute/verify and anti-hallucination contract (optional).  
4. **Phase 4** — UI and optional HTTP MCP + streaming.

This gives a clear path from “design + market tools only” to a **smart agentic AI** for V3 Grand Investment OS that can list deals, open dashboards, run engines and stress tests, and answer in natural language using only tool-backed data.
