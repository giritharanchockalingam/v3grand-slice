'use client';

/**
 * DataFreshnessBadge: Shows data source + freshness in a compact pill.
 * Color: green (<7d), amber (7-30d), red (>30d)
 */

interface DataFreshnessBadgeProps {
  source: string;
  fetchedAt?: string | Date;
  tier?: 1 | 2 | 3;
  className?: string;
}

export function DataFreshnessBadge({ source, fetchedAt, tier, className = '' }: DataFreshnessBadgeProps) {
  const now = Date.now();
  const fetched = fetchedAt ? new Date(fetchedAt).getTime() : now - 86400000 * 60; // default old
  const ageMs = now - fetched;
  const ageDays = Math.floor(ageMs / 86400000);
  const ageHours = Math.floor(ageMs / 3600000);

  let ageLabel: string;
  if (ageHours < 1) ageLabel = 'just now';
  else if (ageHours < 24) ageLabel = `${ageHours}h ago`;
  else if (ageDays < 7) ageLabel = `${ageDays}d ago`;
  else ageLabel = `${ageDays}d ago`;

  let colorClass: string;
  let dotColor: string;
  if (ageDays < 7) {
    colorClass = 'data-source-fresh';
    dotColor = 'bg-emerald-500';
  } else if (ageDays < 30) {
    colorClass = 'data-source-stale';
    dotColor = 'bg-amber-500';
  } else {
    colorClass = 'data-source-old';
    dotColor = 'bg-red-500';
  }

  return (
    <span className={`${colorClass} ${className}`} title={`Source: ${source} · Fetched: ${new Date(fetched).toLocaleString()}${tier ? ` · Tier ${tier}` : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {source}
      <span className="opacity-70">·</span>
      {ageLabel}
    </span>
  );
}
