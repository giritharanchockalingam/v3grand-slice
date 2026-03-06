'use client';

/**
 * React hook for managing CFO specialist agent chat state.
 * Handles message history, sending, loading state, and tool call tracking.
 */

import { useState, useCallback } from 'react';
import type { AgentToolCall } from '@/lib/agents/types';

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AgentToolCall[];
  agentId?: string;
  isError?: boolean;
}

interface UseAgentChatOptions {
  agentId: string;
}

export function useAgentChat({ agentId }: UseAgentChatOptions) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      setError(null);
      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setLoading(true);

      try {
        // Build history from previous messages (for context continuity)
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Use fetch directly so we can handle non-2xx responses with reply bodies
        const resp = await fetch('/api/agents/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, message, history }),
        });

        const data = await resp.json().catch(() => null);

        if (data?.reply) {
          // Server returned a reply (even on error status codes)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.reply,
              toolCalls: data.toolCalls,
              agentId: data.agentId,
              isError: Boolean(data.error),
            },
          ]);
          if (data.error) setError(data.reply);
        } else if (!resp.ok) {
          // Truly broken response — no reply field
          const fallback = `The agent service returned an error (${resp.status}). Please try again.`;
          setError(fallback);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: fallback, isError: true },
          ]);
        } else {
          // Unexpected shape
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data?.reply ?? 'No response received.',
              toolCalls: data?.toolCalls,
              agentId: data?.agentId,
            },
          ]);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to send message';
        setError(errMsg);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Unable to reach the agent service. Please check your connection and try again.',
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [agentId, messages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  };
}
