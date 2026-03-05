/**
 * Agent tool runner for in-process use by the API (POST /agent/chat).
 * Exposes the same MCP tools as the stdio server, with listToolsForLLM() for OpenAI format
 * and callTool(name, args) for execution.
 *
 * Import from '@v3grand/mcp-server/agent-tools'.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createMarketDataService } from '@v3grand/mcp';
import { registerMarketTools } from './tools/market.js';
import { registerDealTools } from './tools/deals.js';
import { registerEngineTools } from './tools/engines.js';
import { registerValidationTools } from './tools/validation.js';
import { registerRiskTools } from './tools/risks.js';

export type MarketDataService = Awaited<ReturnType<typeof createMarketDataService>>;

type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

export interface AgentToolRunner {
  listToolsForLLM(): OpenAITool[];
  callTool(name: string, args: unknown): Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

/** OpenAI chat completions tools format */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function createRunner(db: PostgresJsDatabase, marketService: MarketDataService): AgentToolRunner {
  const tools = new Map<string, { schema: z.ZodType; handler: ToolHandler }>();

  const server = {
    registerTool(name: string, schema: z.ZodType, handler: ToolHandler) {
      tools.set(name, { schema, handler });
    },
  };

  registerMarketTools(server, marketService);
  registerDealTools(server, db);
  registerEngineTools(server, db);
  registerValidationTools(server, db);
  registerRiskTools(server, db);

  return {
    listToolsForLLM(): OpenAITool[] {
      const result: OpenAITool[] = [];
      for (const [name, { schema }] of tools) {
        const jsonSchema = zodToJsonSchema(schema, { $refStrategy: 'none' });
        const params = (typeof jsonSchema === 'object' && jsonSchema !== null ? jsonSchema : {}) as Record<string, unknown>;
        const description =
          (params.description as string) || `V3 Grand tool: ${name.replace(/_/g, ' ')}`;
        result.push({
          type: 'function',
          function: {
            name,
            description,
            parameters: {
              type: 'object',
              properties: (params.properties as Record<string, unknown>) ?? {},
              required: (params.required as string[]) ?? [],
              ...(params.additionalProperties !== undefined && { additionalProperties: params.additionalProperties }),
            },
          },
        });
      }
      return result;
    },

    async callTool(name: string, args: unknown): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
      const t = tools.get(name);
      if (!t) throw new Error(`Unknown tool: ${name}`);
      return t.handler(args);
    },
  };
}

/** Create the agent tool runner for use by the API. Requires db and marketService from the API. */
export function createAgentToolRunner(
  db: PostgresJsDatabase,
  marketService: MarketDataService,
): AgentToolRunner {
  return createRunner(db, marketService);
}
