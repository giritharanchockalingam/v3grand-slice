// ─── Deal Evaluation Page ───────────────────────────────────────────
// Full-screen split view: Input form (left) → Results dashboard (right)

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EvaluationInputForm } from '@/components/evaluation/EvaluationInputForm';
import { EvaluationResults } from '@/components/evaluation/EvaluationResults';
import type { DealEvaluationInput, DealEvaluationOutput } from '@v3grand/core';
import { useAuth } from '../../../../lib/auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function EvaluatePage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [evalInput, setEvalInput] = useState<DealEvaluationInput | null>(null);
  const [evalResult, setEvalResult] = useState<DealEvaluationOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInput, setIsLoadingInput] = useState(true);
  const [isGeneratingMemo, setIsGeneratingMemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = user?.role === 'co-investor' || user?.role === 'viewer';

  // Load deal data and build initial input
  useEffect(() => {
    if (!token) return;
    setIsLoadingInput(true);

    fetch(`${API_BASE}/deals/${dealId}/evaluation`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (r.ok) {
          const data = await r.json();
          setEvalInput(data.input as DealEvaluationInput);
          setEvalResult(data.output as DealEvaluationOutput);
        } else {
          // No prior evaluation — fetch deal to build fresh input
          const dealRes = await fetch(`${API_BASE}/deals/${dealId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!dealRes.ok) throw new Error('Failed to load deal');
          // Build input via the evaluate endpoint with a dry-run style call
          // For now, set a default input
          setEvalInput(null);
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setIsLoadingInput(false));
  }, [dealId, token]);

  // Run evaluation
  const handleSubmit = async (input: DealEvaluationInput) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          overrides: input,
          sensitivityConfig: {
            rowParam: 'occupancyStabilized',
            rowValues: [0.55, 0.60, 0.65, 0.70, 0.75, 0.80],
            colParam: 'adrStabilized',
            colValues: [5000, 5500, 6000, 6500, 7000, 7500],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Evaluation failed (${res.status})`);
      }

      const result = await res.json();
      setEvalResult(result);
      setEvalInput(input);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Download IC Memo
  const handleDownloadMemo = async () => {
    if (!token || !evalResult) return;
    setIsGeneratingMemo(true);

    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/ic-memo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evaluationOutput: evalResult }),
      });

      if (!res.ok) throw new Error('Failed to generate memo');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IC-Memo-${dealId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsGeneratingMemo(false);
    }
  };

  if (isLoadingInput) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-surface-400">Loading evaluation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-50">
      {/* Top Bar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-surface-100 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/deals/${dealId}`)} className="text-surface-400 hover:text-surface-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-surface-800">Deal Evaluation Engine</h1>
          {readOnly && <span className="px-2 py-0.5 rounded-full text-2xs bg-surface-100 text-surface-500">Read Only</span>}
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-lg">{error}</div>
        )}
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input Form */}
        <div className="w-[420px] border-r border-surface-100 bg-white flex flex-col overflow-hidden">
          {evalInput ? (
            <EvaluationInputForm
              initialInput={evalInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              readOnly={readOnly}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div>
                <p className="text-sm text-surface-500 mb-3">No evaluation input available yet.</p>
                <button
                  onClick={() => router.push(`/deals/${dealId}`)}
                  className="px-4 py-2 rounded-lg text-sm bg-brand-500 text-white hover:bg-brand-600"
                >
                  Go to Deal Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="flex-1 bg-white overflow-hidden">
          {evalResult ? (
            <EvaluationResults
              result={evalResult}
              onDownloadMemo={handleDownloadMemo}
              isGeneratingMemo={isGeneratingMemo}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-surface-700 mb-1">No Results Yet</h3>
                <p className="text-xs text-surface-400">Configure your inputs and click "Run Full Evaluation" to see results.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
