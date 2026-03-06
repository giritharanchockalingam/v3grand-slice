/**
 * GET /api/agents — List all available CFO specialist agents.
 * Returns agent metadata for the Agent Hub UI.
 */

import { NextResponse } from 'next/server';
import { getAgentList } from '@/lib/agents/agent-registry';

export async function GET() {
  const agents = getAgentList();
  return NextResponse.json({ agents });
}
