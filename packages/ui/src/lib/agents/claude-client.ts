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

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
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
    const response = await client.messages.create({
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
