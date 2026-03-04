// ─── Alert Feed ──────────────────────────────────────────────────────
'use client';

interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  module?: string;
}

interface Props {
  alerts?: Alert[];
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  info:     { bg: 'bg-blue-50/50',   border: 'border-blue-200/50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  warning:  { bg: 'bg-amber-50/50',  border: 'border-amber-200/50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  critical: { bg: 'bg-red-50/50',    border: 'border-red-200/50',    text: 'text-red-700',    dot: 'bg-red-500' },
};

export function AlertFeed({ alerts }: Props) {
  const mockAlerts: Alert[] = [
    { id: '1', message: 'Recommendation updated: INVEST verdict with 82% confidence', severity: 'info', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), module: 'Underwriter' },
    { id: '2', message: 'Construction milestone "Foundation Complete" marked as delayed', severity: 'warning', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), module: 'Construction' },
    { id: '3', message: 'Budget line "Structural Steel" variance exceeds 10%', severity: 'warning', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), module: 'Budget' },
    { id: '4', message: 'Change Order #CO-2024-015 submitted for approval', severity: 'info', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), module: 'Change Orders' },
    { id: '5', message: 'Critical: Debt covenant DSCR projection falls below 1.2x', severity: 'critical', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), module: 'Financial' },
  ];

  const displayAlerts = alerts && alerts.length > 0 ? alerts : mockAlerts;
  const recentAlerts = displayAlerts.slice(0, 5);

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div>
      <h3 className="section-title mb-3">Recent Activity</h3>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {recentAlerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-xs text-surface-400">No alerts yet</p>
          </div>
        ) : (
          recentAlerts.map((alert) => {
            const s = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
            return (
              <div
                key={alert.id}
                className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2.5 transition-all hover:shadow-glass-sm ${s.bg} ${s.border}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium leading-relaxed ${s.text}`}>{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-2xs opacity-70">
                    {alert.module && (
                      <span className="font-medium">{alert.module}</span>
                    )}
                    <span className="font-mono">{formatTime(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {displayAlerts.length > 5 && (
        <div className="mt-3 pt-3 border-t border-surface-100 text-center">
          <button className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors">
            View all {displayAlerts.length} alerts
          </button>
        </div>
      )}
    </div>
  );
}
