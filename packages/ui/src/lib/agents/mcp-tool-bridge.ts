/**
 * MCP Tool Bridge: converts existing AgentToolRunner (OpenAI format) to Claude format,
 * and delegates tool execution. Zero changes to existing MCP tools.
 *
 * OpenAI:  { type: 'function', function: { name, description, parameters } }
 *    →
 * Claude:  { name, description, input_schema: parameters }
 */

import { getDb } from '@/lib/server/db';
import { createAgentToolRunner } from '@v3grand/mcp-server/agent-tools';
import { createMarketDataService } from '@v3grand/mcp';
import type { AgentToolRunner, OpenAITool, ToolContext } from '@v3grand/mcp-server/agent-tools';
import type { ClaudeTool } from './types';

let cachedRunner: AgentToolRunner | null = null;

/**
 * Get or create the singleton AgentToolRunner.
 * Lazy-initialized on first call.
 */
function getToolRunner(): AgentToolRunner {
  if (cachedRunner) return cachedRunner;

  const db = getDb();
  const marketService = createMarketDataService({
    rbiApiKey: process.env.RBI_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY,
    fallbackMode: true,
    cacheTtlSeconds: 604800,
  });

  cachedRunner = createAgentToolRunner(db, marketService);
  return cachedRunner;
}

/**
 * Convert OpenAI tool format to Claude tool format.
 */
function openAIToolToClaude(tool: OpenAITool): ClaudeTool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters as ClaudeTool['input_schema'],
  };
}

/**
 * Get all available tools in Claude format, optionally filtered by name.
 */
export function getClaudeTools(filterNames?: string[]): ClaudeTool[] {
  const runner = getToolRunner();
  const allTools = runner.listToolsForLLM();

  const tools = filterNames
    ? allTools.filter((t) => filterNames.includes(t.function.name))
    : allTools;

  return tools.map(openAIToolToClaude);
}

/**
 * Execute a tool by name with given arguments.
 * Returns the tool output as a string (JSON-serialized for structured data).
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context?: ToolContext,
): Promise<string> {
  const runner = getToolRunner();
  const result = await runner.callTool(name, input, context);

  // Combine text and data content items into a single string
  const parts: string[] = [];
  for (const item of result.content) {
    if (item.type === 'text') {
      parts.push(item.text);
    } else if (item.type === 'data' && item.data !== undefined) {
      parts.push(JSON.stringify(item.data, null, 2));
    }
  }

  return parts.join('\n\n');
}

/**
 * Get the list of all available tool names.
 */
export function getAllToolNames(): string[] {
  const runner = getToolRunner();
  return runner.listToolsForLLM().map((t) => t.function.name);
}
