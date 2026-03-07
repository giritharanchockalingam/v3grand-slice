/**
 * ─── useAlerts Hook ──────────────────────────────────────────────────
 * React Query hook to fetch and manage alerts.
 * GET /deals/:id/alerts
 * Mutation to acknowledge alerts via PATCH /alerts/:id/acknowledge
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

export interface Alert {
  id: string;
  dealId: string;
  level: 'CRITICAL' | 'WARN' | 'INFO';
  message: string;
  createdAt: string;
  acknowledgedAt?: string | null;
}

/**
 * Fetch alerts for a specific deal
 */
async function fetchAlerts(dealId: string): Promise<Alert[]> {
  try {
    const response = await apiClient.get(`/deals/${dealId}/alerts`);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    throw error;
  }
}

/**
 * Acknowledge an alert
 */
async function acknowledgeAlert(alertId: string): Promise<Alert> {
  try {
    const response = await apiClient.patch(`/alerts/${alertId}/acknowledge`);
    return response.data;
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    throw error;
  }
}

/**
 * useAlerts hook
 */
export function useAlerts(dealId: string) {
  const queryClient = useQueryClient();
  const { token, loading } = useAuth();

  // Query: fetch alerts
  const alertsQuery = useQuery({
    queryKey: ['alerts', dealId],
    queryFn: () => fetchAlerts(dealId),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    enabled: !!dealId && !loading && !!token,
  });

  // Mutation: acknowledge alert
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (acknowledgedAlert) => {
      // Update the cache with the acknowledged alert
      queryClient.setQueryData(
        ['alerts', dealId],
        (oldData: Alert[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((alert) =>
            alert.id === acknowledgedAlert.id ? acknowledgedAlert : alert
          );
        }
      );
    },
    onError: (error) => {
      console.error('Error acknowledging alert:', error);
    },
  });

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    error: alertsQuery.error,
    acknowledge: (alertId: string) => acknowledgeMutation.mutateAsync(alertId),
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
