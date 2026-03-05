/**
 * Executes an ExecutionPlan (steps in order, then verification, then optional rollback on failure).
 * Uses in-process tool runner; no HTTP to MCP.
 * HMS Aurora–aligned: optional ToolContext (userId) for list_deals; rollback phase when status === 'failed'.
 */

import type { AgentToolRunner, ToolContentItem } from '@v3grand/mcp-server/agent-tools';
import type {
  ExecutionPlan,
  WorkflowStep,
  StepResult,
  VerificationCheck,
  VerificationResult,
  ExecutionReport,
  WorkflowStatus,
  OrchestrationError,
  AssertionRule,
  MCPContent,
} from './orchestrator-types.js';
import { resolveStepRefs, getValueFromToolContent } from './workflow-registry.js';

type ContentItem = { type: string; text?: string };

function toContentItem(c: ToolContentItem): ContentItem {
  return { type: c.type, text: c.type === 'text' ? c.text : undefined };
}

function toMCPContent(c: ToolContentItem): MCPContent {
  if (c.type === 'text') return { type: 'text', text: c.text };
  if (c.type === 'data') return { type: 'json', text: c.data !== undefined ? JSON.stringify(c.data) : undefined };
  return { type: 'text', text: undefined };
}

function topologicalSort(steps: ExecutionPlan['steps']): ExecutionPlan['steps'] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const result: ExecutionPlan['steps'] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const step = byId.get(id);
    if (!step) return;
    for (const dep of step.dependsOn) visit(dep);
    result.push(step);
  }

  for (const s of steps) visit(s.id);
  return result;
}

function evaluateAssertion(actual: unknown, rule: AssertionRule): boolean {
  const { operator, expected } = rule;
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'exists':
      return expected === true ? actual != null && actual !== '' : true;
    case 'not_exists':
      return expected === true ? (actual == null || actual === '') : true;
    default:
      return false;
  }
}

