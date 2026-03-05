'use client';

/**
 * Workflow progress (HMS-style): phase, steps, verification checks, errors.
 * Uses Tailwind only; no external UI library.
 */

import type {
  WorkflowPhase,
  WorkflowStepProgress,
  WorkflowVerificationCheck,
} from '@/hooks/use-workflow';
import { PHASE_LABELS, getPhaseColor } from '@/hooks/use-workflow';
import {
  StepSuccessIcon,
  StepFailedIcon,
  StepSkippedIcon,
  StepPendingIcon,
  StepRunningIcon,
} from '@/components/icons/PortalIcons';

export interface WorkflowProgressProps {
  phase: WorkflowPhase;
  progress: number;
  steps?: WorkflowStepProgress[];
  verification?: {
    passed: number;
    failed: number;
    checks: WorkflowVerificationCheck[];
  };
  /** Advisory check failures (workflow verified with warnings). */
  warnings?: Array<{ code: string; message: string }>;
  error?: { code: string; message: string };
  className?: string;
  showSteps?: boolean;
  showVerification?: boolean;
}

function PhaseIcon({ phase }: { phase: WorkflowPhase }) {
  const base = 'w-5 h-5 ' + getPhaseColor(phase);
  if (phase === 'completed') {
    return (
      <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (phase === 'failed') {
    return (
      <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (['executing', 'planning', 'verifying', 'rolling_back', 'validating'].includes(phase)) {
    return (
      <svg className={base + ' animate-spin'} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StepStatusBadge({ status }: { status: WorkflowStepProgress['status'] }) {
  const styles: Record<WorkflowStepProgress['status'], string> = {
    pending: 'bg-surface-600 text-surface-300',
    running: 'bg-brand-500/20 text-brand-400',
    success: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    skipped: 'bg-surface-600 text-surface-500',
  };
  const labels: Record<WorkflowStepProgress['status'], string> = {
    pending: 'Pending',
    running: 'Running',
    success: 'Done',
    failed: 'Failed',
    skipped: 'Skipped',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function WorkflowProgress({
  phase,
  progress,
  steps = [],
  verification,
  warnings,
  error,
  className = '',
  showSteps = true,
  showVerification = true,
}: WorkflowProgressProps) {
  const isActive = ['validating', 'planning', 'executing', 'verifying', 'rolling_back'].includes(phase);
  const isComplete = phase === 'completed';
  const isFailed = phase === 'failed';

  return (
    <div className={'space-y-4 ' + className}>
      <div className="flex items-center gap-3">
        <PhaseIcon phase={phase} />
        <div className="flex-1 min-w-0">
          <p className={'font-medium ' + getPhaseColor(phase)}>{PHASE_LABELS[phase]}</p>
          {isActive && (
            <div className="mt-1 h-2 w-full rounded-full bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          )}
        </div>
        {progress > 0 && isActive && (
          <span className="text-sm text-surface-400 tabular-nums">{progress}%</span>
        )}
      </div>

      {showSteps && steps.length > 0 && (
        <div className="space-y-2 pl-8">
          <p className="text-sm font-medium text-surface-400">Steps</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <div
                key={step.stepId}
                className="flex items-start gap-3 rounded-xl border border-surface-700 bg-surface-800/60 p-3 shadow-sm"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'success' && <StepSuccessIcon />}
                  {step.status === 'failed' && <StepFailedIcon />}
                  {step.status === 'skipped' && <StepSkippedIcon />}
                  {step.status === 'pending' && <StepPendingIcon />}
                  {step.status === 'running' && <StepRunningIcon />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-200">
                    {step.description ?? step.tool}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {step.durationMs != null && (
                      <span className="text-xs text-surface-500">{step.durationMs}ms</span>
                    )}
                    <StepStatusBadge status={step.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showVerification && verification && (isComplete || (isFailed && verification.checks.length > 0)) && (
        <div className="space-y-2 pl-8">
          <p className="text-sm font-medium text-surface-400">
            Verification: {verification.passed}/{verification.passed + verification.failed} passed
          </p>
          <div className="space-y-1">
            {verification.checks.map((check, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg ${
                  check.passed ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                {check.passed ? (
                  <span className="text-green-400" aria-hidden>✓</span>
                ) : (
                  <span className="text-red-400" aria-hidden>✗</span>
                )}
                <span>{check.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isComplete && warnings && warnings.length > 0 && (
        <div className="space-y-2 pl-8">
          <p className="text-sm font-medium text-amber-500">Warnings ({warnings.length})</p>
          <div className="space-y-1">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg bg-amber-500/10 text-amber-200 border border-amber-500/30"
              >
                <span className="text-amber-400" aria-hidden>⚠</span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && isFailed && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3">
          <p className="font-medium text-red-400">Error: {error.code}</p>
          <p className="text-sm text-red-300/90 mt-0.5">{error.message}</p>
        </div>
      )}

      {isComplete && !error && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="font-medium text-green-400">
            {warnings && warnings.length > 0 ? 'Completed with warnings' : 'Operation completed'}
          </p>
          <p className="text-sm text-green-300/90 mt-0.5">
            {warnings && warnings.length > 0
              ? `${warnings.length} advisory check(s) failed; all required checks passed.`
              : 'All steps have been verified.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default WorkflowProgress;
