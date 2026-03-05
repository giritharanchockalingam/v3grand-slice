/**
 * ─── Sensitivity Tornado Chart ──────────────────────────────────────
 * Horizontal bar chart showing Monte Carlo sensitivity analysis.
 * Top variables sorted by absolute correlation to IRR.
 * Green for positive correlation, red for negative.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface SensitivityItem {
  variable: string;
  correlation: number;
  label?: string;
}

interface SensitivityTornadoProps {
  sensitivities: SensitivityItem[];
  maxItems?: number;
  title?: string;
}

export const SensitivityTornado: React.FC<SensitivityTornadoProps> = ({
  sensitivities,
  maxItems = 10,
  title = 'Sensitivity Analysis (Correlation to IRR)',
}) => {
  // Sort by absolute correlation descending, take top N
  const sorted = [...sensitivities]
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, maxItems)
    .reverse(); // reverse so highest at top in horizontal bar

  const data = sorted.map((item) => ({
    variable: item.label || item.variable,
    correlation: Number(item.correlation.toFixed(3)),
    absCorrelation: Math.abs(item.correlation),
  }));

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            domain={[-1, 1]}
            tickFormatter={(val) => val.toFixed(1)}
            label={{ value: 'Pearson Correlation', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            type="category"
            dataKey="variable"
            tick={{ fontSize: 12 }}
            width={110}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
            }}
            formatter={(value: number) => [
              value.toFixed(3),
              'Correlation',
            ]}
          />
          <ReferenceLine x={0} stroke="#6b7280" />
          <Bar dataKey="correlation" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.correlation >= 0 ? '#10b981' : '#ef4444'}
                opacity={0.4 + (entry.absCorrelation * 0.6)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Positive impact on IRR</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Negative impact on IRR</span>
        </div>
      </div>
    </div>
  );
};
