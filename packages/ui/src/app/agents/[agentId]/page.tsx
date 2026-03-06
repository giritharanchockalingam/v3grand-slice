'use client';

/**
 * Per-agent workspace: Info sidebar + full chat interface.
 * Displays agent metadata on the left, chat on the right.
 */

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAgentChat } from '@/hooks/use-agent-chat';
import { AgentChat } from '@/components/agents/AgentChat';
import type { AgentListItem } from '@/lib/agents/types';
import { api } from '@/lib/api-client';

export default function AgentWorkspacePage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const { user } = useAuth();
  const [agent, setAgent] = useState<AgentListItem | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const { messages, loading, sendMessage, clearMessages } = useAgentChat({ agentId });

  useEffect(() => {
    // Fetch agent metadata
    api.get<{ agents: AgentListItem[] }>('/agents')
      .then((res) => {
        const found = res.agents.find((a) => a.id === agentId);
        setAgent(found ?? null);
      })
      .catch(() => {
        // Fallback to local registry
        import('@/lib/agents/agent-registry').then(({ getAgent }) => {
          const a = getAgent(agentId);
          if (a) {
            setAgent({
              id: a.id,
              name: a.name,
              title: a.title,
              description: a.description,
              icon: a.icon,
              color: a.color,
              suggestedPrompts: a.suggestedPrompts,
            });
          }
        });
      })
      .finally(() => setLoadingAgent(false));
  }, [agentId]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-surface-500">Please log in to access the agent workspace.</p>
      </div>
    );
  }

  if (loadingAgent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-surface-500">Agent not found.</p>
        <Link href="/agents" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to Agent Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-140px)]">
      {/* Sidebar: Agent info — horizontal on mobile, vertical sidebar on desktop */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-3 lg:space-y-4">
        {/* Back link */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Agents
        </Link>

        {/* Agent card — compact on mobile */}
        <div className="rounded-2xl border border-surface-200 bg-white p-4 lg:p-5 space-y-3 lg:space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl lg:text-2xl shadow-sm`}>
              {agent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base lg:text-lg font-bold text-surface-900 leading-tight truncate">{agent.title}</h2>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{agent.name}</p>
            </div>
            {/* Mobile-only status dot */}
            <div className="lg:hidden flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-surface-500">Online</span>
            </div>
          </div>
          <p className="text-sm text-surface-600 leading-relaxed hidden sm:block">{agent.description}</p>

          {/* Capabilities — hidden on small mobile, visible on sm+ */}
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {['Data Analysis', 'Tool Execution', 'Live Portfolio', 'Recommendations'].map((cap) => (
                <span
                  key={cap}
                  className="inline-block rounded-md bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Status indicator — desktop only (shown inline on mobile above) */}
        <div className="hidden lg:block rounded-xl border border-surface-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-surface-600">Online — Claude Sonnet</span>
          </div>
          {messages.length > 0 && (
            <p className="text-xs text-surface-400 mt-2">
              {messages.filter((m) => m.toolCalls && m.toolCalls.length > 0).reduce((sum, m) => sum + (m.toolCalls?.length ?? 0), 0)} tool calls made
            </p>
          )}
        </div>
      </div>

      {/* Chat — full width on mobile, flex-1 on desktop */}
      <div className="flex-1 min-w-0 rounded-2xl border border-surface-200 bg-white p-3 sm:p-4 lg:p-5 min-h-[60vh] lg:min-h-0">
        <AgentChat
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          onClear={clearMessages}
          agentName={agent.title}
          agentIcon={agent.icon}
          suggestedPrompts={agent.suggestedPrompts}
          placeholder={`Ask ${agent.name}...`}
        />
      </div>
    </div>
  );
}
