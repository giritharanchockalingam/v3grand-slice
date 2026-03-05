'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

interface MCHistogramChartProps {
  data: HistogramBin[];
  wacc?: number;
  title?: string;
}

const MCHistogramChart: React.FC<MCHistogramChartProps> = ({
  data = [],
  wacc = 0.08,
  title = 'IRR Distribution',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const chartData = data.map((bin) => ({
    ...bin,
    label: `${(bin.binStart * 100).toFixed(1)}%-${(bin.binEnd * 100).toFixed(1)}%`,
    midpoint: (bin.binStart + bin.binEnd) / 2,
  }));

  const getBarColor = (midpoint: number) => {
    return midpoint > wacc ? '#22c55e' : '#ef4444';
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value) => [value, 'Count']}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.midpoint)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-600">Above WACC ({(wacc * 100).toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-600">Below WACC ({(wacc * 100).toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
};

export default MCHistogramChart;
