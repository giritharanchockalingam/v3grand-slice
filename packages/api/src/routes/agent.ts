/**
 * POST /agent/chat — V3 Grand Investment OS assistant (LLM + MCP tools).
 * GET /agent/workflows, POST /agent/workflows/:name/execute — plan/execute/verify workflows.
 * Requires auth; uses OPENAI_API_KEY for chat and in-process tool runner for both.
 */

import type { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import { createAgentToolRunner, type AgentToolRunner, type MarketDataService } from '@v3grand/mcp-server/agent-tools';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import { authGuard } from '../middleware/auth.js';
import { runAgentLoop } from '../agent/agent-loop.js';
import { getWorkflow, listWorkflows } from '../agent/workflow-registry.js';
import { executePlan } from '../agent/executor.js';
import type { WorkflowExecuteResponse } from '../agent/orchestrator-types.js';
import { insertAuditEntry, deals } from '@v3grand/db';

export async function agentRoutes(
  app: FastifyInstance,
  db: PostgresJsDatabase,
  marketService: MarketDataService,
): Promise<void> {
  let toolRunner: AgentToolRunner | null = null;
  let openai: OpenAI | null = null;

  toolRunner = createAgentToolRunner(db, marketService);
  if (config.openaiApiKey) {
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  app.post<{
    Body: { message: string; conversationId?: string };
  }>('/agent/chat', { preHandler: authGuard }, async (req, reply) => {
    if (!openai || !toolRunner) {
      return reply.code(503).send({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Agent not configured' },
        details: 'Set OPENAI_API_KEY in the environment to enable the assistant.',
      });
    }

    const body = req.body as { message?: string; conversationId?: string };
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return reply.code(400).send({
        error: { code: 'MISSING_FIELD', message: 'Missing or empty message' },
        details: 'Body must include a non-empty "message" string.',
      });
    }

    const user = (req as any).user;
    try {
      const result = await runAgentLoop(openai, toolRunner, message, {
        model: config.agentModel,
        maxToolRounds: config.agentMaxToolRounds,
        userId: user?.userId,
        role: user?.role,
      });
      return reply.send({
        reply: result.reply,
        tiles: result.tiles ?? undefined,
        toolCallsUsed: result.toolCallsUsed,
        rounds: result.rounds,
        conversationId: body.conversationId ?? null,
      });
    } catch (err) {
      app.log.error({ err }, 'Agent chat failed');
      return reply.code(500).send({
        error: { code: 'AGENT_REQUEST_FAILED', message: 'Agent request failed' },
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ---------- Workflows (plan → execute → verify) ----------
  app.get('/agent/workflows', { preHandler: authGuard }, async (_req, reply) => {
    return reply.send({ workflows: listWorkflows() });
  });

  /** Pre-flight validation: run a lightweight tool (list_deals) and a schema check to catch DB/schema issues before execute. */
  app.post<{
    Body: { workflowName?: string };
  }>('/agent/workflows/validate', { preHandler: authGuard }, async (req, reply) => {
    if (!toolRunner) {
      return reply.code(503).send({
        ok: false,
        error: 'Agent tools not configured. Tool runner is unavailable.',
      });
    }
    try {
      // 1) Touch deals table including capture_context so missing migrations surface here
      await db.select({ captureContext: deals.captureContext }).from(deals).limit(1);
      // 2) Run list_deals to verify tool runner and DB
      const result = await toolRunner.callTool('list_deals', { limit: 1 });
      const firstText = result.content?.find((c: { type: string; text?: string }) => c.type === 'text' && c.text)?.text ?? '';
      const isError =
        firstText.toLowerCase().includes('error') ||
        firstText.startsWith('[') ||
        (result as { isError?: boolean }).isError;
      if (isError) {
        return reply.send({ ok: false, error: firstText || 'list_deals returned an error' });
      }
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.warn({ err }, 'Workflow validation failed');
      return reply.send({
        ok: false,
        error: message,
        hint: message.includes('column') ? 'Run database migrations: pnpm db:migrate' : undefined,
      });
    }
  });

  app.post<{
    Params: { name: string };
    Body: Record<string, unknown>;
  }>('/agent/workflows/:name/execute', { preHandler: authGuard }, async (req, reply) => {
    if (!toolRunner) {
      return reply.code(503).send({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Agent tools not configured' },
        details: 'Tool runner is unavailable.',
      });
    }
    const workflowName = (req.params as { name: string }).name;
    const spec = getWorkflow(workflowName);
    if (!spec) {
      return reply.code(404).send({
        error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        details: { workflowName },
      });
    }
    const input = (req.body as Record<string, unknown>) || {};
    const missing = spec.inputRequired.filter((k) => input[k] == null || input[k] === '');
    if (missing.length) {
      return reply.code(400).send({
        error: { code: 'MISSING_REQUIRED_INPUT', message: 'Missing required input' },
        details: { missing },
      });
    }
    const startedAt = new Date();
    const planId = `plan-${Date.now()}-${workflowName}`;
    const plan = {
      ...spec.buildPlan(input),
      planId,
      createdAt: startedAt.toISOString(),
    };
    const report = await executePlan(plan, toolRunner);
    const completedAt = new Date(report.completedAt);
    const totalDurationMs = report.totalDurationMs;

    // Enterprise: audit workflow execution when a deal is in scope
    if (typeof input?.dealId === 'string') {
      const user = (req as any).user;
      await insertAuditEntry(db, {
        dealId: input.dealId as string,
        userId: user?.userId ?? 'system',
        role: user?.role ?? 'system',
        module: 'agent',
        action: 'workflow.executed',
        entityType: 'workflow',
        entityId: report.planId,
        diff: { workflowName, status: report.status, totalDurationMs, stepCount: report.stepResults.length },
      });
    }

    const response: WorkflowExecuteResponse = {
      status: report.status === 'verified' ? 'verified' : report.status === 'rolled_back' ? 'rolled_back' : 'failed',
      planId: report.planId,
      workflowName,
      message: report.summary,
      data: report.stepResults.length ? { stepCount: report.stepResults.length } : undefined,
      errors: report.errors.length ? report.errors : undefined,
      warnings: report.warnings?.length ? report.warnings : undefined,
      verification:
        report.verificationResults.length > 0
          ? {
              passed: report.verificationResults.filter((r) => r.passed).length,
              failed: report.verificationResults.filter((r) => !r.passed).length,
              checks: report.verificationResults.map((r) => ({
                description: r.check.description,
                passed: r.passed,
                message: r.message,
              })),
            }
          : undefined,
      timing: {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        totalDurationMs,
      },
      _debug: report,
    };
    return reply.send(response);
  });
}
