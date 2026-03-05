# HMS Aurora–Style AI Agent Architecture

This document **reviews and studies** the HMS Aurora Portal’s AI agent implementation and **architects V3 Grand’s agent the same way**, so we keep a single, robust pattern for tool-backed assistants, workflows, and anti-hallucination.

**References:** [HMS Aurora Portal](https://github.com/giritharanchockalingam/hms-aurora-portal), [HMS_AURORA_UI_UX_REFERENCE.md](HMS_AURORA_UI_UX_REFERENCE.md), [MCP_AGENTIC_ARCHITECTURE.md](MCP_AGENTIC_ARCHITECTURE.md), [AGENTIC_AI_IMPLEMENTATION_PLAN.md](AGENTIC_AI_IMPLEMENTATION_PLAN.md).

---

## 1. HMS Aurora Agent Model (Reference)

### 1.1 High-level architecture

HMS Aurora uses a **unified AI assistant** backed by:

| Layer | Role |
|-------|------|
| **MCP servers** | Domain-specific tools over HTTP; one endpoint per server (e.g. `mcp-operations`, `mcp-guest`, `mcp-financial`). Handlers: `initialize`, `tools/list`, `tools/call`. |
| **Orchestrator** | Builds **ExecutionPlan** from workflow specs; runs **steps** in dependency order; runs **verification** checks; returns **ExecutionReport** (plan → execute → verify). |
| **Tool result contract** | Success: `content: [{ type: 'text', text }, { type: 'data'|'json', data }]`. Error: `content: [{ type: 'text', text: '...' }], isError: true`. |
| **Anti-hallucination** | Evidence requirements (source = server + tool + field); never-fabricate list; verification required for critical workflows. |
| **Errors** | `MCPError` with codes; `OrchestrationError` for multi-step failures; consistent API error formatting. |

### 1.2 Plan → Execute → Verify

- **ExecutionPlan:** `planId`, `workflowType`, `steps[]`, `verificationChecks[]`, `context`.
- **WorkflowStep:** `id`, `description`, `server`, `tool`, `args`, `dependsOn`, `isReadOnly`, `isVerification`, `rollbackTool?`, `maxRetries`.
- **Execution:** Topological run of steps; resolve `$stepId.path` from prior step results; call MCP `tools/call` per step.
- **Verification:** After steps, run checks that call a tool and **assert** on result (e.g. `field`, `operator`, `expected`). Advisory vs hard failures.
- **Report:** `ExecutionReport` with `stepResults`, `verificationResults`, `status` (verified | failed | rolled_back), `errors`, `warnings`.

### 1.3 UI/UX (Aurora-aligned)

- **Named assistant** (e.g. Grand): one identity in FAB, panel title, loading copy.
- **Tile-based replies:** Structured cards (section, list, paragraph) from tool/API, not only parsed markdown.
- **Floating assistant:** FAB + slide-up panel from any page; “Full page” and “New conversation.”
- **Empty states:** Suggested prompts (e.g. “List my deals”, “What is WACC?”); workflows: single clear line when API is down.
- **Loading:** “Grand is thinking…” (one bubble); workflows: phase + steps with status/duration in tiles.
- **Errors:** One primary line + optional hint; amber for recoverable, red for hard failures.

---

## 2. V3 Grand Architecture (Same Way)

### 2.1 Component map (Aurora → V3 Grand)

| Aurora concept | V3 Grand implementation |
|----------------|-------------------------|
| **MCP server(s)** | Single **packages/mcp-server** (stdio; optional HTTP later). Same tool contract: `content[]` with `text` / `data`, `isError`. |
| **Tool registry** | Tools registered in mcp-server: market, deals, engines, validation, risks. **listToolsForLLM()** + **callTool(name, args)** used by both chat and executor. |
| **Unified assistant endpoint** | **POST /agent/chat** (packages/api). Accepts `message`; returns `reply`, `tiles?`, `toolCallsUsed`, `rounds`. |
| **Orchestrator** | **packages/api/src/agent**: `workflow-registry.ts` (fixed recipes), `orchestrator-types.ts` (ExecutionPlan, StepResult, VerificationCheck, ExecutionReport), **executor.ts** (topological execute + verification). |
| **Plan types** | **orchestrator-types.ts**: `WorkflowStep`, `ExecutionPlan`, `StepResult`, `VerificationCheck`, `AssertionRule`, `ExecutionReport`, `WorkflowExecuteResponse`, `OrchestrationError`. |
| **Workflow API** | **GET /agent/workflows**, **POST /agent/workflows/validate**, **POST /agent/workflows/:name/execute**. Response: HMS-style `status`, `verification`, `timing`, `_debug`. |
| **Agent loop** | **agent-loop.ts**: OpenAI with tool_calls; in-process **AgentToolRunner** (same as MCP); RAG-style **buildRetrievedContext** (list_deals + get_macro_indicators); canonical tool early-return with **tiles** (market intel, WACC, EBITDA, list_deals). |
| **Anti-hallucination** | **ANTI_HALLUCINATION_CONTRACT.md** + system prompt: only use tools; never invent dealId, IRR, NPV, verdicts. Workflows produce all outputs via tools. |
| **Tool result shape** | **packages/mcp-server/errors.ts**: `toolResultSuccess(text, data?)`, `toolResultError(...)`, `content[]` with `text`/`data`; **toHandlerContent** for handlers that only return text (agent-loop still parses JSON from text when needed, e.g. list_deals → tiles). |
| **MCPError-style** | **MCPErrorCode** enum; **MCPError** class; tool handlers return consistent error content. |
| **UI: Agent page** | **AgentPageContent.tsx**: Workflows (left), Grand (right); WorkflowProgress (phase, steps, verification); AgentChatPanel (messages, tiles, suggested prompts). |
| **UI: Tiles** | **StructuredReplyTiles** (section/list from API); **AgentReplyTiles** (markdown blocks → cards). |
| **UI: Floating agent** | **FloatingAgent**: FAB, same chat API, “Full page” / “New conversation.” |

### 2.2 Data flow (chat)

```
User message
  → POST /agent/chat
  → runAgentLoop(openai, toolRunner, message)
  → buildRetrievedContext(toolRunner)  [list_deals, get_macro_indicators]
  → LLM with tools; if tool_calls:
       callTool(name, args) → content[]
       canonical tools (market intel, WACC, EBITDA, list_deals) → return { reply, tiles } early
       else append tool result, re-call LLM
  → reply.send({ reply, tiles?, toolCallsUsed, rounds })
  → UI: tiles ? StructuredReplyTiles : AgentReplyTiles(text)
```

### 2.3 Data flow (workflows)

```
User selects workflow, clicks Execute
  → POST /agent/workflows/validate  [optional dealId]
  → POST /agent/workflows/:name/execute  { dealId? }
  → getWorkflow(name) → WorkflowSpec.buildPlan(input) → ExecutionPlan
  → executePlan(plan, toolRunner)
       topological sort of steps
       for each step: resolveStepRefs(args, stepContent) → callTool(tool, args) → StepResult
       for each verificationCheck: callTool → getValueFromToolContent → evaluateAssertion
  → ExecutionReport → WorkflowExecuteResponse
  → UI: WorkflowProgress(phase, steps, verification, error)
```

### 2.4 Design principles (aligned with HMS)

1. **Single source of tools** — MCP server (or in-process runner) is the only implementor of tools; chat and workflows both use it.
2. **Structured replies** — Where possible, tools (or agent loop) return **tiles** (section/list) so the UI does not depend on markdown parsing for critical flows (e.g. list my deals, market intel, WACC).
3. **Plan → execute → verify** — Workflows are explicit plans with steps and verification checks; executor runs them and reports status/verification/errors.
4. **No fabrication** — System prompt + contract: IRR, NPV, verdict, dealId, etc. only from tool results.
5. **Consistent errors** — MCPError-style codes; orchestrator errors with code, message, server, tool; UI shows one-line message + hint.
6. **Named assistant + tile UX** — Grand, suggested prompts, “Grand is thinking…”, reply tiles, workflow step tiles.

---

## 3. Gaps and Recommendations

| Gap | Recommendation | Status |
|-----|----------------|--------|
| **list_deals by user** | Today `listDeals(db)` is global. For multi-tenant, pass `userId` into tool context and use `listDealsByUser(db, userId)` in agent/workflow context. | **Done:** `ToolContext` with `userId`; `callTool(name, args, context?)`; `list_deals` uses `listDealsByUser` when `context?.userId`; chat and workflow execute pass context. |
| **Tool result `data` in handler return** | Some handlers use `toHandlerContent(result)` which flattens `data` to JSON text. For richer tiles from tools, allow handlers to return `content: [{ type: 'text', text }, { type: 'data', data: { tiles } }]` and have agent-loop prefer `data.tiles` when present. | **Done:** `ToolContentItem` = `text` \| `data`; `list_deals` returns `data: { deals, total, tiles }`; agent-loop uses `data.tiles` when present; executor maps to `MCPContent` for step results. |
| **Streaming** | Optional: stream LLM tokens and/or step progress for workflows to improve perceived performance (Aurora may support this). | Not implemented. |
| **Conversation persistence** | Optional: store conversationId and messages server-side for multi-turn context (Aurora-style sessions). | Not implemented. |
| **Workflow registry from YAML** | Optional: load workflow specs from YAML (as in Aurora) for non-developer edits; current code-based registry is sufficient for now. | Not implemented. |
| **Rollback** | WorkflowStep has `rollbackTool?` / `rollbackArgs?`; executor does not yet run rollback on failure. Add optional rollback phase when status === 'failed' and step defines rollback. | **Done:** After verification, if `status === 'failed'`, executor runs rollback in reverse step order for steps with `rollbackTool` and `rollbackArgs`; status set to `rolled_back` if any rollback ran; errors use `ROLLBACK_FAILED`. |

---

## 4. File Reference (V3 Grand)

| Purpose | Path |
|---------|------|
| Agent loop (LLM + tools, RAG, canonical tiles) | `packages/api/src/agent/agent-loop.ts` |
| Agent routes (chat, workflows, validate) | `packages/api/src/routes/agent.ts` |
| Orchestrator types | `packages/api/src/agent/orchestrator-types.ts` |
| Workflow specs & plan build | `packages/api/src/agent/workflow-registry.ts` |
| Plan execution & verification | `packages/api/src/agent/executor.ts` |
| MCP tool runner (in-process) | `packages/mcp-server/src/agent-tools.ts` |
| Tool result / errors | `packages/mcp-server/src/errors.ts` |
| Deal tools | `packages/mcp-server/src/tools/deals.ts` |
| Market tools (tiles) | `packages/mcp-server/src/tools/market.ts` |
| Agent page (Workflows + Grand) | `packages/ui/src/app/agent/AgentPageContent.tsx` |
| Chat panel & message list | `packages/ui/src/components/agent/AgentChatPanel.tsx` |
| Structured tiles (section/list) | `packages/ui/src/components/agent/StructuredReplyTiles.tsx` |
| Markdown → tiles | `packages/ui/src/components/agent/AgentReplyTiles.tsx` |
| Workflow progress UI | `packages/ui/src/components/agent/WorkflowProgress.tsx` |
| Floating agent FAB | `packages/ui/src/components/agent/FloatingAgent.tsx` |
| HMS UI/UX reference | `docs/HMS_AURORA_UI_UX_REFERENCE.md` |
| Anti-hallucination contract | `docs/ANTI_HALLUCINATION_CONTRACT.md` |
| Cursor rule (HMS UI) | `.cursor/rules/hms-aurora-ui.mdc` |

---

## 5. Summary

V3 Grand’s agent is **architected the same way** as HMS Aurora’s robust AI agent:

- **One MCP-style tool layer** (mcp-server + in-process runner) used by both **chat** and **workflows**.
- **Unified assistant** at **POST /agent/chat** with tool-calling loop, RAG context, and canonical structured **tiles** for key answers.
- **Orchestrator** with **ExecutionPlan**, **WorkflowStep**, **VerificationCheck**, and **ExecutionReport**; **executor** runs steps and verification and returns HMS-style response.
- **Anti-hallucination** contract and system prompt; errors and tool results follow a consistent shape.
- **UI** follows HMS Aurora reference: named assistant (Grand), tile-based replies, floating agent, suggested prompts, workflow progress with steps and verification.

Use this document together with [HMS_AURORA_UI_UX_REFERENCE.md](HMS_AURORA_UI_UX_REFERENCE.md) and [MCP_AGENTIC_ARCHITECTURE.md](MCP_AGENTIC_ARCHITECTURE.md) for any new agent or workflow feature so the implementation stays aligned with the HMS Aurora model.
