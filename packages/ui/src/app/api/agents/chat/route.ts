/**
 * POST /api/agents/chat — Send a message to a CFO specialist agent.
 *
 * Request body: { agentId: string, message: string, history?: Array<{role, content}> }
 * Response: { reply: string, toolCalls: AgentToolCall[], agentId: string, model: string }
 *
 * If agentId is omitted, auto-routes to the best specialist based on message content.
 * Uses Claude SDK with tool_use loop, delegating tool execution to the MCP Tool Bridge.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getAgent, routeToAgent } from '@/lib/agents/agent-registry';
import { getClaudeTools, executeTool } from '@/lib/agents/mcp-tool-bridge';
import { runAgentLoop } from '@/lib/agents/claude-client';
import type { AgentChatRequest, AgentChatResponse } from '@/lib/agents/types';
import type { ToolContext } from '@v3grand/mcp-server/agent-tools';

export const maxDuration = 60; // Vercel function timeout

export async function POST(request: Request) {
  try {
    // Auth (optional — demo mode may not send tokens)
    const user = await getAuthUser(request);

    const body = (await request.json()) as AgentChatRequest;
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Resolve agent: explicit ID or auto-route
    let agent = body.agentId ? getAgent(body.agentId) : null;
    if (!agent) {
      agent = routeToAgent(message);
    }

    // Get Claude-formatted tools for this agent
    const tools = getClaudeTools(agent.toolNames);

    // Build the full system prompt with format instructions
    const systemPrompt = `${agent.systemPrompt}\n\n${agent.formatInstructions}`;

    // Tool execution context with user info.
    // When no authenticated user, omit userId so list_deals returns ALL deals
    // instead of filtering by a non-existent user ID.
    const toolContext: ToolContext = {
      userId: user?.userId,
      role: user?.role ?? 'lead_investor',
    };

    // Run the agent loop
    const result = await runAgentLoop({
      systemPrompt,
      tools,
      messages: history,
      userMessage: message,
      executeTool: (name, input) => executeTool(name, input, toolContext),
    });

    const response: AgentChatResponse = {
      reply: result.reply,
      toolCalls: result.toolCalls,
      agentId: agent.id,
      model: 'claude-sonnet-4-20250514',
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('POST /api/agents/chat failed:', err);

    // Handle specific error types
    if (err instanceof Response) {
      return err; // Auth error thrown as Response
    }

    const errMsg = err instanceof Error ? err.message : 'Internal server error';
    const isKeyMissing = errMsg.includes('Anthropic API key') || errMsg.includes('ANTHROPIC_API_KEY');
    const status = isKeyMissing ? 503 : 500;

    // Return a structured response that the client can render nicely
    return NextResponse.json(
      {
        reply: isKeyMissing
          ? 'The agent system is not fully configured yet. The Anthropic API key needs to be added to the deployment environment variables and the app needs to be redeployed.'
          : `Something went wrong while processing your request. Please try again. (${errMsg})`,
        toolCalls: [],
        agentId: 'system',
        model: 'none',
        error: true,
      },
      { status },
    );
  }
}
