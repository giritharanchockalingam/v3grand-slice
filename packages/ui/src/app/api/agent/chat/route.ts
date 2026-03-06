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
    // Auth (optional — demo mode may not send tokens)
    const user = await getAuthUser(request);

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Auto-route to best specialist agent
    const agent = routeToAgent(message);
    const tools = getClaudeTools(agent.toolNames);
    const systemPrompt = `${agent.systemPrompt}\n\n${agent.formatInstructions}`;

    // When no authenticated user, omit userId so list_deals returns ALL deals
    const toolContext: ToolContext = {
      userId: user?.userId,
      role: user?.role ?? 'lead_investor',
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

    const errMsg = err instanceof Error ? err.message : 'Internal server error';
    const isKeyMissing = errMsg.includes('Anthropic API key') || errMsg.includes('ANTHROPIC_API_KEY');
    const status = isKeyMissing ? 503 : 500;

    return NextResponse.json(
      {
        reply: isKeyMissing
          ? 'The agent system is not fully configured yet. The Anthropic API key needs to be added to the deployment environment variables.'
          : `Something went wrong. Please try again. (${errMsg})`,
        toolCallsUsed: 0,
      },
      { status },
    );
  }
}
