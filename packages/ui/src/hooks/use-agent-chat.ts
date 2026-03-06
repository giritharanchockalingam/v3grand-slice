'use client';

/**
 * React hook for managing CFO specialist agent chat state.
 * Handles message history, sending, loading state, and tool call tracking.
 */

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { AgentChatResponse, AgentToolCall } from '@/lib/agents/types';

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AgentToolCall[];
  agentId?: string;
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

        const res = await api.post<AgentChatResponse>('/agents/chat', {
          agentId,
          message,
          history,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reply,
            toolCalls: res.toolCalls,
            agentId: res.agentId,
          },
        ]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to send message';
        setError(errMsg);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${errMsg}`,
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
