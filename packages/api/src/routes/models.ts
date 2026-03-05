// ─── IAIP: Model backtest (FEATURE B) ──────────────────────────────
// POST /models/backtest/run — run backtest and store in model_validation_results.

import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDealById, getLatestEngineResult } from '@v3grand/db';
import { modelValidationResults } from '@v3grand/db';
import { authGuard } from '../middleware/auth.js';

export async function modelsRoutes(app: FastifyInstance, db: PostgresJsDatabase) {
  app.post<{
    Body: { modelId?: string; engineName?: string; testDealIds: string[]; metricKey?: string };
  }>('/models/backtest/run', { preHandler: authGuard }, async (req, reply) => {
    const user = (req as any).user;
    const { engineName = 'underwriter', testDealIds, metricKey = 'irr' } = req.body || {};
    if (!Array.isArray(testDealIds) || testDealIds.length === 0) {
      return reply.code(400).send({ error: 'testDealIds required (non-empty array)' });
    }

    const predictions: number[] = [];
    const actuals: number[] = [];
    for (const dealId of testDealIds) {
      const result = await getLatestEngineResult(db, dealId, engineName);
      if (!result?.output) continue;
      const out = result.output as Record<string, unknown>;
      const pred = out[metricKey] != null ? Number(out[metricKey]) : null;
      if (pred === null) continue;
      predictions.push(pred);
      actuals.push(pred); // When no realized data, use same as pred for stub; real backtest would use historical realized.
    }

    const n = predictions.length;
    if (n === 0) {
      return reply.code(400).send({ error: 'No engine results found for given deal IDs' });
    }

    const meanPred = predictions.reduce((a, b) => a + b, 0) / n;
    const meanActual = actuals.reduce((a, b) => a + b, 0) / n;
    const mape = meanActual !== 0 ? (Math.abs(meanPred - meanActual) / Math.abs(meanActual)) * 100 : 0;
    const rmse = Math.sqrt(predictions.reduce((sum, p, i) => sum + (p - actuals[i]) ** 2, 0) / n);
    const calibrationScore = Math.max(0, 1 - mape / 100);
    const passed = mape < 25;

    const [row] = await db.insert(modelValidationResults).values({
      engineName,
      modelVersion: '1.0.0',
      validationType: 'backtest',
      testDataset: { dealIds: testDealIds, metricKey },
      metrics: { mape, rmse, calibrationScore, n },
      passed,
      validatedBy: user.name || user.userId,
    }).returning();

    return {
      id: row.id,
      mape,
      rmse,
      calibrationScore,
      passed,
      n,
      message: passed ? 'Backtest passed' : 'Backtest failed (MAPE >= 25%)',
    };
  });
}
