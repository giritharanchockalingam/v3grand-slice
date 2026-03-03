// ─── Risk Register Hook ─────────────────────────────────────────────
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';

export interface Risk {
  id: string;
  dealId: string;
  title: string;
  description: string;
  category: string;
  likelihood: string;
  impact: string;
  status: string;
  mitigation: string | null;
  owner: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskSummary {
  total: number;
  open: number;
  highPriority: number;
  categories: string[];
}

interface RiskResponse {
  risks: Risk[];
  summary: RiskSummary;
}

export function useRisks(dealId: string) {
  return useQuery<RiskResponse>({
    queryKey: ['deals', dealId, 'risks'],
    queryFn: () => api.get(`/deals/${dealId}/risks`),
    staleTime: 30_000,
  });
}

export function useCreateRisk(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      category: string;
      likelihood: string;
      impact: string;
      mitigation?: string;
      owner?: string;
    }) => api.post(`/deals/${dealId}/risks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'risks'] });
    },
  });
}

export function useUpdateRisk(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ riskId, ...updates }: { riskId: string; status?: string; mitigation?: string }) =>
      api.patch(`/deals/${dealId}/risks/${riskId}`, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'risks'] });
    },
  });
}
