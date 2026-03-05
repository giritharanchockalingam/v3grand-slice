// ─── MCP Tools: Engines (run_factor, run_montecarlo, run_budget, run_scurve) ─
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Deal, MacroIndicators } from '@v3grand/core';
import {
  scoreFactors,
  runMonteCarlo,
  analyzeBudget,
  distributeSCurve,
} from '@v3grand/engines';
import {
  getDealById,
  insertEngineResult,
  insertAuditEntry,
  getBudgetLinesByDeal,
  getChangeOrdersByDeal,
  getRFIsByDeal,
  getMilestonesByDeal,
} from '@v3grand/db';
import { z } from 'zod';
import { toolResultSuccess, toolResultError, toHandlerContent, MCPErrorCode } from '../errors.js';

const TRIGGERED_BY = 'mcp-agent';
const AUDIT_USER = 'mcp-agent';
const AUDIT_ROLE = 'system';

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ): void;
};

function reconstituteDeal(row: Record<string, unknown>): Deal {
  return {
    id: row.id as string,
    name: row.name as string,
    assetClass: row.assetClass as Deal['assetClass'],
    status: row.status as Deal['status'],
    lifecyclePhase: row.lifecyclePhase as Deal['lifecyclePhase'],
    currentMonth: (row.currentMonth as number) ?? 0,
    version: (row.version as number) ?? 1,
    property: row.property as Deal['property'],
    partnership: row.partnership as Deal['partnership'],
    marketAssumptions: row.marketAssumptions as Deal['marketAssumptions'],
    financialAssumptions: row.financialAssumptions as Deal['financialAssumptions'],
    capexPlan: row.capexPlan as Deal['capexPlan'],
    opexModel: row.opexModel as Deal['opexModel'],
    scenarios: row.scenarios as Deal['scenarios'],
    createdAt: (row.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: (row.updatedAt as Date)?.toISOString?.() ?? new Date().toISOString(),
  };
}

export function registerEngineTools(server: Server, db: PostgresJsDatabase): void {
  server.registerTool(
    'run_factor',
    z.object({
      dealId: z.string().uuid(),
      macroIndicators: z.record(z.unknown()).optional(),
    }),
    async (args) => {
      const { dealId, macroIndicators } = args as { dealId: string; macroIndicators?: MacroIndicators };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstituteDeal(dealRow as Record<string, unknown>);
        const t0 = Date.now();
        const result = scoreFactors({ deal, macroIndicators: macroIndicators ?? undefined });
        const duration = Date.now() - t0;

        await insertEngineResult(db, {
          dealId,
          engineName: 'factor',
          input: { macroIndicators: macroIndicators ?? null },
          output: result as unknown as Record<string, unknown>,
          durationMs: duration,
          triggeredBy: TRIGGERED_BY,
        });
        await insertAuditEntry(db, {
          dealId,
          userId: AUDIT_USER,
          role: AUDIT_ROLE,
          module: 'factor',
          action: 'engine.completed',
          entityType: 'engine_result',
          entityId: dealId,
          diff: { compositeScore: result.compositeScore, impliedDiscountRate: result.impliedDiscountRate },
        });

        return { content: toHandlerContent(toolResultSuccess(`Factor engine completed in ${duration}ms.`, result)) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_factor failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_montecarlo',
    z.object({
      dealId: z.string().uuid(),
      iterations: z.number().int().min(100).max(50000).optional(),
      seed: z.number().int().optional(),
    }),
    async (args) => {
      const { dealId, iterations = 5000, seed } = args as { dealId: string; iterations?: number; seed?: number };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstituteDeal(dealRow as Record<string, unknown>);
        const t0 = Date.now();
        const result = runMonteCarlo({ deal, iterations, seed });
        const duration = Date.now() - t0;

        await insertEngineResult(db, {
          dealId,
          engineName: 'montecarlo',
          input: { iterations, seed: seed ?? null },
          output: result as unknown as Record<string, unknown>,
          durationMs: duration,
          triggeredBy: TRIGGERED_BY,
        });
        await insertAuditEntry(db, {
          dealId,
          userId: AUDIT_USER,
          role: AUDIT_ROLE,
          module: 'montecarlo',
          action: 'engine.completed',
          entityType: 'engine_result',
          entityId: dealId,
          diff: {
            iterations,
            irrP50: result.irrDistribution.p50,
            npvP50: result.npvDistribution.p50,
            probNpvNegative: result.probNpvNegative,
          },
        });

        return { content: toHandlerContent(toolResultSuccess(`Monte Carlo completed in ${duration}ms (${iterations} iterations).`, result)) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_montecarlo failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_budget',
    z.object({ dealId: z.string().uuid() }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstituteDeal(dealRow as Record<string, unknown>);

        const [budgetLinesData, coData, rfiData, msData] = await Promise.all([
          getBudgetLinesByDeal(db, dealId),
          getChangeOrdersByDeal(db, dealId),
          getRFIsByDeal(db, dealId),
          getMilestonesByDeal(db, dealId),
        ]);

        const mappedBudgetLines = budgetLinesData.map((l) => ({
          id: l.id,
          dealId: l.dealId,
          costCode: l.costCode,
          description: l.description,
          category: l.category,
          originalAmount: parseFloat(l.originalAmount as string),
          approvedCOs: parseFloat(l.approvedCOs as string),
          currentBudget: parseFloat(l.currentBudget as string),
          actualSpend: parseFloat(l.actualSpend as string),
          commitments: parseFloat(l.commitments as string),
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        }));
        const mappedCOs = coData.map((c) => ({
          id: c.id,
          dealId: c.dealId,
          budgetLineId: c.budgetLineId,
          coNumber: c.coNumber,
          title: c.title,
          description: c.description,
          amount: parseFloat(c.amount as string),
          status: c.status as 'draft' | 'submitted' | 'approved' | 'rejected',
          requestedBy: c.requestedBy,
          approvedBy: c.approvedBy ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));
        const mappedRFIs = rfiData.map((r) => ({
          id: r.id,
          dealId: r.dealId,
          rfiNumber: r.rfiNumber,
          subject: r.subject,
          question: r.question,
          answer: r.answer ?? null,
          status: r.status as 'open' | 'answered' | 'closed',
          raisedBy: r.raisedBy,
          answeredBy: r.answeredBy ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
        const mappedMilestones = msData.map((m) => ({
          id: m.id,
          dealId: m.dealId,
          name: m.name,
          description: m.description,
          targetDate: m.targetDate,
          actualDate: m.actualDate ?? null,
          status: m.status as 'not-started' | 'in-progress' | 'completed' | 'delayed',
          percentComplete: m.percentComplete,
          dependencies: (m.dependencies as string[]) ?? [],
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }));

        const t0 = Date.now();
        const result = analyzeBudget({
          deal,
          budgetLines: mappedBudgetLines,
          changeOrders: mappedCOs,
          rfis: mappedRFIs,
          milestones: mappedMilestones,
          asOfMonth: deal.currentMonth,
        });
        const duration = Date.now() - t0;

        await insertEngineResult(db, {
          dealId,
          engineName: 'budget',
          input: { asOfMonth: deal.currentMonth },
          output: result as unknown as Record<string, unknown>,
          durationMs: duration,
          triggeredBy: TRIGGERED_BY,
        });
        await insertAuditEntry(db, {
          dealId,
          userId: AUDIT_USER,
          role: AUDIT_ROLE,
          module: 'budget',
          action: 'engine.completed',
          entityType: 'engine_result',
          entityId: dealId,
          diff: { overallStatus: result.overallStatus, varianceToCurrent: result.varianceToCurrent },
        });

        return { content: toHandlerContent(toolResultSuccess(`Budget analysis completed in ${duration}ms.`, result)) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_budget failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );

  server.registerTool(
    'run_scurve',
    z.object({
      dealId: z.string().uuid(),
      totalMonths: z.number().int().min(1).max(120).optional(),
    }),
    async (args) => {
      const { dealId, totalMonths = 24 } = args as { dealId: string; totalMonths?: number };
      try {
        const dealRow = await getDealById(db, dealId);
        if (!dealRow) {
          return { content: toHandlerContent(toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND)) };
        }
        const deal = reconstituteDeal(dealRow as Record<string, unknown>);

        const items = (deal.capexPlan?.phase1?.items ?? []).map((item: { id: string; costCode: string; budgetAmount: number }) => ({
          id: item.id,
          costCode: item.costCode,
          amount: item.budgetAmount,
          startMonth: 0,
          endMonth: totalMonths,
          curveType: 's-curve' as const,
        }));

        const t0 = Date.now();
        const result = distributeSCurve({ items, totalMonths });
        const duration = Date.now() - t0;

        await insertEngineResult(db, {
          dealId,
          engineName: 'scurve',
          input: { itemCount: items.length, totalMonths },
          output: result as unknown as Record<string, unknown>,
          durationMs: duration,
          triggeredBy: TRIGGERED_BY,
        });
        await insertAuditEntry(db, {
          dealId,
          userId: AUDIT_USER,
          role: AUDIT_ROLE,
          module: 'scurve',
          action: 'engine.completed',
          entityType: 'engine_result',
          entityId: dealId,
          diff: { totalAmount: result.totalAmount, months: totalMonths },
        });

        return { content: toHandlerContent(toolResultSuccess(`S-Curve completed in ${duration}ms.`, result)) };
      } catch (e) {
        return { content: toHandlerContent(toolResultError(e instanceof Error ? e.message : 'run_scurve failed', MCPErrorCode.ENGINE_ERROR)) };
      }
    },
  );
}
