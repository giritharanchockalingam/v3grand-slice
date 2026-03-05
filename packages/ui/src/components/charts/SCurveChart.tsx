/**
 * ─── S-Curve Chart (Enterprise) ─────────────────────────────────────
 * Visualizes CAPEX spend distribution across project timeline.
 * Displays cumulative curve with actual vs. planned overlay.
 * Uses Recharts AreaChart with gradient fill, budget reference, KPI cards.
 */
'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface SCurveDataPoint {
  month: number;
  planned: number;
  actual?: number;
}

interface SCurveChartProps {
  data?: SCurveDataPoint[];
  totalBudget?: number;
  currentMonth?: number;
  curveType?: 'linear' | 's-curve' | 'front-loaded' | 'back-loaded';
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + ' Cr';
  if (Math.abs(n) >= 1_00_000) return (n / 1_00_000).toFixed(0) + ' L';
  return '\u20B9' + n.toLocaleString('en-IN');
}

const curveLabels: Record<string, string> = {
  'linear': 'Linear',
  's-curve': 'S-Curve (Logistic)',
  'front-loaded': 'Front-Loaded',
  'back-loaded': 'Back-Loaded',
};

export function SCurveChart({
  data,
  totalBudget,
  currentMonth,
  curveType = 's-curve',
}: SCurveChartProps) {
  const chartData = data && data.length > 0
    ? data.map(d => ({
        month: `M${d.month}`,
        planned: d.planned,
        actual: d.actual ?? 0,
      }))
    : generateMockSCurve();

  const lastPoint = chartData[chartData.length - 1];
  const budget = totalBudget ?? (lastPoint ? lastPoint.planned * 1.05 : 0);
  const spentToDate = lastPoint?.actual ?? 0;
  const pctComplete = budget > 0 ? ((spentToDate / budget) * 100).toFixed(1) : '0';

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-xs">
        <p className="font-medium mb-1">{payload[0]?.payload.month}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }}>
            {entry.name}: {fmt(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Construction S-Curve</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
          {curveLabels[curveType] || curveType}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={fmt} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />

          {totalBudget && (
            <ReferenceLine
              y={totalBudget}
              stroke="#ef4444"
              strokeDasharray="8 4"
              label={{ value: `Budget: ${fmt(totalBudget)}`, fill: '#ef4444', position: 'right', fontSize: 10 }}
            />
          )}

          {currentMonth && (
            <ReferenceLine
              x={`M${currentMonth}`}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{ value: 'Today', fill: '#6b7280', position: 'top', fontSize: 10 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="planned"
            stroke="#0d9488"
            strokeWidth={2}
            fill="url(#plannedGrad)"
            name="Planned Cumulative"
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#actualGrad)"
            name="Actual Cumulative"
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* KPI Row */}
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="bg-teal-50 p-2 rounded">
          <p className="text-[10px] text-gray-500">Budget</p>
          <p className="text-sm font-semibold text-teal-700">{fmt(budget)}</p>
        </div>
        <div className="bg-blue-50 p-2 rounded">
          <p className="text-[10px] text-gray-500">Spent</p>
          <p className="text-sm font-semibold text-blue-700">{fmt(spentToDate)}</p>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <p className="text-[10px] text-gray-500">% Complete</p>
          <p className="text-sm font-semibold text-gray-700">{pctComplete}%</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        S-curve shows expected vs actual construction spend progression.
      </p>
    </div>
  );
}

function generateMockSCurve(): Array<{ month: string; planned: number; actual: number }> {
  const data = [];
  for (let m = 0; m <= 36; m++) {
    const progress = m / 36;
    const planned = 100_00_00_000 * (progress < 0.5
      ? 2 * progress * progress
      : 1 - 2 * (1 - progress) * (1 - progress));
    const actual = planned * (0.9 + Math.random() * 0.15);
    data.push({
      month: `M${m}`,
      planned: Math.max(0, planned),
      actual: Math.max(0, Math.min(actual, 100_00_00_000)),
    });
  }
  return data;
}
