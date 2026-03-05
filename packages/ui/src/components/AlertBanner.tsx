/**
 * ─── AlertBanner Component ────────────────────────────────────────────
 * Shows unacknowledged alerts as a dismissible banner at top of dashboard.
 * CRITICAL alerts in red, WARN in amber, INFO in blue.
 * "Dismiss" button calls PATCH /alerts/:id/acknowledge
 */

import React, { useEffect, useState } from 'react';
import { useAlerts } from '../hooks/use-alerts';

export interface Alert {
  id: string;
  dealId: string;
  level: 'CRITICAL' | 'WARN' | 'INFO';
  message: string;
  createdAt: string;
  acknowledgedAt?: string | null;
}

interface AlertBannerProps {
  dealId: string;
}

/**
 * Get color classes based on alert level
 */
function getAlertColors(level: Alert['level']): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (level) {
    case 'CRITICAL':
      return {
        bg: 'bg-red-50',
        text: 'text-red-900',
        border: 'border-red-300',
        badge: 'bg-red-600 text-white',
      };
    case 'WARN':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-900',
        border: 'border-amber-300',
        badge: 'bg-amber-500 text-white',
      };
    case 'INFO':
    default:
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-900',
        border: 'border-blue-300',
        badge: 'bg-blue-600 text-white',
      };
  }
}

/**
 * Get icon emoji based on alert level
 */
function getAlertIcon(level: Alert['level']): string {
  switch (level) {
    case 'CRITICAL':
      return '⚠';
    case 'WARN':
      return '!';
    case 'INFO':
    default:
      return 'ℹ';
  }
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ dealId }) => {
  const { alerts, isLoading, acknowledge } = useAlerts(dealId);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState<Alert[]>([]);

  // Filter to only show unacknowledged alerts
  useEffect(() => {
    const unacked = (alerts || []).filter((a) => !a.acknowledgedAt);
    setUnacknowledgedAlerts(unacked);
  }, [alerts]);

  if (isLoading || unacknowledgedAlerts.length === 0) {
    return null;
  }

  // Sort by level: CRITICAL > WARN > INFO
  const sortedAlerts = [...unacknowledgedAlerts].sort((a, b) => {
    const levelOrder = { CRITICAL: 0, WARN: 1, INFO: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  // Show the highest-priority alert
  const topAlert = sortedAlerts[0];
  const alertCount = unacknowledgedAlerts.length;
  const colors = getAlertColors(topAlert.level);
  const icon = getAlertIcon(topAlert.level);

  const handleDismiss = async () => {
    try {
      await acknowledge(topAlert.id);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  return (
    <div
      className={`${colors.bg} ${colors.text} border-l-4 ${colors.border} p-4 mb-4 flex items-start justify-between gap-4`}
      role="alert"
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="text-lg mt-0.5">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{topAlert.message}</p>
          {alertCount > 1 && (
            <p className="text-xs opacity-75 mt-1">
              +{alertCount - 1} more alert{alertCount > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {alertCount > 0 && (
          <span className={`${colors.badge} text-xs font-semibold px-2.5 py-1 rounded-full`}>
            {alertCount}
          </span>
        )}
        <button
          onClick={handleDismiss}
          className="text-sm font-medium underline hover:opacity-75 transition-opacity"
          aria-label={`Dismiss alert: ${topAlert.message}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
