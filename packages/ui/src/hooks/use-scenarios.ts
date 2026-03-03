'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';

export interface ScenarioResult {
  scenarioKey: string;
  proforma: {
    irr: number;
    npv: number;
    equityMultiple: number;
    avgDSCR: number;
    paybackYear: number;
    exitValue: number;
    totalInvestment: number;
    equityInvestment: number;
    years: Array<{
      year: number; occupancy: number; adr: number; revpar: number;
      totalRevenue: number; gop: number; gopMargin: number;
      ebitda: number; ebitdaMargin: number; debtService: number; fcfe: number;
    }>;
  } | null;
  decision: {
    verdict: string;
    confidence: number;
    gateResults: Array<{ name: string; passed: boolean; actual: number; threshold: number }>;
    explanation: string;
  } | null;
}

export interface ScenariosResponse {
  dealId: string;
  activeScenario: string;
  scenarios: {
    bear: ScenarioResult | null;
    base: ScenarioResult | null;
    bull: ScenarioResult | null;
  };
}

// Transform the API response into the expected shape
function transformResponse(raw: any): ScenariosResponse {
  const transform = (s: any): ScenarioResult | null => {
    if (!s) return null;
    return {
      scenarioKey: s.scenarioKey ?? '',
      proforma: s.proforma ?? null,
      decision: s.recommendation ? {
        verdict: s.recommendation.verdict,
        confidence: s.recommendation.confidence,
        gateResults: s.recommendation.gateResults ?? [],
        explanation: s.recommendation.explanation,
      } : null,
    };
  };

  return {
    dealId: raw.dealId,
    activeScenario: raw.activeScenario ?? 'base',
    scenarios: {
      bear: transform(raw.scenarios?.bear ?? raw.bear),
      base: transform(raw.scenarios?.base ?? raw.base),
      bull: transform(raw.scenarios?.bull ?? raw.bull),
    },
  };
}

export function useScenarios(dealId: string) {
  return useQuery<ScenariosResponse>({
    queryKey: ['deals', dealId, 'scenarios'],
    queryFn: async () => {
      const raw = await api.get(`/deals/${dealId}/scenarios`);
      return transformResponse(raw);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePromoteScenario(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioKey: string) =>
      api.patch(`/deals/${dealId}/active-scenario`, { scenarioKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId] });
    },
  });
}
