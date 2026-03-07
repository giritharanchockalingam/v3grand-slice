// ─── Dashboard Hook with SSE Real-Time Updates ─────────────────────
'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DealDashboardView } from '@v3grand/core';
import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

export function useDashboard(dealId: string) {
  const qc = useQueryClient();
  const { token, loading } = useAuth();

  const query = useQuery<DealDashboardView>({
    queryKey: ['deals', dealId, 'dashboard'],
    queryFn: () => api.get(`/deals/${dealId}/dashboard`),
    // Wait until AuthProvider has finished restoring the token from
    // sessionStorage; otherwise api-client sends no Authorization header
    // and the server returns 401.
    enabled: !loading && !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // SSE subscription for real-time dashboard updates
  useEffect(() => {
    if (!dealId || !token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    // EventSource doesn't support custom headers, so pass token as query param
    const url = `${apiBase}/deals/${dealId}/events?token=${encodeURIComponent(token)}`;

    let es: EventSource | null = null;
    try {
      es = new EventSource(url);

      es.addEventListener('recompute.complete', () => {
        qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
        qc.invalidateQueries({ queryKey: ['deals', dealId, 'scenarios'] });
      });

      es.addEventListener('recommendation.flipped', () => {
        qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      });

      es.onerror = () => {
        // EventSource auto-reconnects; close on persistent failures
        if (es?.readyState === EventSource.CLOSED) {
          es?.close();
        }
      };
    } catch {
      // SSE not available — dashboard still works via polling/manual refresh
    }

    return () => {
      es?.close();
    };
  }, [dealId, token, qc]);

  return query;
}

export function useRunUnderwriter(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; error?: string }>(`/deals/${dealId}/underwrite`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'scenarios'] });
    },
  });
}

export function useUpdateAssumptions(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { marketAssumptions?: object; financialAssumptions?: object }) =>
      api.patch<{ message: string; error?: string }>(`/deals/${dealId}/assumptions`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'scenarios'] });
    },
  });
}
