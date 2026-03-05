/**
 * Workflow execution hook for V3 Grand Agent API (HMS-style).
 * Calls GET /agent/workflows and POST /agent/workflows/:name/execute.
 */

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';

export type WorkflowPhase =
  | 'idle'
  | 'validating'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'rolling_back'
  | 'completed'
  | 'failed';

export interface WorkflowError {
  code: string;
  message: string;
  server?: string;
  tool?: string;
  details?: Record<string, unknown>;
}

export interface WorkflowStepProgress {
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  tool: string;
  /** Human-readable step label (from plan description). */
  description?: string;
  durationMs?: number;
}

export interface WorkflowVerificationCheck {
  description: string;
  passed: boolean;
  message: string;
}

export interface WorkflowResult<T = Record<string, unknown>> {
  status: 'verified' | 'failed' | 'rolled_back';
  planId: string;
  workflowName: string;
  message: string;
  data?: T;
  errors?: WorkflowError[];
  /** Advisory check failures (workflow verified with warnings). */
  warnings?: WorkflowError[];
  verification?: {
    passed: number;
    failed: number;
    checks: WorkflowVerificationCheck[];
  };
  timing: {
    startedAt: string;
    completedAt: string;
    totalDurationMs: number;
  };
  _debug?: {
    stepResults?: Array<{
      stepId: string;
      status: string;
      tool: string;
      description?: string;
      durationMs?: number;
    }>;
  };
}

export interface WorkflowState<TInput, TResult> {
  phase: WorkflowPhase;
  progress: number;
  currentStep?: string;
  steps: WorkflowStepProgress[];
  input?: TInput;
  result?: WorkflowResult<TResult>;
  error?: WorkflowError;
  startedAt?: Date;
  completedAt?: Date;
}

export interface UseWorkflowOptions<TResult = Record<string, unknown>> {
  onSuccess?: (result: WorkflowResult<TResult>) => void;
  onError?: (error: WorkflowError) => void;
  onPhaseChange?: (phase: WorkflowPhase) => void;
}

export interface UseWorkflowReturn<TInput, TResult> {
  state: WorkflowState<TInput, TResult>;
  execute: (input: TInput) => Promise<WorkflowResult<TResult> | null>;
  reset: () => void;
  isExecuting: boolean;
  isSuccess: boolean;
  isFailed: boolean;
}

export function useWorkflow<TInput extends Record<string, unknown>, TResult = Record<string, unknown>>(
  workflowName: string,
  options: UseWorkflowOptions<TResult> = {},
): UseWorkflowReturn<TInput, TResult> {
  const { onSuccess, onError, onPhaseChange } = options;

  const [state, setState] = useState<WorkflowState<TInput, TResult>>({
    phase: 'idle',
    progress: 0,
    steps: [],
  });

  const setPhase = useCallback(
    (phase: WorkflowPhase, progress?: number) => {
      setState((prev) => ({
        ...prev,
        phase,
        progress: progress ?? prev.progress,
      }));
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  const execute = useCallback(
    async (input: TInput): Promise<WorkflowResult<TResult> | null> => {
      const startTime = new Date();
      setState({
        phase: 'validating',
        progress: 10,
        steps: [],
        input,
        startedAt: startTime,
      });
      setPhase('validating', 10);
      setPhase('planning', 20);
      setPhase('executing', 30);

      try {
        const result = (await api.post(`/agent/workflows/${workflowName}/execute`, input)) as WorkflowResult<TResult>;

        const steps: WorkflowStepProgress[] =
          result._debug?.stepResults?.map((sr) => ({
            stepId: sr.stepId,
            status:
              sr.status === 'success'
                ? 'success'
                : sr.status === 'skipped'
                  ? 'skipped'
                  : 'failed',
            tool: sr.tool,
            description: sr.description,
            durationMs: sr.durationMs,
          })) ?? [];

        if (result.status === 'verified') {
          setPhase('verifying', 90);
          setState((prev) => ({
            ...prev,
            phase: 'completed',
            progress: 100,
            steps,
            result,
            completedAt: new Date(),
          }));
          onSuccess?.(result);
          return result;
        }

        const error: WorkflowError = result.errors?.[0] ?? {
          code: 'WORKFLOW_FAILED',
          message: result.message,
        };
        setState((prev) => ({
          ...prev,
          phase: 'failed',
          progress: 0,
          steps,
          result,
          error,
          completedAt: new Date(),
        }));
        onError?.(error);
        return result;
      } catch (err) {
        const workflowError: WorkflowError = {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error',
        };
        setState((prev) => ({
          ...prev,
          phase: 'failed',
          progress: 0,
          error: workflowError,
          completedAt: new Date(),
        }));
        onError?.(workflowError);
        return null;
      }
    },
    [workflowName, setPhase, onSuccess, onError],
  );

  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      progress: 0,
      steps: [],
    });
  }, []);

  return {
    state,
    execute,
    reset,
    isExecuting: ['validating', 'planning', 'executing', 'verifying', 'rolling_back'].includes(state.phase),
    isSuccess: state.phase === 'completed',
    isFailed: state.phase === 'failed',
  };
}

export const PHASE_LABELS: Record<WorkflowPhase, string> = {
  idle: 'Ready',
  validating: 'Validating input...',
  planning: 'Creating execution plan...',
  executing: 'Executing steps...',
  verifying: 'Verifying changes...',
  rolling_back: 'Rolling back changes...',
  completed: 'Completed',
  failed: 'Failed',
};

export function getPhaseColor(phase: WorkflowPhase): string {
  switch (phase) {
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    case 'rolling_back':
      return 'text-orange-600';
    default:
      return 'text-blue-600';
  }
}
