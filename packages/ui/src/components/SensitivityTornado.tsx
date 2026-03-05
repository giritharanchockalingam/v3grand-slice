'use client';

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
} from 'recharts';

interface SensitivityItem {
  parameter: string;
  correlation: number;
}

interface SensitivityTornadoProps {
  data: SensitivityItem[];
  title?: string;
}

const SensitivityTornado: React.FC<SensitivityTornadoProps> = ({
  data = [],
  title = 'Sensitivity Analysis - Tornado Diagram',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Sort by absolute correlation value and prepare data
  const sortedData = [...data]
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .map((item) => ({
      parameter: item.parameter,
      value: item.correlation,
      absoluteValue: Math.abs(item.correlation),
    }));

  const getBarColor = (value: number) => {
    return value > 0 ? '#3b82f6' : '#ef4444';
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={Math.max(400, sortedData.length * 50)}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            domain={[-1, 1]}
            tickFormatter={formatPercent}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            dataKey="parameter"
            type="category"
            width={140}
            tick={{ fontSize: 12, fill: '#374151' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any) => [formatPercent(value), 'Correlation']}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-600">Positive Correlation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-600">Negative Correlation</span>
        </div>
      </div>
    </div>
  );
};

export default SensitivityTornado;
