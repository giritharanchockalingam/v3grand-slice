/**
 * Thin wrapper around the Anthropic SDK for the CFO agent system.
 * Implements a tool_use loop: sends messages, executes tool calls, feeds results back,
 * until Claude returns a text-only response (max 8 rounds).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeTool, AgentToolCall } from './types';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 8;
const MAX_TOKENS = 4096;

let clientInstance: Anthropic | null = null;

/** Check whether the Anthropic API key is configured. */
export function isAnthropicKeyConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'The Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your environment variables and redeploy.'
      );
    }
    clientInstance = new Anthropic({ apiKey });
  }
  return clientInstance;
}

type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<string>;

interface RunAgentLoopParams {
  systemPrompt: string;
  tools: ClaudeTool[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  executeTool: ToolExecutor;
}

interface AgentLoopResult {
  reply: string;
  toolCalls: AgentToolCall[];
}

/** Max retries for rate-limited API calls */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2_000;

/**
 * Call Anthropic messages.create with automatic retry on 429 rate-limit errors.
 * Uses exponential backoff: 2s → 4s → 8s.
 */
async function createWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err: unknown) {
      const isRateLimit =
        (err instanceof Anthropic.RateLimitError) ||
        (err instanceof Error && err.message.includes('rate_limit')) ||
        (err instanceof Error && err.message.includes('429'));

      if (isRateLimit && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        const jitter = Math.random() * 1_000;
        console.log(`[retry] Rate limited, waiting ${Math.round(backoff + jitter)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but TypeScript wants it
  throw new Error('Exceeded max retries');
}

/**
 * Run the agent loop: send messages to Claude, execute any tool calls,
 * feed results back, repeat until text-only response.
 */
export async function runAgentLoop({
  systemPrompt,
  tools,
  messages: history,
  userMessage,
  executeTool,
}: RunAgentLoopParams): Promise<AgentLoopResult> {
  const client = getClient();
  const allToolCalls: AgentToolCall[] = [];

  // Build conversation from history + new user message
  const conversationMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await createWithRetry(client, {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages: conversationMessages,
    });

    // Check if Claude wants to use tools
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    // If no tool calls, we're done — extract text response
    if (toolUseBlocks.length === 0) {
      const reply = textBlocks.map((b) => b.text).join('\n\n');
      return { reply, toolCalls: allToolCalls };
    }

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolBlock of toolUseBlocks) {
      const startTime = Date.now();
      let output: string;
      try {
        output = await executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>);
      } catch (err) {
        output = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
      const durationMs = Date.now() - startTime;

      allToolCalls.push({
        name: toolBlock.name,
        input: toolBlock.input as Record<string, unknown>,
        output: output.length > 500 ? output.slice(0, 500) + '...' : output,
        durationMs,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: output,
      });
    }

    // Append assistant message (with tool_use blocks) and tool results
    conversationMessages.push({
      role: 'assistant',
      content: response.content,
    });
    conversationMessages.push({
      role: 'user',
      content: toolResults,
    });
  }

  // If we exhausted rounds, return whatever text we have
  return {
    reply: 'I used the maximum number of tool calls for this query. Here is what I found so far based on the data gathered.',
    toolCalls: allToolCalls,
  };
}
