'use client';

/**
 * Agent Card: displays a specialist agent with icon, name, description, and suggested prompts.
 * Used in the CFO Agent Hub grid.
 */

import Link from 'next/link';
import type { AgentListItem } from '@/lib/agents/types';

interface AgentCardProps {
  agent: AgentListItem;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group relative flex flex-col rounded-2xl border border-surface-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-brand-300 transition-all duration-200 overflow-hidden"
    >
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${agent.color}`} />

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-2xl shadow-sm`}>
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-surface-900 group-hover:text-brand-600 transition-colors leading-tight">
            {agent.title}
          </h3>
          <p className="text-xs font-medium text-surface-500 mt-0.5 uppercase tracking-wide">
            {agent.name}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-surface-600 leading-relaxed mb-4 flex-1">
        {agent.description}
      </p>

      {/* Suggested Prompts */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Try asking</p>
        <div className="space-y-1">
          {agent.suggestedPrompts.slice(0, 3).map((prompt, i) => (
            <p
              key={i}
              className="text-xs text-surface-500 truncate pl-3 border-l-2 border-surface-200 group-hover:border-brand-300 transition-colors"
              title={prompt}
            >
              {prompt}
            </p>
          ))}
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </div>
    </Link>
  );
}
