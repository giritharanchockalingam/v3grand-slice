/**
 * Agent tool runner for in-process use by the API (POST /agent/chat).
 * Exposes the same MCP tools as the stdio server, with listToolsForLLM() for OpenAI format
 * and callTool(name, args, context?) for execution.
 *
 * HMS Aurora–aligned: tool context (e.g. userId) for multi-tenant list_deals;
 * content may include type: 'data' with tiles for structured replies.
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
import { registerLegalTools } from './tools/legal.js';
import { registerTaxTools } from './tools/tax.js';
import { registerRevenueTools } from './tools/revenue.js';
import { registerEsgTools } from './tools/esg.js';
import { registerFinanceTools } from './tools/finance.js';
import { registerWebSearchTools } from './tools/web-search.js';

export type MarketDataService = Awaited<ReturnType<typeof createMarketDataService>>;

/** Per-request context for tools (e.g. userId for listDealsByUser). */
export interface ToolContext {
  userId?: string;
  role?: string;
}

/** Tool result content item: text and/or structured data (HMS Aurora–aligned). */
export type ToolContentItem =
  | { type: 'text'; text: string }
  | { type: 'data'; data?: unknown };

type ToolHandler = (
  args: unknown,
  context?: ToolContext,
) => Promise<{ content: ToolContentItem[]; isError?: boolean }>;

export interface AgentToolRunner {
  listToolsForLLM(): OpenAITool[];
  callTool(
    name: string,
    args: unknown,
    context?: ToolContext,
  ): Promise<{ content: ToolContentItem[]; isError?: boolean }>;
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
  registerLegalTools(server, { db });
  registerTaxTools(server, { db });
  registerRevenueTools(server, { db });
  registerEsgTools(server, { db });
  registerFinanceTools(server, { db });
  registerWebSearchTools(server);

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

    async callTool(
      name: string,
      args: unknown,
      context?: ToolContext,
    ): Promise<{ content: ToolContentItem[]; isError?: boolean }> {
      const t = tools.get(name);
      if (!t) throw new Error(`Unknown tool: ${name}`);
      const out = await t.handler(args, context);
      return out;
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
