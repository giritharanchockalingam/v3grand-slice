'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';

interface RecommendationHistory {
  version: number;
  confidence: number;
  verdict: string;
  timestamp: string;
}

interface RecommendationSparklineProps {
  data: RecommendationHistory[];
  title?: string;
}

const RecommendationSparkline: React.FC<RecommendationSparklineProps> = ({
  data = [],
  title = 'Recommendation History',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Prepare chart data with verdict change tracking
  const chartData = data.map((item, index, array) => {
    const verdictChanged =
      index > 0 && item.verdict !== array[index - 1].verdict;
    return {
      ...item,
      x: index,
      verdictChanged,
    };
  });

  const getVerdictColor = (verdict: string) => {
    const normalized = verdict.toLowerCase();
    if (normalized.includes('buy') || normalized.includes('strong')) {
      return '#22c55e';
    }
    if (normalized.includes('hold') || normalized.includes('neutral')) {
      return '#f59e0b';
    }
    if (normalized.includes('sell') || normalized.includes('weak')) {
      return '#ef4444';
    }
    return '#6b7280';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="version"
            label={{ value: 'Version', position: 'insideBottomRight', offset: -10 }}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            domain={[0, 1]}
            label={{ value: 'Confidence', angle: -90, position: 'insideLeft' }}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any) => [
              `${(value * 100).toFixed(1)}%`,
              'Confidence',
            ]}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                const item = payload[0].payload as RecommendationHistory;
                return `v${item.version} - ${formatDate(item.timestamp)} - ${item.verdict}`;
              }
              return '';
            }}
          />
          <ReferenceLine
            y={0.5}
            stroke="#d1d5db"
            strokeDasharray="5 5"
            label={{ value: '50% Confidence', position: 'right', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const item = payload as typeof chartData[0];
              const color = item.verdictChanged ? getVerdictColor(item.verdict) : '#3b82f6';
              const size = item.verdictChanged ? 8 : 5;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={size}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 7 }}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-sm">
        <div className="font-medium text-gray-700">Recent Verdicts:</div>
        <div className="flex flex-wrap gap-3">
          {chartData.slice(-3).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getVerdictColor(item.verdict) }}
              ></div>
              <span className="text-gray-600">
                v{item.version}: {item.verdict} ({(item.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecommendationSparkline;
