'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

export interface BudgetLine {
  id: string; costCode: string; description: string; category: string;
  originalAmount: number; approvedCOs: number; currentBudget: number;
  actualSpend: number; commitments: number;
}

export interface ChangeOrder {
  id: string; budgetLineId: string; coNumber: string; title: string;
  description: string; amount: number; status: string;
  requestedBy: string; approvedBy: string | null; createdAt: string;
}

export interface RFI {
  id: string; rfiNumber: string; subject: string; question: string;
  answer: string | null; status: string; raisedBy: string;
  answeredBy: string | null; createdAt: string;
}

export interface Milestone {
  id: string; name: string; description: string; targetDate: string;
  actualDate: string | null; status: string; percentComplete: number;
}

export interface ConstructionDashboard {
  budgetLines: BudgetLine[];
  changeOrders: ChangeOrder[];
  rfis: RFI[];
  milestones: Milestone[];
  summary: {
    totalBudget: number; totalApprovedCOs: number; totalActualSpend: number;
    totalCommitments: number; budgetVariance: number; completionPct: number;
  };
}

export function useConstruction(dealId: string) {
  return useQuery<ConstructionDashboard>({
    queryKey: ['deals', dealId, 'construction'],
    queryFn: () => api.get(`/deals/${dealId}/construction/dashboard`),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useApproveChangeOrder(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coId: string) =>
      api.patch(`/deals/${dealId}/construction/change-orders/${coId}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useCreateChangeOrder(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { budgetLineId: string; title: string; description: string; amount: number }) =>
      api.post(`/deals/${dealId}/construction/change-orders`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

export function useCreateRFI(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; question: string }) =>
      api.post(`/deals/${dealId}/construction/rfis`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}
