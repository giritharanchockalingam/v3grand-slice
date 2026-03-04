// ─── Market Intelligence Routes ───────────────────────────────────
// GET  /market/macro              — Current macro indicators (for Factor engine)
// GET  /market/city/:city         — City market profile
// GET  /market/demand/:city       — Demand signals (tourism + airport + GDP)
// GET  /market/construction-costs — CPWD cost trends
// GET  /market/health             — MCP source health check
// POST /market/refresh            — Force-refresh all cached data

import type { FastifyInstance } from 'fastify';
import type { MarketDataService } from '@v3grand/mcp';

export async function marketRoutes(
  app: FastifyInstance,
  marketService: MarketDataService,
): Promise<void> {

  // ── Macro Indicators ──
  app.get('/market/macro', async (_req, reply) => {
    try {
      const data = await marketService.getMacroIndicators();
      return reply.send({
        ok: true,
        data,
        cacheStats: marketService.getCacheStats(),
      });
    } catch (err) {
      app.log.error({ err }, 'market.macro.failed');
      return reply.status(500).send({ ok: false, error: 'Failed to fetch macro indicators' });
    }
  });

  // ── City Market Profile ──
  app.get<{ Params: { city: string } }>('/market/city/:city', async (req, reply) => {
    const { city } = req.params;
    if (!city || city.length < 2) {
      return reply.status(400).send({ ok: false, error: 'City name required (min 2 chars)' });
    }

    try {
      const data = await marketService.getCityProfile(city);
      return reply.send({ ok: true, data });
    } catch (err) {
      app.log.error({ err, city }, 'market.city.failed');
      return reply.status(500).send({ ok: false, error: `Failed to fetch city profile for ${city}` });
    }
  });

  // ── Demand Signals ──
  app.get<{ Params: { city: string } }>('/market/demand/:city', async (req, reply) => {
    const { city } = req.params;
    if (!city || city.length < 2) {
      return reply.status(400).send({ ok: false, error: 'City name required' });
    }

    try {
      const data = await marketService.getDemandSignals(city);
      return reply.send({ ok: true, data });
    } catch (err) {
      app.log.error({ err, city }, 'market.demand.failed');
      return reply.status(500).send({ ok: false, error: `Failed to compute demand signals for ${city}` });
    }
  });

  // ── Construction Cost Trend ──
  app.get('/market/construction-costs', async (_req, reply) => {
    try {
      const data = await marketService.getConstructionCostTrend();
      return reply.send({ ok: true, data });
    } catch (err) {
      app.log.error({ err }, 'market.construction.failed');
      return reply.status(500).send({ ok: false, error: 'Failed to fetch construction cost data' });
    }
  });

  // ── Health Check ──
  app.get('/market/health', async (_req, reply) => {
    try {
      const health = await marketService.healthCheck();
      const cacheStats = marketService.getCacheStats();
      return reply.send({
        ok: true,
        sources: health,
        cache: cacheStats,
      });
    } catch (err) {
      app.log.error({ err }, 'market.health.failed');
      return reply.status(500).send({ ok: false, error: 'Health check failed' });
    }
  });

  // ── Force Refresh ──
  app.post('/market/refresh', async (_req, reply) => {
    try {
      await marketService.refresh();
      const health = await marketService.healthCheck();
      return reply.send({
        ok: true,
        message: 'Cache cleared and macro data refreshed',
        sources: health,
      });
    } catch (err) {
      app.log.error({ err }, 'market.refresh.failed');
      return reply.status(500).send({ ok: false, error: 'Refresh failed' });
    }
  });
}
