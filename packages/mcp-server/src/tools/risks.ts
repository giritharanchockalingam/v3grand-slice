// ─── MCP Tools: Risks, Audit, Readiness (enterprise) ─────────────────
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { z } from 'zod';
import {
  getRisksByDeal,
  createRisk,
  getRecentAudit,
  computeDealReadiness,
  getDealById,
  getLatestRecommendation,
} from '@v3grand/db';
import { toolResultSuccess, toolResultError, toHandlerContent, MCPErrorCode } from '../errors.js';

type Server = {
  registerTool(
    name: string,
    inputSchema: z.ZodType,
    handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ): void;
};

export function registerRiskTools(server: Server, db: PostgresJsDatabase): void {
  server.registerTool(
    'get_risks',
    z.object({ dealId: z.string().uuid().describe('Deal UUID') }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const risks = await getRisksByDeal(db, dealId);
        const list = risks.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          likelihood: r.likelihood,
          impact: r.impact,
          status: r.status,
          mitigation: r.mitigation,
          owner: r.owner,
          createdAt: r.createdAt?.toISOString?.() ?? '',
        }));
        const result = toolResultSuccess(`Found ${list.length} risk(s) for deal.`, { risks: list, total: list.length });
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'get_risks failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );

  server.registerTool(
    'create_risk',
    z.object({
      dealId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().min(1),
      category: z.enum(['market', 'construction', 'financial', 'regulatory', 'operational']),
      likelihood: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string().optional(),
      owner: z.string().optional(),
      createdBy: z.string().optional().describe('User ID; defaults to mcp-agent when invoked by agent'),
    }),
    async (args) => {
      const a = args as {
        dealId: string;
        title: string;
        description: string;
        category: string;
        likelihood: string;
        impact: string;
        mitigation?: string;
        owner?: string;
        createdBy?: string;
      };
      try {
        const deal = await getDealById(db, a.dealId);
        if (!deal) {
          const result = toolResultError(`Deal not found: ${a.dealId}`, MCPErrorCode.DEAL_NOT_FOUND);
          return { content: toHandlerContent(result) };
        }
        const risk = await createRisk(db, {
          dealId: a.dealId,
          title: a.title,
          description: a.description,
          category: a.category,
          likelihood: a.likelihood,
          impact: a.impact,
          mitigation: a.mitigation,
          owner: a.owner,
          createdBy: a.createdBy ?? 'mcp-agent',
        });
        const result = toolResultSuccess('Risk created.', {
          id: risk.id,
          dealId: risk.dealId,
          title: risk.title,
          category: risk.category,
          status: risk.status,
        });
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'create_risk failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );

  server.registerTool(
    'get_audit',
    z.object({
      dealId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional().describe('Max entries (default 20)'),
    }),
    async (args) => {
      const { dealId, limit } = args as { dealId: string; limit?: number };
      try {
        const entries = await getRecentAudit(db, dealId, limit ?? 20);
        const list = entries.map((e) => ({
          id: e.id,
          timestamp: e.timestamp?.toISOString?.() ?? '',
          module: e.module,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          userId: e.userId,
          role: e.role,
          diff: e.diff,
        }));
        const result = toolResultSuccess(`Found ${list.length} audit entry(ies).`, { entries: list, total: list.length });
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'get_audit failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );

  server.registerTool(
    'deal_readiness',
    z.object({ dealId: z.string().uuid() }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const readiness = await computeDealReadiness(db, dealId);
        const result = toolResultSuccess(readiness.message, readiness);
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'deal_readiness failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );

  server.registerTool(
    'generate_ic_memo_summary',
    z.object({ dealId: z.string().uuid().describe('Deal UUID') }),
    async (args) => {
      const { dealId } = args as { dealId: string };
      try {
        const deal = await getDealById(db, dealId);
        if (!deal) {
          const result = toolResultError(`Deal not found: ${dealId}`, MCPErrorCode.DEAL_NOT_FOUND);
          return { content: toHandlerContent(result) };
        }
        const rec = await getLatestRecommendation(db, dealId);
        const risks = await getRisksByDeal(db, dealId);
        const readiness = await computeDealReadiness(db, dealId);
        const summary = {
          dealName: deal.name,
          dealId: deal.id,
          status: deal.status,
          lifecyclePhase: deal.lifecyclePhase,
          recommendation: rec
            ? { verdict: rec.verdict, confidence: rec.confidence, explanation: rec.explanation }
            : null,
          riskCount: risks.length,
          readinessScore: readiness.score,
          readinessMessage: readiness.message,
          checks: readiness.checks,
        };
        const result = toolResultSuccess('IC memo summary generated (run stress/sensitivity separately for full memo).', summary);
        return { content: toHandlerContent(result) };
      } catch (e) {
        const result = toolResultError(e instanceof Error ? e.message : 'generate_ic_memo_summary failed', MCPErrorCode.DATABASE_ERROR);
        return { content: toHandlerContent(result) };
      }
    },
  );
}
