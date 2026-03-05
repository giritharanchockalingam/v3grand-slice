# MCP-Architected Agentic AI for V3 Grand

This document describes how to add **Model Context Protocol (MCP)** servers and **agentic AI** to the V3 Grand slice so that AI clients (Cursor, Claude Desktop, or a custom agent loop) can use V3 Grand capabilities as **tools**.

---

## 1. Goals

- **MCP servers** expose V3 Grand operations as **tools** (and optionally **resources** / **prompts**).
- **Agents** (in an AI client or a thin agent service) call these tools to answer user questions, run analysis, or drive workflows.
- **Reference**: Design aligns with the [MCP specification](https://modelcontextprotocol.io/specification/2024-11-05/server) and the [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). If you have a reference repo (path in workspace or GitHub URL), the same patterns can be applied there and mirrored here.

---

## 2. Concepts

| Concept | Role in V3 Grand |
|--------|-------------------|
| **MCP Server** | Process or HTTP service that exposes **tools** (and optionally resources/prompts). Runs as stdio for Claude Desktop/Cursor or as HTTP for remote clients. |
| **Tool** | One capability, e.g. `get_macro_indicators`, `get_deal_dashboard`, `run_factor_engine`. Inputs/outputs are JSON; the client (or LLM) invokes them via `tools/call`. |
| **Agent** | The “brain” that decides which tools to call and in what order. Can live in the AI client (Cursor/Claude) or in a small agent service that talks to MCP servers. |
| **Transport** | How the client talks to the server: **stdio** (local process) or **Streamable HTTP** (remote). |

---

## 3. Proposed layout

```
packages/
  mcp-server/          # NEW: MCP server exposing V3 Grand tools
    src/
      index.ts         # Server entry: stdio or HTTP
      tools/
        market.ts      # get_macro_indicators, get_city_profile, get_construction_costs, market_health
        deals.ts       # list_deals, get_deal, get_deal_dashboard
        engines.ts     # run_factor, run_montecarlo, run_budget, run_scurve (read-only semantics or with audit)
        validation.ts  # get_validation_models, run_stress_test, verify_hash_chain
    package.json       # @modelcontextprotocol/sdk, zod, @v3grand/mcp, @v3grand/core, @v3grand/db, @v3grand/engines
```

- **Single MCP server** today: one process (or one HTTP app) that registers all tools. Later you can split into multiple servers (e.g. `mcp-server-market`, `mcp-server-engines`) if needed.
- **Agent**: For Cursor/Claude Desktop, the agent is the LLM inside the client; it receives tool definitions from this server and calls them. For a custom “agent service”, you’d add a thin loop (e.g. in `packages/api` or a new `packages/agent`) that calls an LLM and the same MCP server over HTTP or in-process.

---

## 4. Tool inventory (first slice)

Tools are designed to be **discoverable** (`tools/list`) and **invokable** (`tools/call`) by an AI client or agent.

### 4.1 Market (from `@v3grand/mcp` + API market routes)

| Tool name | Description | Input (JSON Schema) | Output |
|-----------|-------------|---------------------|--------|
| `get_macro_indicators` | Current macro indicators (repo rate, CPI, GDP, bond yield, USD/INR, etc.) for Factor engine | `{}` | Macro snapshot + cache/source info |
| `get_city_profile` | City-level market profile (airport pax, tourism, housing index) | `{ "city": string }` | City profile |
| `get_demand_signals` | Demand signals for a city (tourism, air traffic, GDP composite) | `{ "city": string }` | DemandSignals |
| `get_construction_costs` | Construction cost trend (index, YoY, forecast) | `{}` | CostTrend |
| `market_health` | MCP data source health and cache stats | `{}` | Health + cache hit rate |

### 4.2 Deals (from API + DB)

| Tool name | Description | Input | Output |
|-----------|-------------|--------|--------|
| `list_deals` | List deals (optional filters) | `{ "limit"?: number }` | Array of deal summaries |
| `get_deal` | Full deal by id | `{ "dealId": string }` | Deal snapshot |
| `get_deal_dashboard` | Dashboard view: metrics, recommendation, activity | `{ "dealId": string }` | Dashboard payload |

### 4.3 Engines (read-only or explicit trigger)

| Tool name | Description | Input | Output |
|-----------|-------------|--------|--------|
| `run_factor` | Run Factor engine for a deal (optionally with macro override) | `{ "dealId": string, "macroIndicators"?: object }` | FactorScoreOutput |
| `run_montecarlo` | Run Monte Carlo for a deal | `{ "dealId": string, "iterations"?: number }` | MCOutput |
| `run_budget` | Run Budget variance analysis | `{ "dealId": string }` | BudgetAnalysisOutput |
| `run_scurve` | Run S-Curve CAPEX distribution | `{ "dealId": string, "totalMonths"?: number }` | SCurveOutput |

All engine tools should **persist** results and **audit** (same as current API); consider a required `triggeredBy: "mcp-agent"` or similar for audit.

### 4.4 Validation & compliance

| Tool name | Description | Input | Output |
|-----------|-------------|--------|--------|
| `get_validation_models` | Model inventory and which require validation | `{}` | MODEL_INVENTORY + list |
| `run_stress_test` | Run scenario shocks / sensitivity / reverse stress | `{ "dealId": string, "mode": "shocks" \| "sensitivity" \| "reverse", ... }` | Stress results |
| `verify_hash_chain` | Verify engine result hash chain for a deal | `{ "dealId": string }` | Verification result |
| `get_compliance_controls` | SOC 2 control matrix (if role allowed) | `{}` | Controls list |

---

## 5. Transports and how to run the server

### 5.1 stdio (Cursor / Claude Desktop)

- Run the server as a **subprocess**; it uses stdin/stdout for JSON-RPC.
- Cursor/Claude Desktop spawns it via config (e.g. `mcp.json` or similar).
- **Config example** (in Cursor or Claude config):

```json
{
  "mcpServers": {
    "v3grand": {
      "command": "pnpm",
      "args": ["--filter", "@v3grand/mcp-server", "start"],
      "cwd": "/path/to/v3grand-slice-cursor"
    }
  }
}
```

- Server entrypoint: instantiate `McpServer`, register all tools, then `server.connect(new StdioServerTransport())`.

### 5.2 Streamable HTTP (remote agent or API)

- Run the server behind HTTP (e.g. Express/Hono) with `NodeStreamableHTTPServerTransport`.
- Use **stateless** mode (`sessionIdGenerator: undefined`) for simple API-style use.
- Agent or API can POST to `/mcp` with the MCP JSON-RPC payload and get tool list / call results.
- Allows running the MCP server on a different host from the AI client.

---

## 6. Agent loop (optional, in-repo)

If you want an **in-repo agent** (not only Cursor/Claude using the server):

- **Option A – Client-side only**: No extra code. Cursor or Claude Desktop is the agent; it has access to the MCP server and calls tools based on user messages.
- **Option B – Agent service**: Add `packages/agent` (or a module under `packages/api`):
  - Receives a **user message** (e.g. “Summarise deal X and run stress test”).
  - Calls an **LLM** with system prompt + message + **tool definitions** from the MCP server (`tools/list`).
  - LLM returns **tool_calls**; the agent runs them via `tools/call` against the same MCP server (HTTP or in-process).
  - Repeats until the LLM returns a final answer; returns that to the user.

That agent service can sit behind a new API route, e.g. `POST /agent/chat` or `POST /mcp/agent`, and reuse the same tool implementations as the stdio MCP server.

---

## 7. Security and auth

- **stdio**: Only the local user can use the server; no network auth.
- **HTTP**: Restrict to localhost or add API key / JWT; consider CORS and rate limits (reuse existing API middleware if the MCP server is mounted in the same app).
- **Tool-level**: Sensitive tools (e.g. run engines, get deal data) can require a **context token** (e.g. JWT or API key) passed in the first argument or via headers in HTTP mode. The MCP server validates the token before calling into `@v3grand/db` or engines.

---

## 8. Reference project (path or URL)

To mirror another project’s MCP/agentic setup:

- **Preferred**: Provide the **path inside this workspace** to the other project (e.g. `../other-repo` or a subfolder), or a **GitHub repo URL** and the folder/file to focus on.
- From that we can:
  - Extract tool naming, input schemas, and transport choices.
  - Map their tools to V3 Grand capabilities (market, deals, engines, validation).
  - Reuse or adapt their agent loop (if any) for `packages/agent`.

**Implemented in this repo:**

- **docs/MCP_AGENTIC_ARCHITECTURE.md** – This document.
- **packages/mcp-server** – MCP server (stdio) with market tools: `get_macro_indicators`, `get_city_profile`, `get_demand_signals`, `get_construction_costs`, `market_health`. Run with `pnpm --filter @v3grand/mcp-server start`. Add to Cursor/Claude MCP config with `command` + `args` + `cwd` as in the package README.

---

## 9. Implementation checklist

- [x] Add `packages/mcp-server` with `@modelcontextprotocol/sdk` and zod.
- [x] Implement market tools (wrap `MarketDataService` from `@v3grand/mcp`).
- [ ] Implement deal tools (wrap API/DB: getDealById, dashboard).
- [ ] Implement engine tools (wrap engines + DB/audit; consider `triggeredBy: "mcp"`).
- [ ] Implement validation tools (wrap validation routes).
- [x] Support stdio transport and document Cursor/Claude config.
- [ ] (Optional) Add Streamable HTTP transport and mount under API or standalone.
- [ ] (Optional) Add `packages/agent` and `POST /agent/chat` that uses the same tools via MCP client or in-process calls.

---

## 10. Reference: HMS Aurora Portal

The [HMS Aurora Portal](https://github.com/giritharanchockalingam/hms-aurora-portal) repo (local path: `../hms-aurora-portal` from this workspace) implements an MCP-style **agentic** architecture that we use as a reference. Below is a concise model of that architecture and how it maps to V3 Grand.

### 10.1 MCP servers (Supabase Edge Functions)

- **One HTTP endpoint per server**; each handles JSON body `{ method, params }` and returns JSON.
- **Protocol handlers**:
  - `initialize` → `{ protocolVersion, capabilities: { tools: {} }, serverInfo: { name, version, description } }`
  - `tools/list` → `{ tools: [{ name, description, inputSchema }] }`
  - `tools/call` → `{ content: [{ type: 'text', text? }, { type: 'data'|'json', data? }], isError?: boolean }`
- **Servers**: `mcp-nlu-booking` (NLU only, no side effects), `mcp-operations`, `mcp-guest`, `mcp-financial`, `mcp-hr`, `mcp-inventory`, `mcp-security`, `mcp-analytics`, `mcp-llm-metrics`. Each exposes domain-specific tools (e.g. `parse_booking_utterance`, `validate_booking_intent`).

**V3 Grand mapping:** Our `packages/mcp-server` is a single server (stdio today) with market tools. We can add deal/engine/validation tools to the same server, or later split into multiple HTTP MCP endpoints (e.g. `/functions/v1/mcp-v3grand-market`, `mcp-v3grand-engines`) if we adopt an Aurora-like multi-server layout.

### 10.2 Tool result shape (Aurora)

- **Success**: `{ content: [{ type: 'text', text }, { type: 'data'|'json', data }], isError?: false }`
- **Error**: `{ content: [{ type: 'text', text: 'Error: ...' }], isError: true }`
- **Shared types** (in Aurora): `MCPToolResult`, `MCPSuccessResult`, `MCPErrorResult` in `_shared/types.ts`.

**V3 Grand:** Our MCP SDK handlers return `{ content: [{ type: 'text', text }] }`. We can add a `data` item for structured payloads to align with Aurora and simplify agent parsing.

### 10.3 Orchestrator pattern (plan → execute → verify)

- **ExecutionPlan**: `planId`, `workflowType`, `steps[]`, `verificationChecks[]`, `context`.
- **WorkflowStep**: `id`, `description`, `server`, `tool`, `args`, `dependsOn`, `isReadOnly`, `isVerification`, `rollbackTool?`, `rollbackArgs?`, `maxRetries`.
- **Execution**: Orchestrator calls each step’s MCP server (HTTP `tools/call`), passes `args`, then runs **verification** steps that assert on tool results (e.g. `field`, `operator`, `expected`).
- **Types**: `MCPServerName`, `WorkflowStep`, `ExecutionPlan`, `StepResult`, `VerificationCheck`, `AssertionRule`, `ExecutionReport`, `OrchestrationError` in `_shared/mcp-orchestrator-types.ts`.
- **Workflow registry**: YAML specs with `planSteps`, `verificationSteps`, `rollbackPlan`, `safetyMetadata` (approval roles, timeouts). Workflows are registered and looked up by name; the orchestrator builds an `ExecutionPlan` from the spec and runs it.

**V3 Grand mapping:** For multi-step agent flows (e.g. “fetch macro → run factor → run underwriter → get recommendation”), we can introduce a small **orchestrator** or **agent** that:
- Builds a plan of tool calls (our MCP tool names + args).
- Executes them in order (or in parallel where independent), calling our MCP server (stdio or HTTP).
- Optionally verifies outcomes (e.g. “recommendation.verdict exists”) and returns an execution report. No YAML registry is required for a first version; the plan can be built by an LLM or a fixed recipe.

### 10.4 Anti-hallucination contract (Aurora)

- **EvidenceRequirement**: claims (e.g. `room_availability`, `room_rate`) must be backed by a specific **source**: `{ server, tool, field }`.
- **VerificationRequired**: workflow types that must run verification steps after execution.
- **NeverFabricate**: list of fields that must never be invented (e.g. `confirmation_number`, `total_amount`).

**V3 Grand mapping:** For any agent or orchestrator we add, we can define a small contract: e.g. “IRR, NPV, verdict must come from `get_deal_dashboard` or `run_*` tool results, not free-form LLM output” and “never fabricate `dealId`, engine result versions, or recommendation verdicts”.

### 10.5 Error handling (Aurora)

- **MCPError** with `MCPErrorCode` (e.g. `MISSING_REQUIRED_FIELD`, `GUEST_NOT_FOUND`, `DATABASE_ERROR`) and `formatErrorResponse(error)` for API responses.
- **OrchestrationError**: `code`, `message`, `server?`, `tool?`, `details?`, `timestamp`.

**V3 Grand:** We can add a small `MCPError`-style enum and formatter in `packages/mcp-server` (or `_shared` if we add more MCP surfaces) so tool handlers return consistent error content and the agent/orchestrator can interpret failures uniformly.

### 10.6 Summary table (Aurora → V3 Grand)

| Aurora concept | Aurora location | V3 Grand equivalent |
|----------------|-----------------|----------------------|
| MCP server (HTTP) | `supabase/functions/mcp-*/index.ts` | `packages/mcp-server` (stdio; optional HTTP later) |
| tools/list + tools/call | `handleMCPRequest`, `handleTool` | SDK `registerTool` + handler; same semantic |
| Tool result shape | `MCPToolResult`, `content[]` with `text`/`data` | Same; add `data` in our handlers if useful |
| Orchestrator | `mcp-orchestrator/index.ts` | Optional `packages/agent` or `api` route that builds plan and calls MCP tools |
| Plan / Step types | `mcp-orchestrator-types.ts` | Optional `packages/agent` or `mcp-server` types for plan/step/verification |
| Workflow registry | `workflow-registry.ts` + YAML | Not required initially; fixed or LLM-generated plans only |
| Anti-hallucination | `ANTI_HALLUCINATION_CONTRACT` | Short contract for deal/engine/recommendation fields |
| MCPError / formatErrorResponse | `_shared/errors.ts` | Optional shared error codes and formatter in mcp-server |
| **RAG / context enrichment** | (Aurora may use retrieval) | **Implemented:** Before first LLM turn, agent calls `list_deals` + `get_macro_indicators` and injects retrieved context into the user message so the model has grounded deal IDs and macro snapshot. Full RAG (embeddings + vector store) can be added later. |

---

## 11. References

- [MCP Specification (2024-11-05)](https://modelcontextprotocol.io/specification/2024-11-05/server) – tools, resources, prompts.
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) – Server guide, transports, `registerTool` with zod.
- [MCP Tools spec](https://modelcontextprotocol.io/specification/2024-11-05/server/tools) – `tools/list`, `tools/call`, JSON Schema for parameters.
- [HMS Aurora Portal](https://github.com/giritharanchockalingam/hms-aurora-portal) – Reference repo for MCP servers, orchestrator (plan → execute → verify), workflow registry, and anti-hallucination contract (see §10 above).
