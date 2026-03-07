'use client';

/**
 * Agent Card: Big 4-style professional card with practice area badge,
 * designation, role title, and "Try asking" prompts.
 */

import Link from 'next/link';
import type { AgentListItem } from '@/lib/agents/types';

interface AgentCardProps {
  agent: AgentListItem;
}

const DESIGNATION_STYLE: Record<string, string> = {
  Partner: 'bg-amber-100 text-amber-800 border-amber-200',
  'Managing Director': 'bg-violet-100 text-violet-800 border-violet-200',
  'Senior Director': 'bg-blue-100 text-blue-800 border-blue-200',
  Director: 'bg-teal-100 text-teal-800 border-teal-200',
  'Senior Manager': 'bg-slate-100 text-slate-700 border-slate-200',
};

export function AgentCard({ agent }: AgentCardProps) {
  const designationClass = DESIGNATION_STYLE[agent.designation] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group relative flex flex-col rounded-2xl border border-surface-200 bg-white p-4 sm:p-5 lg:p-6 shadow-sm hover:shadow-lg hover:border-brand-300 transition-all duration-200 overflow-hidden"
    >
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${agent.color}`} />

      {/* Practice area badge + Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className={`flex-shrink-0 w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl sm:text-2xl shadow-sm`}>
          {agent.icon}
        </div>
        <span className="text-2xs font-bold uppercase tracking-widest text-surface-400 bg-surface-50 border border-surface-200 rounded px-1.5 py-0.5">
          {agent.practiceAreaShort}
        </span>
      </div>

      {/* Title + Designation */}
      <div className="mb-2">
        <h3 className="text-sm sm:text-base font-bold text-surface-900 group-hover:text-brand-600 transition-colors leading-tight">
          {agent.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded border ${designationClass}`}>
            {agent.designation}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-surface-500 leading-relaxed mb-3 flex-1 line-clamp-2">
        {agent.description}
      </p>

      {/* Suggested Prompts */}
      <div className="space-y-1.5 pt-2 border-t border-surface-100">
        <p className="text-2xs font-semibold text-surface-400 uppercase tracking-wider">Ask this agent</p>
        <div className="space-y-1">
          {agent.suggestedPrompts.slice(0, 2).map((prompt, i) => (
            <p
              key={i}
              className="text-xs text-surface-500 truncate pl-2.5 border-l-2 border-surface-200 group-hover:border-brand-300 transition-colors"
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
