// ─── S-Curve: Planned vs Actual Cumulative Spend ────────────────────
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SCurveData {
  month: number;
  planned: number;
  actual: number;
}

interface Props {
  data?: SCurveData[];
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + ' Cr';
  if (Math.abs(n) >= 1_00_000) return (n / 1_00_000).toFixed(0) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

export function SCurveChart({ data }: Props) {
  // Use provided data or generate mock data
  const chartData = data && data.length > 0
    ? data.map(d => ({
        month: `M${d.month}`,
        planned: d.planned,
        actual: d.actual,
      }))
    : generateMockSCurve();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-1">{payload[0]?.payload.month}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {fmt(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Construction S-Curve</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={fmt}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
          <Line
            type="monotone"
            dataKey="planned"
            stroke="#0d9488"
            dot={false}
            strokeWidth={2}
            name="Planned Cumulative"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
            name="Actual Cumulative"
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-500 mt-3">
        Planned S-curve shows expected construction spend progression. Actual shows cumulative expenditure to date.
      </p>
    </div>
  );
}

function generateMockSCurve(): Array<{ month: string; planned: number; actual: number }> {
  const data = [];
  for (let m = 0; m <= 36; m++) {
    const progress = m / 36;
    // S-curve formula: smooth acceleration then deceleration
    const planned = 100_00_00_000 * (progress < 0.5
      ? 2 * progress * progress
      : 1 - 2 * (1 - progress) * (1 - progress));
    const actual = planned * (0.9 + Math.random() * 0.15); // Actual varies 10-25% from planned
    data.push({
      month: `M${m}`,
      planned: Math.max(0, planned),
      actual: Math.max(0, Math.min(actual, 100_00_00_000)),
    });
  }
  return data;
}
