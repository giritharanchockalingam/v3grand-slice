/**
 * ─── Recommendation Sparkline ───────────────────────────────────────
 * Compact sparkline showing verdict confidence over time.
 * Color-coded by verdict type. Used in deal list tables.
 * Dots mark verdict flips with tooltip detail.
 */

import React from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  Dot,
} from 'recharts';

type Verdict = 'INVEST' | 'HOLD' | 'DE-RISK' | 'EXIT' | 'DO-NOT-PROCEED';

interface RecommendationPoint {
  month: number;
  confidence: number;
  verdict: Verdict;
  isFlip?: boolean;
}

interface RecommendationSparklineProps {
  data: RecommendationPoint[];
  width?: number;
  height?: number;
}

const verdictColors: Record<Verdict, string> = {
  'INVEST': '#10b981',
  'HOLD': '#f59e0b',
  'DE-RISK': '#f97316',
  'EXIT': '#ef4444',
  'DO-NOT-PROCEED': '#991b1b',
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload.isFlip) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#fff"
      stroke={verdictColors[payload.verdict as Verdict] || '#6b7280'}
      strokeWidth={2}
    />
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload[0]) return null;
  const point = payload[0].payload as RecommendationPoint;

  return (
    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
      <div className="font-semibold">Month {point.month}</div>
      <div style={{ color: verdictColors[point.verdict] }}>
        {point.verdict} ({point.confidence}%)
      </div>
      {point.isFlip && (
        <div className="text-yellow-300 text-[10px] mt-0.5">VERDICT FLIP</div>
      )}
    </div>
  );
};

export const RecommendationSparkline: React.FC<RecommendationSparklineProps> = ({
  data,
  width = 200,
  height = 48,
}) => {
  const latestVerdict = data.length > 0 ? data[data.length - 1].verdict : 'HOLD';
  const strokeColor = verdictColors[latestVerdict] || '#6b7280';

  return (
    <div className="inline-flex items-center gap-2">
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data}>
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke={strokeColor}
            strokeWidth={2}
            dot={<CustomDot />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded"
        style={{
          backgroundColor: `${strokeColor}20`,
          color: strokeColor,
        }}
      >
        {latestVerdict}
      </span>
    </div>
  );
};
