// ─── Dashboard Hook ─────────────────────────────────────────────────
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DealDashboardView } from '@v3grand/core';
import { api } from '../lib/api-client';

export function useDashboard(dealId: string) {
  return useQuery<DealDashboardView>({
    queryKey: ['deals', dealId, 'dashboard'],
    queryFn: () => api.get(`/deals/${dealId}/dashboard`),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useRunUnderwriter(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/deals/${dealId}/underwrite`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useUpdateAssumptions(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { marketAssumptions?: object; financialAssumptions?: object }) =>
      api.patch(`/deals/${dealId}/assumptions`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}
