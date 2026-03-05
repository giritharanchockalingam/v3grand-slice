// ─── Model Validation, Stress Testing & Compliance Routes ───────────
// Exposes validation framework, stress testing, model inventory,
// hash chain verification, and SOC 2 control matrix via API.

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { authGuard, requireRole } from '../middleware/auth.js';
import { getDealById, getEngineResultHistory } from '@v3grand/db';
import {
  runScenarioShocks, runReverseStressTest, runSensitivitySweep, INSTITUTIONAL_SHOCKS,
  verifyHashChain,
  MODEL_INVENTORY, getModelCard, getModelsRequiringValidation,
} from '@v3grand/engines';
import { SOC2_CONTROLS, generateControlMatrix } from '../compliance/soc2-controls.js';

export async function validationRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── GET /validation/models ── Model inventory register
  app.get('/validation/models', { preHandler: authGuard }, async () => {
    return {
      models: MODEL_INVENTORY,
      requireingValidation: getModelsRequiringValidation().map(m => m.id),
    };
  });

  // ── GET /validation/models/:id ── Single model card
  app.get<{ Params: { id: string } }>(
    '/validation/models/:id',
    { preHandler: authGuard },
    async (req, reply) => {
      const card = getModelCard(req.params.id);
      if (!card) return reply.code(404).send({ error: 'Model not found' });
      return card;
    },
  );

  // ── POST /deals/:id/stress-test ── Run scenario shocks
  app.post<{ Params: { id: string } }>(
    '/deals/:id/stress-test',
    { preHandler: requireRole('analyst', 'lead-investor', 'admin') },
    async (req, reply) => {
      const dealRow = await getDealById(db, req.params.id);
      if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

      const deal = reconstructDeal(dealRow);
      const results = runScenarioShocks(deal);
      return { dealId: req.params.id, shocks: results };
    },
  );

  // ── POST /deals/:id/reverse-stress-test ── Find break points
  app.post<{ Params: { id: string } }>(
    '/deals/:id/reverse-stress-test',
    { preHandler: requireRole('analyst', 'lead-investor', 'admin') },
    async (req, reply) => {
      const dealRow = await getDealById(db, req.params.id);
      if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

      const deal = reconstructDeal(dealRow);
      const results = runReverseStressTest(deal);
      return { dealId: req.params.id, breakPoints: results };
    },
  );

  // ── POST /deals/:id/sensitivity ── Sensitivity sweep
  app.post<{
    Params: { id: string };
    Body: { parameter: string; min: number; max: number; steps: number };
  }>(
    '/deals/:id/sensitivity',
    { preHandler: requireRole('analyst', 'lead-investor', 'admin') },
    async (req, reply) => {
      const dealRow = await getDealById(db, req.params.id);
      if (!dealRow) return reply.code(404).send({ error: 'Deal not found' });

      const deal = reconstructDeal(dealRow);
      const { parameter, min, max, steps } = req.body;
      const result = runSensitivitySweep(
        deal,
        parameter as any,
        { min, max, steps: steps ?? 20 },
      );
      return { dealId: req.params.id, sensitivity: result };
    },
  );

  // ── GET /deals/:id/verify-chain/:engine ── Verify hash chain integrity
  app.get<{ Params: { id: string; engine: string } }>(
    '/deals/:id/verify-chain/:engine',
    { preHandler: authGuard },
    async (req, reply) => {
      const { id, engine } = req.params;
      const history = await getEngineResultHistory(db, id, engine, undefined, 100);

      if (history.length === 0) {
        return { dealId: id, engine, chainLength: 0, valid: true };
      }

      const chain = history.reverse().map(r => ({
        contentHash: (r as any).contentHash ?? 'genesis',
        previousHash: (r as any).previousHash ?? 'genesis',
        engineName: r.engineName ?? engine,
        version: r.version,
        scenarioKey: (r as any).scenarioKey ?? 'base',
        input: r.input as Record<string, unknown>,
        output: r.output as Record<string, unknown>,
      }));

      const result = verifyHashChain(chain);
      return {
        dealId: id,
        engine,
        chainLength: chain.length,
        ...result,
      };
    },
  );

  // ── GET /compliance/controls ── SOC 2 control matrix
  app.get('/compliance/controls', { preHandler: requireRole('admin') }, async () => {
    return {
      controls: SOC2_CONTROLS,
      summary: generateControlMatrix(),
    };
  });

  // ── GET /compliance/controls/:id ── Single control detail
  app.get<{ Params: { id: string } }>(
    '/compliance/controls/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const control = SOC2_CONTROLS.find(c => c.id === req.params.id);
      if (!control) return reply.code(404).send({ error: 'Control not found' });
      return control;
    },
  );

  // ── GET /market/quality ── Data quality score
  app.get('/market/quality', { preHandler: authGuard }, async () => {
    // Import dynamically to avoid circular deps
    const { getMarketDataService } = await import('@v3grand/mcp');
    const { computeDataQualityScore } = await import('@v3grand/mcp/data-quality.js');

    try {
      const service = getMarketDataService();
      const macro = await service.getFactorMacro();
      const quality = computeDataQualityScore(macro.indicators ?? {});
      return { ok: true, quality };
    } catch {
      return { ok: false, quality: { overall: 0, grade: 'F', freshness: 0, reliability: 0, completeness: 0, consistency: 0, warnings: ['Failed to compute data quality'] } };
    }
  });
}

// Helper to reconstruct Deal from DB row (same as recompute.ts)
function reconstructDeal(dealRow: any): any {
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
    createdAt: dealRow.createdAt?.toISOString?.() ?? '',
    updatedAt: dealRow.updatedAt?.toISOString?.() ?? '',
  };
}
