// ─── MCP Tools: Deals (list, get, dashboard) ─────────────────────────
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { ProFormaOutput } from '@v3grand/core';
import {
  getDealById,
  listDeals,
  listDealsByUser,
  getLatestEngineResultByScenario,
  getLatestRecommendation,
  getLatestEngineResult,
  getRecentAudit,
  getConstructionSummary,
  recommendations,
} from '@v3grand/db';
import { toolResultSuccess, toolResultError, toHandlerContent, MCPErrorCode } from '../errors.js';

type ToolContext = { userId?: string; role?: string };
type ToolContentItem = { type: 'text'; text: string } | { type: 'data'; data?: unknown };

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (
      args: unknown,
      context?: ToolContext,
    ) => Promise<{ content: ToolContentItem[]; isError?: boolean }>,
  ): void;
};

function buildListDealsTiles(
  deals: Array<{ id?: string; name?: string }>,
  total: number,
): Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }> {
  const tiles: Array<{ type: 'section' | 'list'; title?: string; body?: string; items?: string[] }> = [];
  const summary = deals.length === 0 ? 'No deals found.' : `Found ${total} deal(s).`;
  tiles.push({ type: 'section', title: 'Your deals', body: summary });
  if (deals.length > 0) {
    tiles.push({
      type: 'list',
      title: 'Deals',
      items: deals.map((d) => `${d.name ?? 'Unnamed'} (${d.id ?? '—'})`),
    });
  }
  return tiles;
}

