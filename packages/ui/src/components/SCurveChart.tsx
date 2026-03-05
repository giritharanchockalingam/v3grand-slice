'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyCashflow {
  month: string;
  planned?: number;
  actual?: number;
  forecast?: number;
}

interface SCurveChartProps {
  monthlyCashflows: MonthlyCashflow[];
  title?: string;
  currencySymbol?: string;
}

const SCurveChart: React.FC<SCurveChartProps> = ({
  monthlyCashflows = [],
  title = 'CAPEX S-Curve: Planned vs Actual vs Forecast',
  currencySymbol = '$',
}) => {
  if (!monthlyCashflows || monthlyCashflows.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Calculate cumulative values
  const chartData = monthlyCashflows.map((item, index, array) => {
    const plannedSum = array
      .slice(0, index + 1)
      .reduce((sum, val) => sum + (val.planned || 0), 0);
    const actualSum = array
      .slice(0, index + 1)
      .reduce((sum, val) => sum + (val.actual || 0), 0);
    const forecastSum = array
      .slice(0, index + 1)
      .reduce((sum, val) => sum + (val.forecast || 0), 0);

    return {
      month: item.month,
      planned: plannedSum,
      actual: actualSum,
      forecast: forecastSum,
    };
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${currencySymbol}${(value / 1000).toFixed(1)}K`;
    return `${currencySymbol}${value.toFixed(0)}`;
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            label={{ value: 'Cumulative CAPEX', angle: -90, position: 'insideLeft' }}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any) => [formatCurrency(value), '']}
            labelFormatter={(label) => `${label}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="planned"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Planned"
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: '#22c55e', r: 4 }}
            activeDot={{ r: 6 }}
            name="Actual"
            isAnimationActive={true}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#f59e0b', r: 4 }}
            activeDot={{ r: 6 }}
            name="Forecast"
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SCurveChart;