export async function executePlan(
  plan: ExecutionPlan,
  toolRunner: AgentToolRunner,
  context?: { userId?: string },
): Promise<ExecutionReport> {
  const startedAt = new Date();
  const stepResults: StepResult[] = [];
  const stepContent = new Map<string, ContentItem[]>();
  const errors: OrchestrationError[] = [];
  let status: WorkflowStatus = 'executing';
  const toolContext = context?.userId != null ? { userId: context.userId } : undefined;

  const sortedSteps = topologicalSort(plan.steps);

  for (const step of sortedSteps) {
    const stepStart = Date.now();
    try {
      const resolvedArgs = resolveStepRefs(
        step.args as Record<string, unknown>,
        stepContent,
      );
      // Fail step with clear message when a required ref is missing (e.g. no deals in list)
      const stepArgs = step.args as Record<string, unknown>;
      for (const [key, value] of Object.entries(resolvedArgs)) {
        if (value === undefined && typeof stepArgs[key] === 'string' && (stepArgs[key] as string).startsWith('$')) {
          const ref = stepArgs[key] as string;
          stepResults.push({
            stepId: step.id,
            status: 'failed',
            server: step.server,
            tool: step.tool,
            description: step.description,
            error: {
              code: 'MCP_SERVER_ERROR',
              message: `Missing required reference: ${key} (${ref}). For example, ensure there is at least one deal before running this workflow.`,
              server: step.server,
              tool: step.tool,
              timestamp: new Date().toISOString(),
            },
            durationMs: Date.now() - stepStart,
            timestamp: new Date().toISOString(),
            retryCount: 0,
          });
          status = 'failed';
          errors.push({
            code: 'MCP_SERVER_ERROR',
            message: `Step ${step.id}: missing required reference ${key} (${ref})`,
            server: step.server,
            tool: step.tool,
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
      if (status === 'failed') break;

      const raw = await toolRunner.callTool(step.tool, resolvedArgs, toolContext);
      const content = (raw.content || []).map(toContentItem);
      stepContent.set(step.id, content);

      // Treat as failed only if the tool's message (first text item) indicates error, not arbitrary "error" in JSON payload
      const firstText = raw.content?.find((c): c is { type: 'text'; text: string } => c.type === 'text' && 'text' in c && !!c.text)?.text ?? '';
      const success =
        !firstText.toLowerCase().includes('error') &&
        !firstText.startsWith('[') && // MCP error codes e.g. [DEAL_NOT_FOUND]
        !(raw as { isError?: boolean }).isError;
      const stepStatus = success ? 'success' : 'failed';

      stepResults.push({
        stepId: step.id,
        status: stepStatus,
        server: step.server,
        tool: step.tool,
        description: step.description,
        result: {
          success: stepStatus === 'success',
          content: raw.content?.map(toMCPContent) ?? [],
        },
        durationMs: Date.now() - stepStart,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      if (stepStatus === 'failed') {
        status = 'failed';
        const toolMessage = firstText.trim().slice(0, 500);
        errors.push({
          code: 'MCP_SERVER_ERROR',
          message: toolMessage
            ? `Step ${step.id}: ${toolMessage}`
            : `Step ${step.id} returned error content`,
          server: step.server,
          tool: step.tool,
          ...(toolMessage && { details: { toolMessage: firstText.trim() } }),
          timestamp: new Date().toISOString(),
        });
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stepResults.push({
        stepId: step.id,
        status: 'failed',
        server: step.server,
        tool: step.tool,
        description: step.description,
        error: {
          code: 'MCP_SERVER_ERROR',
          message: msg,
          server: step.server,
          tool: step.tool,
          timestamp: new Date().toISOString(),
        },
        durationMs: Date.now() - stepStart,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      status = 'failed';
      errors.push({
        code: 'MCP_SERVER_ERROR',
        message: msg,
        server: step.server,
        tool: step.tool,
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }

  const verificationResults: VerificationResult[] = [];
  const warnings: OrchestrationError[] = [];
  if (status === 'executing') {
    status = 'verifying';
    for (const check of plan.verificationChecks) {
      try {
        const resolvedArgs = resolveStepRefs(
          check.args as Record<string, unknown>,
          stepContent,
        );
        const raw = await toolRunner.callTool(check.tool, resolvedArgs, toolContext);
        const content = (raw.content || []).map(toContentItem);
        const actualValue = getValueFromToolContent(content, check.assertion.field);
        const passed = evaluateAssertion(actualValue, check.assertion);
        verificationResults.push({
          check,
          passed,
          actualValue,
          expectedValue: check.assertion.expected,
          message: passed
            ? `${check.description}: passed`
            : `${check.description}: expected ${check.assertion.operator} ${JSON.stringify(check.assertion.expected)}, got ${JSON.stringify(actualValue)}`,
        });
        if (!passed) {
          const detail = actualValue !== undefined
            ? ` (expected ${JSON.stringify(check.assertion.expected)}, got ${JSON.stringify(actualValue)})`
            : '';
          const entry: OrchestrationError = {
            code: 'VERIFICATION_FAILED',
            message: check.description + detail,
            server: check.server,
            tool: check.tool,
            timestamp: new Date().toISOString(),
          };
          if (check.advisory) {
            warnings.push(entry);
          } else {
            status = 'failed';
            errors.push(entry);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        verificationResults.push({
          check,
          passed: false,
          actualValue: undefined,
          expectedValue: check.assertion.expected,
          message: msg,
        });
        const entry: OrchestrationError = {
          code: 'VERIFICATION_FAILED',
          message: msg,
          server: check.server,
          tool: check.tool,
          timestamp: new Date().toISOString(),
        };
        if (check.advisory) {
          warnings.push(entry);
        } else {
          status = 'failed';
          errors.push(entry);
        }
      }
    }
    if (status === 'verifying') status = 'verified';
  }

  // HMS Aurora–aligned: optional rollback when failed and steps define rollbackTool
  if (status === 'failed') {
    let rollbackRan = false;
    for (let i = sortedSteps.length - 1; i >= 0; i--) {
      const step = sortedSteps[i] as WorkflowStep;
      if (!step.rollbackTool || !step.rollbackArgs) continue;
      rollbackRan = true;
      try {
        const resolvedRollbackArgs = resolveStepRefs(
          step.rollbackArgs as Record<string, unknown>,
          stepContent,
        );
        await toolRunner.callTool(step.rollbackTool, resolvedRollbackArgs, toolContext);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          code: 'ROLLBACK_FAILED',
          message: `Rollback for step ${step.id}: ${msg}`,
          server: step.server,
          tool: step.rollbackTool,
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (rollbackRan) status = 'rolled_back';
  }

  const completedAt = new Date();
  const totalDurationMs = completedAt.getTime() - startedAt.getTime();
  const summary =
    status === 'verified'
      ? warnings.length > 0
        ? `Completed with ${warnings.length} warning(s): ${stepResults.length} steps, ${verificationResults.filter((r) => r.passed).length}/${verificationResults.length} checks passed.`
        : `Completed: ${stepResults.length} steps, ${verificationResults.length} checks passed.`
      : status === 'rolled_back'
        ? `Failed then rolled back: ${errors.map((e) => e.message).join('; ')}`
        : status === 'failed'
          ? `Failed: ${errors.map((e) => e.message).join('; ')}`
          : 'Execution incomplete.';

  return {
    planId: plan.planId,
    status,
    stepResults,
    verificationResults,
    summary,
    totalDurationMs,
    completedAt: completedAt.toISOString(),
    errors,
    ...(warnings.length > 0 && { warnings }),
  };
}
