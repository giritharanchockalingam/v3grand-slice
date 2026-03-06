'use client';

/**
 * Agent Chat: Full chat interface for a specialist agent.
 * Displays messages with tool call badges, markdown rendering, and streaming support.
 * Reuses the proven AgentReplyTiles component for markdown→tile rendering.
 */

import React, { useRef, useEffect } from 'react';
import { AgentReplyTiles } from '@/components/agent/AgentReplyTiles';
import type { AgentChatMessage } from '@/hooks/use-agent-chat';

interface AgentChatProps {
  messages: AgentChatMessage[];
  loading: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  agentName: string;
  agentIcon: string;
  suggestedPrompts: string[];
  placeholder?: string;
}

export function AgentChat({
  messages,
  loading,
  onSend,
  onClear,
  agentName,
  agentIcon,
  suggestedPrompts,
  placeholder = 'Ask a question...',
}: AgentChatProps) {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    onSend(msg);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      {messages.length > 0 && (
        <div className="flex justify-between items-center pb-3 border-b border-surface-200 mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agentIcon}</span>
            <span className="text-sm font-semibold text-surface-700">{agentName}</span>
            <span className="text-xs text-surface-400">
              {messages.filter((m) => m.role === 'user').length} messages
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            New conversation
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 min-h-0 mb-4">
        {/* Empty state with suggested prompts */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <span className="text-5xl mb-4">{agentIcon}</span>
            <h3 className="text-xl font-bold text-surface-900 mb-2">{agentName}</h3>
            <p className="text-sm text-surface-500 mb-6 max-w-md">
              Ask me anything about my domain. I have access to your portfolio data and analytical tools.
            </p>
            <div className="grid gap-2 w-full max-w-lg">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSend(prompt)}
                  className="text-left rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700 hover:bg-white hover:border-brand-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all duration-150"
                >
                  <span className="text-surface-400 mr-2">→</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${
              m.role === 'user'
                ? 'ml-12 bg-brand-500/10 border border-brand-200/50 rounded-2xl rounded-tr-md px-4 py-3'
                : 'mr-4'
            }`}
          >
            {m.role === 'user' ? (
              <p className="text-sm text-surface-900 whitespace-pre-wrap">{m.content}</p>
            ) : (
              <div>
                {/* Tool call badges */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {m.toolCalls.map((tc, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-100 border border-surface-200 px-2.5 py-1 text-xs font-medium text-surface-600"
                        title={`${tc.name} (${tc.durationMs ?? '?'}ms)`}
                      >
                        <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {tc.name.replace(/_/g, ' ')}
                        {tc.durationMs != null && (
                          <span className="text-surface-400 ml-0.5">{tc.durationMs}ms</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Response content — render errors as alerts, normal as tiles */}
                {m.isError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-sm text-amber-800">{m.content}</p>
                    </div>
                  </div>
                ) : m.content?.trim() ? (
                  <AgentReplyTiles text={m.content} />
                ) : (
                  <p className="text-sm text-surface-500 italic">No response received.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-3 mr-4 px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" />
            </div>
            <span className="text-sm text-surface-500">{agentName} is analyzing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0 border-t border-surface-200 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-surface-300 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
