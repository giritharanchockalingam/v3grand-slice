/**
 * Type definitions for the CFO Multi-Agent System.
 * Each specialist agent has a system prompt, tool access, and suggested prompts.
 */

/** A single message in the agent conversation */
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Tool calls made during this turn (assistant only) */
  toolCalls?: AgentToolCall[];
  /** Structured tiles for rich rendering (assistant only) */
  tiles?: AgentTile[];
}

/** Record of a tool call made by the agent */
export interface AgentToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: string;
  durationMs?: number;
}

/** Structured tile for rich UI rendering */
export interface AgentTile {
  type: 'section' | 'list' | 'metric' | 'table';
  title?: string;
  body?: string;
  items?: string[];
  data?: unknown;
}

/** Claude tool definition (Anthropic API format) */
export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/** Agent definition in the registry */
export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string; // emoji or icon identifier
  color: string; // tailwind color class
  systemPrompt: string;
  toolNames: string[];
  suggestedPrompts: string[];
  formatInstructions: string;
}

/** Response from POST /api/agents/chat */
export interface AgentChatResponse {
  reply: string;
  toolCalls: AgentToolCall[];
  tiles?: AgentTile[];
  agentId: string;
  model: string;
}

/** Response from GET /api/agents */
export interface AgentListItem {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  suggestedPrompts: string[];
}

/** Request body for POST /api/agents/chat */
export interface AgentChatRequest {
  agentId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
