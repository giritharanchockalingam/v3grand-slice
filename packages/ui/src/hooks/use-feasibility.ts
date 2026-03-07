'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

export interface AssumptionRow {
  id: string;
  assumptionKey: string;
  value: unknown;
  unit: string | null;
  owner: string;
  rationale: string | null;
  source: string | null;
  confidence: string | null;
  status: string;
  approvedBy: string | null;
}

export function useDealAssumptions(dealId: string) {
  const { token, loading } = useAuth();
  return useQuery({
    queryKey: ['deals', dealId, 'assumptions'],
    queryFn: () => api.get<{ assumptions: AssumptionRow[] }>(`/deals/${dealId}/assumptions`),
    enabled: !!dealId && !loading && !!token,
  });
}

export function useUpsertAssumption(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; value: string | number; unit?: string; rationale?: string; source?: string; confidence?: number }) =>
      api.patch<AssumptionRow>(`/deals/${dealId}/assumptions/${encodeURIComponent(payload.key)}`, {
        value: payload.value,
        unit: payload.unit,
        rationale: payload.rationale,
        source: payload.source,
        confidence: payload.confidence,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'assumptions'] });
    },
  });
}

export function useApproveAssumption(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, status }: { key: string; status?: string }) =>
      api.post<AssumptionRow>(`/deals/${dealId}/assumptions/${encodeURIComponent(key)}/approve`, { status: status || 'approved' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'assumptions'] });
    },
  });
}

export function useGenerateICMemo(dealId: string) {
  return useMutation({
    mutationFn: (opts?: { scenarioKey?: string; includeAuditTrail?: boolean }) =>
      api.post<{ reportId: string; memo: unknown; generatedAt: string }>('/reports/ic-memo/generate', {
        dealId,
        scenarioKey: opts?.scenarioKey ?? 'base',
        includeAuditTrail: opts?.includeAuditTrail ?? true,
      }),
  });
}

export function useSetActiveScenario(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioKey: string) =>
      api.patch<{ message: string; activeScenarioKey: string }>(`/deals/${dealId}/active-scenario`, { scenarioKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'scenarios'] });
    },
  });
}

export function useRunMonteCarlo(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<unknown>(`/deals/${dealId}/engines/montecarlo`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useRecompute(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok?: boolean; error?: string }>(`/deals/${dealId}/underwrite`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'scenarios'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'board-criteria'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'capital-structure-scenarios'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'phase2-gate'] });
    },
  });
}

// ── Excel validation: board criteria, capital structure, scenarios (expected return), phase2 gate ──

export function useBoardCriteria(dealId: string) {
  const { token, loading } = useAuth();
  return useQuery({
    queryKey: ['deals', dealId, 'board-criteria'],
    queryFn: () => api.get<{ dealId: string; boardCriteria: Array<{ name: string; threshold: number; actual: number; passed: boolean }> }>(`/deals/${dealId}/board-criteria`),
    enabled: !!dealId && !loading && !!token,
  });
}

export function useCapitalStructureScenarios(dealId: string) {
  const { token, loading } = useAuth();
  return useQuery({
    queryKey: ['deals', dealId, 'capital-structure-scenarios'],
    queryFn: () => api.get<{
      dealId: string;
      scenarios: Array<{ debtPct: number; equityPct: number; irr: number; npv: number; avgDSCR: number; riskLevel: string; recommendation: string }>;
    }>(`/deals/${dealId}/capital-structure-scenarios`),
    enabled: !!dealId && !loading && !!token,
  });
}

export function useScenarios(dealId: string) {
  const { token, loading } = useAuth();
  return useQuery({
    queryKey: ['deals', dealId, 'scenarios'],
    queryFn: () => api.get<{
      dealId: string;
      activeScenario: string;
      probabilityWeights: { bear: number; base: number; bull: number };
      expectedIRR: number;
      expectedNPV: number;
      scenarios: Record<string, { scenarioKey: string; proforma: { irr: number; npv: number } | null; recommendation: unknown }>;
    }>(`/deals/${dealId}/scenarios`),
    enabled: !!dealId && !loading && !!token,
  });
}

export function usePhase2Gate(dealId: string) {
  const { token, loading } = useAuth();
  return useQuery({
    queryKey: ['deals', dealId, 'phase2-gate'],
    queryFn: () => api.get<{
      dealId: string;
      phase2Gate: {
        criteria: Array<{ name: string; threshold: number; current?: number; passed: boolean; notes: string }>;
        passedCount: number;
        totalCount: number;
        verdict: string;
      };
    }>(`/deals/${dealId}/phase2-gate`),
    enabled: !!dealId && !loading && !!token,
  });
}
