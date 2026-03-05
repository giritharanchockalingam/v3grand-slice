'use client';

/**
 * Floating Agent toast (HMS-style): FAB that opens a chat panel from any page.
 * Renders a floating action button (bottom-right); click opens a slide-up panel with the same Agent chat.
 */

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { AgentChatPanel, type ChatMessageItem } from './AgentChatPanel';
import Link from 'next/link';
import { AGENT_NAME } from '@/lib/agent-constants';

type AgentChatResponse = { reply: string; toolCallsUsed?: number };

const PANEL_HEIGHT = 'min(420px, 65vh)';

export function FloatingAgent() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleSend = React.useCallback(async (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setLoading(true);
    try {
      const res = await api.post<AgentChatResponse>('/agent/chat', { message });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.reply ?? '', toolCalls: res.toolCallsUsed },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error: ' + (err instanceof Error ? err.message : String(err)),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = React.useCallback(() => {
    setMessages([]);
  }, []);

  if (!user) return null;

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[100] flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg hover:shadow-xl hover:from-brand-600 hover:to-brand-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
        title={open ? `Close ${AGENT_NAME}` : `Open ${AGENT_NAME}`}
        aria-label={open ? `Close ${AGENT_NAME}` : `Open ${AGENT_NAME}`}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Slide-up panel */}
      {open && (
        <div
          className="fixed inset-0 z-[99] flex flex-col justify-end sm:justify-end pointer-events-none"
          aria-hidden
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/20 pointer-events-auto sm:block"
            onClick={() => setOpen(false)}
            aria-label="Close overlay"
          />
          <div
            className="relative w-full max-w-lg mx-auto rounded-t-2xl sm:rounded-2xl bg-white border border-surface-200 shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
            style={{ height: PANEL_HEIGHT, maxHeight: '65vh' }}
            role="dialog"
            aria-label={AGENT_NAME}
          >
            <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-surface-200 bg-surface-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <span className="font-semibold text-surface-900">{AGENT_NAME}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/agent"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  onClick={() => setOpen(false)}
                >
                  Full page
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <AgentChatPanel
                messages={messages}
                loading={loading}
                onSend={handleSend}
                onClear={handleClear}
                showClearButton
                assistantName={AGENT_NAME}
                suggestedPrompts={['What is WACC?', 'List my deals', 'How is EBITDA calculated?']}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingAgent;
