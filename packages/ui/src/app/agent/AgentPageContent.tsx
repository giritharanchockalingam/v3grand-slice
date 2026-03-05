'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useWorkflow } from '@/hooks/use-workflow';
import { WorkflowProgress } from '@/components/agent/WorkflowProgress';
import { AgentChatPanel, type ChatMessageItem } from '@/components/agent/AgentChatPanel';
import { AGENT_NAME } from '@/lib/agent-constants';

interface WorkflowMeta {
  name: string;
  type: string;
  description: string;
  inputRequired: string[];
}

type WorkflowInput = Record<string, unknown>;

type WorkflowInputRecord = Record<string, string>;

type WorkflowsResponse = { workflows: WorkflowMeta[] };

type AgentChatResponse = { reply: string; toolCallsUsed?: number };

export function AgentPageContent() {
  const [selectedWorkflow, setSelectedWorkflow] = React.useState('deal_dashboard_stress');
  const [workflowInput, setWorkflowInput] = React.useState<WorkflowInputRecord>({});
  const [chatMessages, setChatMessages] = React.useState<ChatMessageItem[]>([]);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const { data: workflowsData, isLoading: workflowsLoading, isError: workflowsError } = useQuery<WorkflowsResponse>({
    queryKey: ['agent', 'workflows'],
    queryFn: () => api.get('/agent/workflows'),
    enabled: true,
    retry: false,
  });

  const workflows = workflowsData?.workflows ?? [];
  const currentSpec = workflows.find((w) => w.name === selectedWorkflow);
  const needsDealId = currentSpec?.inputRequired?.includes('dealId') ?? false;

  const {
    state: workflowState,
    execute: executeWorkflow,
    reset: resetWorkflow,
    isExecuting,
  } = useWorkflow<WorkflowInput>(selectedWorkflow);

  const handleRunWorkflow = async () => {
    setValidationError(null);
    const input: Record<string, unknown> = {};
    if (needsDealId && workflowInput.dealId) input.dealId = workflowInput.dealId.trim();

    type ValidateRes = { ok: boolean; error?: string; hint?: string };
    try {
      const validateRes = await api.post<ValidateRes>('/agent/workflows/validate', { workflowName: selectedWorkflow });
      if (!validateRes.ok) {
        const msg = [validateRes.error, validateRes.hint].filter(Boolean).join('\n');
        setValidationError(msg ?? 'Validation failed');
        return;
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation request failed');
      return;
    }

    await executeWorkflow(input);
  };

  const handleSendChat = React.useCallback(async (message: string) => {
    setChatMessages((prev) => [...prev, { role: 'user', text: message }]);
    setChatLoading(true);
    try {
      const res = await api.post<AgentChatResponse>('/agent/chat', { message });
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.reply ?? '', toolCalls: res.toolCallsUsed },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error: ' + (err instanceof Error ? err.message : String(err)),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const handleClearChat = React.useCallback(() => {
    setChatMessages([]);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="elevated-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-teal-300" />
        <div className="p-6">
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Agentic AI</h1>
          <p className="text-sm text-surface-500 mt-1">
            Run workflows (plan → execute → verify) and chat with {AGENT_NAME}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="elevated-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Workflows</h2>
            <p className="section-title text-surface-500 mt-0.5">Run pipelines (plan → execute → verify)</p>
          </div>
          {workflowsError && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3">
              <p className="font-medium text-amber-800">Cannot reach the API</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Start the server: <code className="bg-amber-100 px-1 rounded">pnpm --filter @v3grand/api run dev</code> (port 3001). Then refresh.
              </p>
            </div>
          )}
          {workflowsLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-surface-200" />
              <div className="h-10 w-full rounded-lg bg-surface-100" />
              <div className="h-9 w-28 rounded-lg bg-surface-200" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Workflow</label>
                <select
                  value={selectedWorkflow}
                  onChange={(e) => {
                    setSelectedWorkflow(e.target.value);
                    setWorkflowInput({});
                    setValidationError(null);
                    resetWorkflow();
                  }}
                  className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  title={currentSpec?.description}
                >
                  {workflows.map((w) => (
                    <option key={w.name} value={w.name} title={w.description}>
                      {w.description}
                    </option>
                  ))}
                </select>
                {currentSpec && (
                  <p className="text-xs text-surface-500 mt-1">{currentSpec.description}</p>
                )}
              </div>
              {needsDealId && (
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Deal ID</label>
                  <input
                    type="text"
                    value={workflowInput.dealId ?? ''}
                    onChange={(e) =>
                      setWorkflowInput((prev) => ({ ...prev, dealId: e.target.value }))
                    }
                    placeholder="e.g. deal-uuid"
                    className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRunWorkflow}
                  disabled={isExecuting || (needsDealId && !workflowInput.dealId?.trim())}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? 'Running...' : 'Execute'}
                </button>
                {(workflowState.phase === 'completed' || workflowState.phase === 'failed') && (
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError(null);
                      resetWorkflow();
                    }}
                    className="rounded-lg border border-surface-300 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
                  >
                    Reset
                  </button>
                )}
              </div>
              {validationError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3">
                  <p className="font-medium text-red-600">Pre-flight check failed</p>
                  <p className="text-sm text-red-700 mt-0.5 whitespace-pre-wrap">{validationError}</p>
                </div>
              )}
              {(workflowState.phase !== 'idle' || workflowState.steps.length > 0) && (
                <WorkflowProgress
                  phase={workflowState.phase}
                  progress={workflowState.progress}
                  steps={workflowState.steps}
                  verification={workflowState.result?.verification}
                  warnings={workflowState.result?.warnings}
                  error={workflowState.error}
                  showSteps
                  showVerification
                />
              )}
            </>
          )}
        </div>

        <div className="elevated-card p-6 flex flex-col min-h-[420px]">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">{AGENT_NAME}</h2>
          <AgentChatPanel
            messages={chatMessages}
            loading={chatLoading}
            onSend={handleSendChat}
            onClear={handleClearChat}
            showClearButton
            assistantName={AGENT_NAME}
            suggestedPrompts={[
              'What is WACC?',
              'List my deals',
              'How is EBITDA calculated?',
              'Run dashboard & stress test for the first deal',
            ]}
            placeholder="Ask about deals, stress tests, validation..."
          />
        </div>
      </div>
    </div>
  );
}
