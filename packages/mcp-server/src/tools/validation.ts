// ─── MCP Tools: Validation (models, stress tests, hash chain, compliance) ─
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { z } from 'zod';
import { getDealById, getEngineResultHistory } from '@v3grand/db';
import {
  runScenarioShocks,
  runReverseStressTest,
  runSensitivitySweep,
  verifyHashChain,
  MODEL_INVENTORY,
  getModelCard,
  getModelsRequiringValidation,
} from '@v3grand/engines';
import { toolResultSuccess, toolResultError, toHandlerContent, MCPErrorCode } from '../errors.js';
import { getComplianceControlsSummary } from '../compliance/soc2-controls.js';

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ): void;
};

function reconstructDeal(dealRow: Record<string, unknown>): Record<string, unknown> {
  return {
    id: dealRow.id,
    name: dealRow.name,
    assetClass: dealRow.assetClass,
    status: dealRow.status,
    lifecyclePhase: dealRow.lifecyclePhase,
    currentMonth: dealRow.currentMonth,
    version: dealRow.version,
    property: dealRow.property,
    partnership: dealRow.partnership,
    marketAssumptions: dealRow.marketAssumptions,
    financialAssumptions: dealRow.financialAssumptions,
    capexPlan: dealRow.capexPlan,
    opexModel: dealRow.opexModel,
    scenarios: dealRow.scenarios,
    createdAt: (dealRow.createdAt as Date)?.toISOString?.() ?? '',
    updatedAt: (dealRow.updatedAt as Date)?.toISOString?.() ?? '',
  };
}

export function registerValidationTools(server: Server, db: PostgresJsDatabase): void {
  server.registerTool(
    'get_validation_models',
    z.object({}),
    async () => {
      try {
        const models = MODEL_INVENTORY;
        const requiringValidation = getModelsRequiringValidation().map((m) => m.id);
        return {
          content: toHandlerContent(
            toolResultSuccess('Model inventory and models requiring validation.', {
              models,
              requiringValidation,
            }),
          ),
        };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'get_validation_models failed', MCPErrorCode.INTERNAL_ERROR)) };
      }
    },
  );

  server.registerTool(
    'get_validation_model_card',
    z.object({ modelId: z.string().min(1).describe('Model id from inventory') }),
    async (args) => {
      const { modelId } = args as { modelId: string };
      try {
        const card = getModelCard(modelId);
        if (!card) {
          return { content: toHandlerContent(toolResultError(`Model not found: ${modelId}`, MCPErrorCode.INVALID_INPUT)) };
        }
        return { content: toHandlerContent(toolResultSuccess('Model card.', card)) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'get_validation_model_card failed', MCPErrorCode.INTERNAL_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_stress_test',
    z.object({ dealId: z.string().uuid() }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstructDeal(dealRow as Record<string, unknown>);
        const results = runScenarioShocks(deal as unknown as Parameters<typeof runScenarioShocks>[0]);
        return { content: toHandlerContent(toolResultSuccess(`Stress test completed for deal ${dealId}.`, { dealId, shocks: results })) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_stress_test failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_reverse_stress_test',
    z.object({ dealId: z.string().uuid() }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstructDeal(dealRow as Record<string, unknown>);
        const results = runReverseStressTest(deal as unknown as Parameters<typeof runReverseStressTest>[0]);
        return { content: toHandlerContent(toolResultSuccess(`Reverse stress test completed for deal ${dealId}.`, { dealId, breakPoints: results })) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_reverse_stress_test failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_sensitivity',
    z.object({
      dealId: z.string().uuid(),
      parameter: z.enum(['occupancy', 'adr', 'exitMultiple', 'interestRate', 'capex', 'inflation']).describe('Parameter to sweep'),
      min: z.number(),
      max: z.number(),
      steps: z.number().int().min(2).max(100).optional(),
    }),
    async (args) => {
      const { dealId, parameter, min, max, steps = 20 } = args as {
        dealId: string;
        parameter: 'occupancy' | 'adr' | 'exitMultiple' | 'interestRate' | 'capex' | 'inflation';
        min: number;
        max: number;
        steps?: number;
      };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstructDeal(dealRow as Record<string, unknown>);
        const result = runSensitivitySweep(
          deal as unknown as Parameters<typeof runSensitivitySweep>[0],
          parameter,
          { min, max, steps },
        );
        return { content: toHandlerContent(toolResultSuccess(`Sensitivity sweep for ${parameter}.`, { dealId, sensitivity: result })) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_sensitivity failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'verify_hash_chain',
    z.object({
      dealId: z.string().uuid(),
      engine: z.string().min(1).describe('Engine name (e.g. factor, montecarlo)'),
    }),
    async (args) => {
      const { dealId, engine } = args as { dealId: string; engine: string };
      try {
        const history = await getEngineResultHistory(db, dealId, engine, undefined, 100);
        if (history.length === 0) {
          return {
            content: toHandlerContent(
              toolResultSuccess(`No results for engine ${engine}; chain is vacuously valid.`, { dealId, engine, chainLength: 0, valid: true }),
            ),
          };
        }
        const chain = [...history].reverse().map((r) => {
          const row = r as Record<string, unknown>;
          return {
            contentHash: (row.contentHash as string) ?? 'genesis',
            previousHash: (row.previousHash as string) ?? 'genesis',
            engineName: (row.engineName as string) ?? engine,
            version: (row.version as number) ?? 0,
            scenarioKey: (row.scenarioKey as string) ?? 'base',
            input: (row.input ?? {}) as Record<string, unknown>,
            output: (row.output ?? {}) as Record<string, unknown>,
          };
        });
        const result = verifyHashChain(chain);
        return {
          content: toHandlerContent(
            toolResultSuccess(result.valid ? 'Hash chain is valid.' : 'Hash chain verification failed.', {
              dealId,
              engine,
              chainLength: chain.length,
              ...result,
            }),
          ),
        };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'verify_hash_chain failed', MCPErrorCode.INTERNAL_ERROR)) };
      }
    },
  );

  server.registerTool(
    'get_compliance_controls',
    z.object({}),
    async () => {
      try {
        const { controls, summary } = getComplianceControlsSummary();
        return { content: toHandlerContent(toolResultSuccess('SOC 2 / ISAE 3402 control matrix.', { controls, summary })) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'get_compliance_controls failed', MCPErrorCode.INTERNAL_ERROR)) };
      }
    },
  );
}
