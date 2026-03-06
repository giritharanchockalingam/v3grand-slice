/**
 * POST /api/agent/chat — Legacy agent chat endpoint used by the floating "Grand" chat.
 * Delegates to the new CFO agent system with auto-routing.
 *
 * Request:  { message: string }
 * Response: { reply: string, toolCallsUsed: number, tiles?: Tile[] }
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { routeToAgent } from '@/lib/agents/agent-registry';
import { getClaudeTools, executeTool } from '@/lib/agents/mcp-tool-bridge';
import { runAgentLoop } from '@/lib/agents/claude-client';
import type { ToolContext } from '@v3grand/mcp-server/agent-tools';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Auto-route to best specialist agent
    const agent = routeToAgent(message);
    const tools = getClaudeTools(agent.toolNames);
    const systemPrompt = `${agent.systemPrompt}\n\n${agent.formatInstructions}`;

    const toolContext: ToolContext = {
      userId: user.userId,
      role: user.role,
    };

    const result = await runAgentLoop({
      systemPrompt,
      tools,
      messages: [],
      userMessage: message,
      executeTool: (name, input) => executeTool(name, input, toolContext),
    });

    return NextResponse.json({
      reply: result.reply,
      toolCallsUsed: result.toolCalls.length,
      tiles: undefined, // Legacy format compatibility
    });
  } catch (err) {
    console.error('POST /api/agent/chat failed:', err);

    if (err instanceof Response) return err;

    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    return NextResponse.json({
      reply: `Error: ${message}`,
      toolCallsUsed: 0,
    }, { status });
  }
}
