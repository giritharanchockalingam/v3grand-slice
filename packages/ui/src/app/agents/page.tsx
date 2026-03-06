'use client';

/**
 * CFO Agent Hub — Landing page showing all 16 specialist agents organized in 4 categories.
 * Each card links to the agent's dedicated workspace.
 */

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AgentCard } from '@/components/agents/AgentCard';
import type { AgentListItem } from '@/lib/agents/types';
import { AGENT_CATEGORIES } from '@/lib/agents/agent-registry';
import { api } from '@/lib/api-client';

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter agents based on search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;

    const query = searchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.title.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Build categorized agents
  const categorizedAgents = useMemo(() => {
    return AGENT_CATEGORIES.map((category) => ({
      ...category,
      items: filteredAgents.filter((agent) =>
        (category.agents as string[]).includes(agent.id)
      ),
    }));
  }, [filteredAgents]);

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
          16 AI specialist analysts powered by Claude — each an expert in their domain. Click any agent to start a conversation.
        </p>
      </div>

      {/* Search / Filter Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search agents by name, role, or specialty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-surface-200 rounded-lg bg-surface-50 text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Categorized Agent Grid */}
      {loading ? (
        <div className="space-y-12">
          {Array.from({ length: 4 }).map((_, categoryIdx) => (
            <div key={categoryIdx} className="space-y-4">
              <div className="h-8 w-48 bg-surface-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-surface-200 bg-surface-50 p-4 sm:p-6 h-48 sm:h-64 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {categorizedAgents.map((category) => (
            <div key={category.id}>
              {/* Category Header */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-surface-900">{category.label}</h2>
                <p className="text-sm text-surface-500 mt-1">{category.description}</p>
              </div>

              {/* Category Grid - 4 columns */}
              {category.items.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  {category.items.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-surface-500">
                  <p>No agents found in this category matching your search.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {!loading && filteredAgents.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-surface-500">
            No agents found matching "{searchQuery}". Try a different search term.
          </p>
        </div>
      )}

      {/* Info footer */}
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
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
