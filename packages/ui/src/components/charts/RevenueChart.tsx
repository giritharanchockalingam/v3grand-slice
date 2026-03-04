// ─── Revenue Chart (10-Year Pro Forma Visualization) ──────────────────
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
interface Props {
  years?: Array<{
    year: number;
    totalRevenue: number;
    ebitda: number;
    fcfe: number;
  }>;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + 'Cr';
  if (Math.abs(n) >= 1_00_000) return (n / 1_00_000).toFixed(0) + 'L';
  return n.toLocaleString();
}

function generateMockYears() {
  const data = [];
  for (let i = 1; i <= 10; i++) {
    data.push({
      year: i,
      totalRevenue: 50_00_00_000 * (0.8 + i * 0.08),
      ebitda: 20_00_00_000 * (0.7 + i * 0.08),
      fcfe: 10_00_00_000 * (0.5 + i * 0.06),
    });
  }
  return data;
}

export function RevenueChart({ years }: Props) {
  const chartYears = years && years.length > 0 ? years : generateMockYears();

  const chartData = chartYears.map(year => ({
    year: year.year.toString(),
    Revenue: year.totalRevenue,
    EBITDA: year.ebitda,
    FCFE: year.fcfe,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-1">{`Year ${payload[0]?.payload.year}`}</p>
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
      <h3 className="text-sm font-medium text-gray-700 mb-4">10-Year Pro Forma</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={fmt}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
          />
          <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="EBITDA" fill="#0d9488" radius={[4, 4, 0, 0]} />
          <Bar dataKey="FCFE" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
