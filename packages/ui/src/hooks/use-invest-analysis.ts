'use client';

import { useState, useCallback } from 'react';

/** Wizard input shape matching the API */
export interface InvestWizardInput {
  propertyName: string;
  city: string;
  state: string;
  starRating: number;
  roomCount: number;
  landAreaAcres: number;
  investmentAmountCr: number;
  dealType: 'new_build' | 'renovation' | 'acquisition';
  partnershipType: 'solo' | 'partnership';
  returnLevel: 'conservative' | 'moderate' | 'aggressive';
  riskComfort: 'low' | 'medium' | 'high';
  timelineYears: number;
}

/** Single agent result */
export interface AgentResult {
  agentId: string;
  agentName: string;
  agentIcon: string;
  reply: string;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: string;
    durationMs?: number;
  }>;
  durationMs: number;
  error?: string;
}

/** Complete analysis response */
export interface InvestAnalysisResponse {
  dealId: string;
  dealName: string;
  verdict: 'YES' | 'NO' | 'MAYBE';
  confidence: number;
  summary: string;
  keyMetrics: {
    expectedReturn: string;
    riskLevel: string;
    marketOutlook: string;
    timelineConfidence: string;
  };
  agentResults: AgentResult[];
  warnings: string[];
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export function useInvestAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<InvestAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const analyze = useCallback(async (input: InvestWizardInput) => {
    setStatus('analyzing');
    setError(null);
    setResult(null);
    setElapsedSeconds(0);

    // Start elapsed time counter
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const response = await fetch('/api/invest/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      clearInterval(timer);
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error || err.details || `HTTP ${response.status}`);
      }

      const data: InvestAnalysisResponse = await response.json();
      setResult(data);
      setStatus('complete');
      return data;
    } catch (err) {
      clearInterval(timer);
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setElapsedSeconds(0);
  }, []);

  return { status, result, error, elapsedSeconds, analyze, reset };
}