export function registerDealTools(server: Server, db: PostgresJsDatabase): void {
  server.registerTool(
    'list_deals',
    z.object({
      limit: z.number().int().min(1).max(100).optional().describe('Max number of deals to return (default 20)'),
    }),
    async (args, context) => {
      const limit = (args as { limit?: number }).limit ?? 20;
      try {
        const rows = context?.userId
          ? await listDealsByUser(db, context.userId)
          : await listDeals(db);
        const deals = rows.slice(0, limit).map((d) => ({
          id: d.id,
          name: d.name,
          assetClass: d.assetClass,
          status: d.status,
          lifecyclePhase: d.lifecyclePhase,
          updatedAt: d.updatedAt?.toISOString?.() ?? '',
        }));
        const total = rows.length;
        const tiles = buildListDealsTiles(deals, total);
        const text = `Found ${deals.length} deal(s).`;
        const jsonText = JSON.stringify({ deals, total });
        return {
          content: [
            { type: 'text', text },
            { type: 'text', text: jsonText },
            { type: 'data', data: { deals, total, tiles } },
          ],
        };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'list_deals failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result), isError: true };
      }
    },
  );

  server.registerTool(
    'get_deal',
    z.object({ dealId: z.string().uuid().describe('Deal UUID') }),
    async (args, _context) => {
      const { dealId } = args as { dealId: string };
      try {
        const deal = await getDealById(db, dealId);
        if (!deal) {
          const result = toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND);
          return { content: toHandlerContent(result) };
        }
        const payload = {
          id: deal.id,
          name: deal.name,
          assetClass: deal.assetClass,
          status: deal.status,
          lifecyclePhase: deal.lifecyclePhase,
          currentMonth: deal.currentMonth,
          version: deal.version,
          property: deal.property,
          partnership: deal.partnership,
          marketAssumptions: deal.marketAssumptions,
          financialAssumptions: deal.financialAssumptions,
          capexPlan: deal.capexPlan,
          opexModel: deal.opexModel,
          scenarios: deal.scenarios,
          activeScenarioKey: deal.activeScenarioKey,
          createdAt: deal.createdAt?.toISOString?.() ?? '',
          updatedAt: deal.updatedAt?.toISOString?.() ?? '',
        };
        const result = toolResultSuccess('Deal loaded.', payload);
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'get_deal failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );

  server.registerTool(
    'get_deal_dashboard',
    z.object({ dealId: z.string().uuid().describe('Deal UUID') }),
    async (args, _context) => {
      const { dealId } = args as { dealId: string };
      try {
        const view = await buildDashboardView(db, dealId);
        if (!view) {
          const result = toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND);
          return { content: toHandlerContent(result) };
        }
        const result = toolResultSuccess('Deal dashboard loaded.', view);
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'get_deal_dashboard failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );
}

/** Build dashboard view for a deal (mirrors API GET /deals/:id/dashboard). */
async function buildDashboardView(db: PostgresJsDatabase, dealId: string): Promise<Record<string, unknown> | null> {
  const dealRow = await getDealById(db, dealId);
  if (!dealRow) return null;

  const [
    latestUW,
    latestRec,
    latestMCResult,
    latestFactorResult,
    latestBudgetResult,
    latestSCurveResult,
    latestDecisionResult,
    audit,
    constructionSummary,
  ] = await Promise.all([
    getLatestEngineResultByScenario(db, dealId, 'underwriter', 'base'),
    getLatestRecommendation(db, dealId),
    getLatestEngineResult(db, dealId, 'montecarlo'),
    getLatestEngineResult(db, dealId, 'factor'),
    getLatestEngineResult(db, dealId, 'budget'),
    getLatestEngineResult(db, dealId, 'scurve'),
    getLatestEngineResult(db, dealId, 'decision'),
    getRecentAudit(db, dealId, 50),
    getConstructionSummary(db, dealId),
  ]);

  const recHistory = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.dealId, dealId))
    .orderBy(desc(recommendations.version))
    .limit(20);

  const latestProforma = latestUW
    ? (() => {
        const output = latestUW.output as unknown as ProFormaOutput;
        return {
          scenarioKey: output.scenarioKey,
          years: output.years,
          irr: output.irr,
          npv: output.npv,
          equityMultiple: output.equityMultiple,
          avgDSCR: output.avgDSCR,
          paybackYear: output.paybackYear,
          exitValue: output.exitValue,
          totalInvestment: output.totalInvestment,
          equityInvestment: output.equityInvestment,
        };
      })()
    : null;

  const latestRecommendation = latestRec
    ? {
        id: latestRec.id,
        dealId: latestRec.dealId,
        version: latestRec.version,
        timestamp: latestRec.createdAt.toISOString(),
        verdict: latestRec.verdict,
        confidence: latestRec.confidence,
        triggerEvent: latestRec.triggerEvent,
        proformaSnapshot: latestRec.proformaSnapshot,
        gateResults: latestRec.gateResults,
        explanation: latestRec.explanation,
        previousVerdict: latestRec.previousVerdict,
        isFlip: latestRec.isFlip === 'true',
      }
    : null;

  const latestMC = latestMCResult ? (latestMCResult.output as Record<string, unknown>) : null;
  const latestFactor = latestFactorResult ? (latestFactorResult.output as Record<string, unknown>) : null;
  const latestBudget = latestBudgetResult ? (latestBudgetResult.output as Record<string, unknown>) : null;
  const latestSCurve = latestSCurveResult ? (latestSCurveResult.output as Record<string, unknown>) : null;

  const constructionProgress = constructionSummary
    ? {
        totalBudget: constructionSummary.totalBudget,
        actualSpend: constructionSummary.totalActualSpend,
        commitments: constructionSummary.totalCommitments,
        approvedCOs: constructionSummary.totalApprovedCOs,
        variance: constructionSummary.budgetVariance,
        completionPct: constructionSummary.completionPct,
      }
    : null;

  const recentEvents = audit.map((a) => {
    let severity: 'info' | 'warning' | 'critical' = 'info';
    if (a.action.includes('failed') || a.action.includes('crash')) severity = 'critical';
    else if (a.action.includes('flip') || a.action.includes('overrun') || a.action.includes('delayed')) severity = 'warning';
    return {
      id: a.id,
      type: a.action,
      timestamp: a.timestamp.toISOString(),
      description: `${a.module}: ${a.action}`,
      module: a.module,
      severity,
      userId: a.userId,
      diff: a.diff,
    };
  });

  const decisionInsight = latestDecisionResult
    ? (() => {
        const d = latestDecisionResult.output as Record<string, unknown>;
        return {
          narrative: d.narrative ?? '',
          topDrivers: d.topDrivers ?? [],
          topRisks: d.topRisks ?? [],
          flipConditions: d.flipConditions ?? [],
          riskFlags: d.riskFlags ?? [],
        };
      })()
    : null;

  return {
    deal: {
      id: dealRow.id,
      name: dealRow.name,
      assetClass: dealRow.assetClass,
      status: dealRow.status,
      lifecyclePhase: dealRow.lifecyclePhase,
      currentMonth: dealRow.currentMonth,
      version: dealRow.version,
    },
    property: dealRow.property,
    partnership: dealRow.partnership,
    marketAssumptions: dealRow.marketAssumptions,
    financialAssumptions: dealRow.financialAssumptions,
    capexPlan: dealRow.capexPlan,
    latestRecommendation,
    latestProforma,
    latestMC,
    latestFactor,
    latestBudget,
    latestSCurve,
    budgetSummary: latestBudget
      ? {
          overallStatus: (latestBudget as any).overallStatus,
          varianceToCurrent: (latestBudget as any).varianceToCurrent,
          alerts: (latestBudget as any).alerts ?? [],
        }
      : null,
    constructionProgress,
    decisionInsight,
    recentEvents,
    recommendationHistory: recHistory.map((r) => ({
      version: r.version,
      verdict: r.verdict,
      confidence: r.confidence,
      timestamp: r.createdAt.toISOString(),
      scenarioKey: r.scenarioKey,
      explanation: r.explanation,
      previousVerdict: r.previousVerdict,
      isFlip: r.isFlip === 'true',
      gateResults: r.gateResults,
    })),
  };
}
