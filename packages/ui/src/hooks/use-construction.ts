'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

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
  const { token, loading } = useAuth();
  return useQuery<ConstructionDashboard>({
    queryKey: ['deals', dealId, 'construction'],
    queryFn: () => api.get(`/deals/${dealId}/construction/dashboard`),
    enabled: !loading && !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ── Create hooks ──
export function useCreateBudgetLine(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { costCode: string; description: string; category: string; originalAmount: number; currentBudget: number }) =>
      api.post(`/deals/${dealId}/construction`, { type: 'budget_line', ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useCreateChangeOrder(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { budgetLineId: string; coNumber: string; title: string; description: string; amount: number }) =>
      api.post(`/deals/${dealId}/construction`, { type: 'change_order', ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useCreateRFI(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { rfiNumber: string; subject: string; question: string }) =>
      api.post(`/deals/${dealId}/construction`, { type: 'rfi', ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

export function useCreateMilestone(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description: string; targetDate: string }) =>
      api.post(`/deals/${dealId}/construction`, { type: 'milestone', ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

// ── Update hooks ──
export function useUpdateBudgetLine(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; [key: string]: unknown }) =>
      api.patch(`/deals/${dealId}/construction`, { type: 'budget_line', id, ...updates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useApproveChangeOrder(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coId: string) =>
      api.patch(`/deals/${dealId}/construction`, { type: 'change_order', id: coId, status: 'approved' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useAnswerRFI(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      api.patch(`/deals/${dealId}/construction`, { type: 'rfi', id, answer }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

export function useUpdateMilestone(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; [key: string]: unknown }) =>
      api.patch(`/deals/${dealId}/construction`, { type: 'milestone', id, ...updates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

// ── Delete hooks ──
export function useDeleteBudgetLine(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deals/${dealId}/construction?type=budget_line&id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
    },
  });
}

export function useDeleteChangeOrder(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deals/${dealId}/construction?type=change_order&id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

export function useDeleteRFI(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deals/${dealId}/construction?type=rfi&id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}

export function useDeleteMilestone(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deals/${dealId}/construction?type=milestone&id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'construction'] });
    },
  });
}
