'use client';

/**
 * Reusable Agent chat panel: message list (with tiles), input, send, optional clear.
 * Used by the Agent page and the floating Agent toast (HMS-style).
 */

import React from 'react';
import { AgentReplyTiles } from './AgentReplyTiles';
import { StructuredReplyTiles } from './StructuredReplyTiles';

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: number;
  /** HMS-style structured tiles from API; when present, render these instead of parsing text */
  tiles?: Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }>;
}

export interface AgentChatPanelProps {
  messages: ChatMessageItem[];
  loading: boolean;
  onSend: (message: string) => void;
  onClear?: () => void;
  showClearButton?: boolean;
  placeholder?: string;
  className?: string;
  /** Display name for the assistant (e.g. "Grand") */
  assistantName?: string;
  /** Suggested prompts shown when there are no messages (HMS-style empty state) */
  suggestedPrompts?: string[];
  /** Compact mode for floating panel (smaller padding) */
  compact?: boolean;
}

export function AgentChatPanel({
  messages,
  loading,
  onSend,
  onClear,
  showClearButton = true,
  placeholder = 'Ask deals, metrics, or governance…',
  className = '',
  assistantName,
  suggestedPrompts,
  compact = false,
}: AgentChatPanelProps) {
  const [input, setInput] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    onSend(msg);
    setInput('');
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {(showClearButton && onClear && messages.length > 0) && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-lg px-2 py-1.5 transition-colors"
            title="Start new conversation"
          >
            New conversation
          </button>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto space-y-3 min-h-0 ${compact ? 'mb-2' : 'mb-4'}`}>
        {messages.length === 0 && !loading && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">
              {assistantName ? `Ask ${assistantName} for deal metrics, market intel, or governance.` : 'Send a message to get started.'}
            </p>
            {suggestedPrompts && suggestedPrompts.length > 0 && (
              <div className="space-y-2">
                <p className="section-title text-surface-500">Suggested</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSend(prompt)}
                      className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-100 hover:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-8 bg-brand-500/15 text-surface-900 border border-brand-200/50'
                : 'mr-8'
            }`}
          >
            {m.role === 'user' ? (
              <p className="whitespace-pre-wrap">{m.text}</p>
            ) : (
              <div className="min-h-[2rem]">
                {m.tiles && m.tiles.length > 0 ? (
                  <StructuredReplyTiles tiles={m.tiles} />
                ) : m.text?.trim() ? (
                  <AgentReplyTiles text={m.text} />
                ) : null}
                {!(m.tiles && m.tiles.length > 0) && !m.text?.trim() && (
                  <p className="text-sm text-surface-500 italic">No response. Try a suggested prompt below or check connectivity.</p>
                )}
                {m.toolCalls != null && m.toolCalls > 0 && (
                  <p className="text-xs text-surface-500 mt-3">Used {m.toolCalls} tool call(s)</p>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-8 rounded-lg px-3 py-2 text-sm bg-surface-100 text-surface-500 border border-surface-200">
            {assistantName ? `${assistantName} is thinking...` : 'Thinking...'}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default AgentChatPanel;
