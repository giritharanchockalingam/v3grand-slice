'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';

interface TrendPoint {
  value: number;
  timestamp?: string;
}

interface KPITrendCardProps {
  label: string;
  currentValue: number;
  previousValue: number;
  historyData: TrendPoint[];
  formatString?: (value: number) => string;
  unit?: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
}

const KPITrendCard: React.FC<KPITrendCardProps> = ({
  label,
  currentValue,
  previousValue,
  historyData = [],
  formatString,
  unit = '',
  color = 'blue',
}) => {
  const getColorClasses = (colorType: string) => {
    const colors: Record<string, { bg: string; text: string; arrow: string }> = {
      blue: {
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-700',
        arrow: 'text-blue-600',
      },
      green: {
        bg: 'bg-green-50 border-green-200',
        text: 'text-green-700',
        arrow: 'text-green-600',
      },
      amber: {
        bg: 'bg-amber-50 border-amber-200',
        text: 'text-amber-700',
        arrow: 'text-amber-600',
      },
      red: {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-700',
        arrow: 'text-red-600',
      },
    };
    return colors[colorType] || colors.blue;
  };

  const colorClasses = getColorClasses(color);
  const change = currentValue - previousValue;
  const percentChange = previousValue !== 0 ? (change / Math.abs(previousValue)) * 100 : 0;
  const isPositive = change >= 0;

  const defaultFormatter = (value: number) => value.toFixed(2);
  const formatter = formatString || defaultFormatter;

  const chartData = historyData.length > 0
    ? historyData
    : [{ value: currentValue }, { value: currentValue }];

  return (
    <div
      className={`rounded-lg border ${colorClasses.bg} p-4 space-y-3`}
    >
      {/* Header with label */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">{label}</h4>
      </div>

      {/* Value and trend */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatter(currentValue)}
        </span>
        {unit && <span className="text-sm font-medium text-gray-600">{unit}</span>}
      </div>

      {/* Trend indicator */}
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1 text-sm font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414-1.414L13.586 7H12z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 13a1 1 0 110 2H7a1 1 0 01-1-1V9a1 1 0 112 0v3.586l4.293-4.293a1 1 0 011.414 1.414L8.414 13H12z" clipRule="evenodd" />
            </svg>
          )}
          {Math.abs(percentChange).toFixed(1)}%
        </span>
        <span className="text-sm text-gray-600">
          vs {formatter(previousValue)}
        </span>
      </div>

      {/* Mini sparkline chart */}
      {chartData.length > 1 && (
        <div className="pt-2">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? '#22c55e' : '#ef4444'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? '#22c55e' : '#ef4444'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="timestamp" hide={true} />
              <YAxis hide={true} domain="dataMin dataMax" />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#22c55e' : '#ef4444'}
                fill={`url(#gradient-${label})`}
                strokeWidth={2}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default KPITrendCard;
