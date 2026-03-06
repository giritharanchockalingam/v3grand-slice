'use client';

/**
 * CFO Agent Hub — Landing page showing all 6 specialist agents in a 2×3 grid.
 * Each card links to the agent's dedicated workspace.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AgentCard } from '@/components/agents/AgentCard';
import type { AgentListItem } from '@/lib/agents/types';
import { api } from '@/lib/api-client';

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ agents: AgentListItem[] }>('/agents')
      .then((res) => setAgents(res.agents))
      .catch(() => {
        // Fallback: import from registry directly (client-safe subset)
        import('@/lib/agents/agent-registry').then(({ getAgentList }) => {
          setAgents(getAgentList());
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-surface-500">Please log in to access the CFO Agent Hub.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">CFO Agent Hub</h1>
        <p className="text-sm text-surface-500 mt-1">
          6 AI specialist analysts powered by Claude — each an expert in their domain. Click any agent to start a conversation.
        </p>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-200 bg-surface-50 p-6 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-surface-700">How it works</p>
            <p className="text-xs text-surface-500 mt-1">
              Each agent has access to specific tools from your Investment OS — market data, deal analytics,
              risk engines, and compliance controls. They analyze your live portfolio data using Claude and
              return structured insights. All tool calls are logged for audit trail compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
