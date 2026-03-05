/**
 * Orchestrator types aligned with HMS Aurora (plan → execute → verify).
 * V3 Grand uses a single logical server 'v3grand'.
 */

export type V3GrandServerName = 'v3grand';

export type WorkflowType =
  | 'deal_dashboard_stress'
  | 'deal_summary_validation'
  | 'market_and_deal_health'
  | 'deal_ic_readiness'
  | 'deal_market_alignment'
  | 'deal_full_recompute_verify'
  | 'deal_stress_to_risks'
  | 'market_snapshot_for_deal';

export type WorkflowStatus =
  | 'planned'
  | 'executing'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'rolled_back';

export interface WorkflowStep {
  id: string;
  description: string;
  server: V3GrandServerName;
  tool: string;
  args: Record<string, unknown>;
  dependsOn: string[];
  isReadOnly: boolean;
  isVerification: boolean;
  rollbackTool?: string;
  rollbackArgs?: Record<string, unknown>;
  maxRetries: number;
}

export interface ExecutionPlan {
  planId: string;
  workflowType: WorkflowType;
  createdAt: string;
  steps: WorkflowStep[];
  expectedOutcome: string;
  verificationChecks: VerificationCheck[];
  context: Record<string, unknown>;
}

export interface MCPContent {
  type: 'text' | 'json';
  text?: string;
  data?: unknown;
}

export interface MCPToolResult {
  success: boolean;
  content: MCPContent[];
  isError?: boolean;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  server: V3GrandServerName;
  tool: string;
  /** Human-readable step label from the plan (for UI). */
  description?: string;
  result?: MCPToolResult;
  error?: OrchestrationError;
  durationMs: number;
  timestamp: string;
  retryCount: number;
}

export interface VerificationCheck {
  description: string;
  server: V3GrandServerName;
  tool: string;
  args: Record<string, unknown>;
  assertion: AssertionRule;
  /** When true, failure is recorded as a warning; workflow can still be verified. */
  advisory?: boolean;
}

export type AssertionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'exists'
  | 'not_exists';

export interface AssertionRule {
  field: string;
  operator: AssertionOperator;
  expected: unknown;
}

export interface VerificationResult {
  check: VerificationCheck;
  passed: boolean;
  actualValue: unknown;
  expectedValue: unknown;
  message: string;
}

export type OrchestrationErrorCode =
  | 'VALIDATION_ERROR'
  | 'DEAL_NOT_FOUND'
  | 'MCP_SERVER_ERROR'
  | 'MCP_SERVER_TIMEOUT'
  | 'VERIFICATION_FAILED'
  | 'ROLLBACK_FAILED'
  | 'INTERNAL_ERROR';

export interface OrchestrationError {
  code: OrchestrationErrorCode;
  message: string;
  server?: V3GrandServerName;
  tool?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ExecutionReport {
  planId: string;
  status: WorkflowStatus;
  stepResults: StepResult[];
  verificationResults: VerificationResult[];
  summary: string;
  totalDurationMs: number;
  completedAt: string;
  errors: OrchestrationError[];
  /** Failures from advisory checks (workflow still verified). */
  warnings?: OrchestrationError[];
}

/** Response shape for workflow execute (HMS-style, for UI). */
export interface WorkflowExecuteResponse {
  status: 'verified' | 'failed' | 'rolled_back';
  planId: string;
  workflowName: string;
  message: string;
  data?: Record<string, unknown>;
  errors?: OrchestrationError[];
  /** Advisory check failures (workflow verified with warnings). */
  warnings?: OrchestrationError[];
  verification?: {
    passed: number;
    failed: number;
    checks: Array<{ description: string; passed: boolean; message: string }>;
  };
  timing: {
    startedAt: string;
    completedAt: string;
    totalDurationMs: number;
  };
  _debug?: ExecutionReport;
}
