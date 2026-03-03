'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

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
  };
  decision: {
    verdict: string;
    confidence: number;
    gateResults: Array<{ name: string; passed: boolean; actual: number; threshold: number }>;
    explanation: string;
  };
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

export function useScenarios(dealId: string) {
  return useQuery<ScenariosResponse>({
    queryKey: ['deals', dealId, 'scenarios'],
    queryFn: () => api.get(`/deals/${dealId}/scenarios`),
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
