/**
 * Agent loop: LLM + tool execution until final reply or max rounds.
 * Uses OpenAI chat completions with function calling.
 * RAG-style: injects retrieved context (deals list, optional macro) before the first LLM call (HMS Aurora–aligned context enrichment).
 */

import OpenAI from 'openai';
import type { AgentToolRunner } from '@v3grand/mcp-server/agent-tools';

const SYSTEM_PROMPT = `You are the V3 Grand Investment OS assistant. You help users with deal data, market indicators, engine runs (factor, Monte Carlo, budget, S-curve), stress tests, risks, audit, readiness, and compliance.

Anti-hallucination contract: Use ONLY the provided tools to fetch data. Never invent deal IDs, IRR, NPV, verdicts, or any numbers. All metrics and verdicts must come from tool responses (get_deal_dashboard, run_*, get_risks, deal_readiness, etc.).

Financial terms used in this portal (you may explain these when asked; do not invent numbers—use tools for deal-specific values):
- ADR: Average Daily Rate (room rate). IRR: Internal Rate of Return. NPV: Net Present Value. WACC: Weighted Average Cost of Capital (discount rate; formula: cost of equity × E/(D+E) + after-tax cost of debt × D/(D+E)). DSCR: Debt Service Coverage Ratio (EBITDA / debt service). EBITDA: Earnings Before Interest, Taxes, Depreciation, Amortization; in this portal derived from GOP minus management fee, incentive fee, and FF&E reserve. GOP: Gross Operating Profit. RevPAR: Revenue per Available Room. FCFE: Free Cash Flow to Equity. LTV: Loan-to-Value (debt ratio). FF&E: Furniture, Fixtures & Equipment. Exit multiple: used for exit valuation (e.g. exit value = final-year EBITDA × exit multiple). Target IRR / Target DSCR: hurdle metrics in financial assumptions.
- For "how is X calculated?" you may explain the standard formula and add how this portal uses it (e.g. WACC is in Assumptions and drives the hurdle rate; EBITDA appears on deal dashboard and pro forma exports).

Rules:
- If the user asks for something you cannot do with the tools, say so and suggest a tool they might use (e.g. list_deals, get_deal_dashboard, get_risks, deal_readiness).
- Prefer listing deals first (list_deals) then fetching a specific deal or dashboard (get_deal, get_deal_dashboard) when the user refers to "the deal" or a name.
- For stress tests or sensitivity, you need a dealId; get it from list_deals or get_deal_dashboard.
- Keep answers concise but complete. Include key numbers from tool results when relevant.
- Format replies for readability: use a short heading (e.g. ## Topic) then a brief definition; use bullet points (• or -) for lists of terms or steps; use plain text for formulas (e.g. WACC = (cost of equity × E/(D+E)) + (after-tax cost of debt × D/(D+E))). Do not use LaTeX or display math (no \\[ \\] or \\( \\)); the UI shows plain text only.`;

/** RAG-style context enrichment: retrieve deals (and optional macro) so the LLM has grounded context before the first turn. */
async function buildRetrievedContext(toolRunner: AgentToolRunner): Promise<string> {
  const parts: string[] = [];
  try {
    const dealsResult = await toolRunner.callTool('list_deals', { limit: 8 });
    const text = dealsResult.content.map((c) => c.text).filter(Boolean).join('\n');
    if (text && !text.toLowerCase().includes('error')) {
      try {
        const jsonStart = text.indexOf('{');
        const jsonStr = jsonStart >= 0 ? text.slice(jsonStart) : text;
        const parsed = JSON.parse(jsonStr) as { deals?: Array<{ id?: string; name?: string }> };
        const deals = parsed?.deals ?? (Array.isArray(parsed) ? parsed : []);
        const list = (deals as Array<{ id?: string; name?: string }>)
          .slice(0, 8)
          .map((d) => `${d.name ?? 'Unnamed'} (${d.id ?? '—'})`)
          .join('; ');
        if (list) parts.push(`Deals available: ${list}.`);
      } catch {
        if (text.length < 500) parts.push(`Deals snapshot: ${text.trim()}.`);
      }
    }
  } catch {
    // ignore
  }
  try {
    const macroResult = await toolRunner.callTool('get_macro_indicators', {});
    const macroText = macroResult.content.map((c) => c.text).filter(Boolean).join('\n');
    if (macroText && !macroText.toLowerCase().includes('error') && macroText.length < 400) {
      parts.push(`Macro context: ${macroText.trim()}.`);
    }
  } catch {
    // ignore
  }
  if (parts.length === 0) return '';
  return `[Retrieved context for grounding]\n${parts.join('\n')}`;
}

export interface AgentResult {
  reply: string;
  toolCallsUsed: string[];
  rounds: number;
}

export async function runAgentLoop(
  openai: OpenAI,
  toolRunner: AgentToolRunner,
  message: string,
  options: {
    model: string;
    maxToolRounds: number;
    userId?: string;
    role?: string;
    /** If true, prepend retrieved context (deals list, macro) to the first user message (RAG-style). */
    useRetrievedContext?: boolean;
  },
): Promise<AgentResult> {
  const tools = toolRunner.listToolsForLLM();
  const retrievedContext =
    options.useRetrievedContext !== false ? await buildRetrievedContext(toolRunner) : '';
  const userContent =
    retrievedContext.length > 0 ? `${retrievedContext}\n\nUser question: ${message}` : message;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
  const toolCallsUsed: string[] = [];
  let rounds = 0;

  while (rounds < options.maxToolRounds) {
    rounds += 1;
    const response = await openai.chat.completions.create({
      model: options.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });

    const choice = response.choices[0];
    if (!choice?.message) {
      return {
        reply: 'No response from the model.',
        toolCallsUsed,
        rounds,
      };
    }

    const msg = choice.message;
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        reply: (msg.content as string) || 'Done.',
        toolCallsUsed,
        rounds,
      };
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      const argsStr = tc.function?.arguments;
      if (!name) continue;
      toolCallsUsed.push(name);
      let args: unknown = {};
      if (argsStr) {
        try {
          args = JSON.parse(argsStr);
        } catch {
          args = {};
        }
      }
      try {
        const result = await toolRunner.callTool(name, args);
        const content = result.content.map((c) => c.text).filter(Boolean).join('\n');
        messages.push({
          role: 'tool',
          tool_call_id: tc.id!,
          content: content || 'OK',
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id!,
          content: `Error: ${errMsg}`,
        });
      }
    }
  }

  return {
    reply: 'Maximum tool-call rounds reached. Please try a simpler question.',
    toolCallsUsed,
    rounds,
  };
}
