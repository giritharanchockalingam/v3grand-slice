/**
 * ─── KPI Trend Card ─────────────────────────────────────────────────
 * Compact card showing a KPI with sparkline trend.
 * Used in dashboard grids for IRR, DSCR, NPV, Equity Multiple.
 * Shows current value, trend direction, and mini area chart.
 */

import React from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';

interface KPIDataPoint {
  month: number;
  value: number;
}

interface KPITrendCardProps {
  label: string;
  currentValue: number;
  previousValue?: number;
  format?: 'percentage' | 'currency' | 'multiple' | 'ratio' | 'number';
  trend: KPIDataPoint[];
  thresholdGood?: number;
  thresholdBad?: number;
  unit?: string;
}

function formatValue(value: number, format: string, unit?: string): string {
  switch (format) {
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`;
    case 'currency':
      if (Math.abs(value) >= 10_000_000) return `${(value / 10_000_000).toFixed(1)} Cr`;
      if (Math.abs(value) >= 100_000) return `${(value / 100_000).toFixed(1)} L`;
      return `${(value / 1000).toFixed(0)}K`;
    case 'multiple':
      return `${value.toFixed(2)}x`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'number':
    default:
      return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
  }
}

function getTrendDirection(current: number, previous?: number): 'up' | 'down' | 'flat' {
  if (previous === undefined) return 'flat';
  if (current > previous * 1.005) return 'up';
  if (current < previous * 0.995) return 'down';
  return 'flat';
}

function getStatusColor(value: number, good?: number, bad?: number): string {
  if (good !== undefined && value >= good) return '#10b981';
  if (bad !== undefined && value <= bad) return '#ef4444';
  return '#f59e0b';
}

export const KPITrendCard: React.FC<KPITrendCardProps> = ({
  label,
  currentValue,
  previousValue,
  format = 'number',
  trend,
  thresholdGood,
  thresholdBad,
  unit,
}) => {
  const direction = getTrendDirection(currentValue, previousValue);
  const color = getStatusColor(currentValue, thresholdGood, thresholdBad);
  const changePercent = previousValue
    ? (((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1)
    : null;

  const trendArrow = direction === 'up' ? '\u2191' : direction === 'down' ? '\u2193' : '\u2192';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {changePercent && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: direction === 'up' ? '#d1fae5' : direction === 'down' ? '#fee2e2' : '#f3f4f6',
              color: direction === 'up' ? '#065f46' : direction === 'down' ? '#991b1b' : '#4b5563',
            }}
          >
            {trendArrow} {changePercent}%
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="text-2xl font-bold" style={{ color }}>
          {formatValue(currentValue, format, unit)}
        </p>
      </div>

      {trend.length > 1 && (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id={`kpi-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#kpi-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
