/**
 * GET /api/agents/health — Diagnostic endpoint for the CFO agent system.
 * Checks env vars and tool availability without making an actual LLM call.
 */

import { NextResponse } from 'next/server';
import { isAnthropicKeyConfigured } from '@/lib/agents/claude-client';
import { getAgentList } from '@/lib/agents/agent-registry';

export async function GET() {
  const anthropicKey = isAnthropicKeyConfigured();
  const agents = getAgentList();

  // Check which env vars are present (without revealing values)
  const envStatus = {
    ANTHROPIC_API_KEY: anthropicKey,
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    RBI_API_KEY: Boolean(process.env.RBI_API_KEY),
    FRED_API_KEY: Boolean(process.env.FRED_API_KEY),
    DATA_GOV_IN_API_KEY: Boolean(process.env.DATA_GOV_IN_API_KEY),
  };

  let toolCount = 0;
  let toolError: string | null = null;
  try {
    const { getAllToolNames } = await import('@/lib/agents/mcp-tool-bridge');
    toolCount = getAllToolNames().length;
  } catch (err) {
    toolError = err instanceof Error ? err.message : String(err);
  }

  const healthy = anthropicKey && !toolError;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      agents: agents.length,
      tools: toolCount,
      env: envStatus,
      toolError,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
