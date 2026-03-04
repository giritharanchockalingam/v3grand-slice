// ─── Monte Carlo IRR Distribution Histogram ──────────────────────────
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  distribution?: Array<{ bin: number; count: number }>;
  p10?: number;
  p50?: number;
  p90?: number;
  pNegativeNPV?: number;
  pIRRLessWACC?: number;
}

export function MCHistogramChart({
  distribution = [],
  p10 = 0.08,
  p50 = 0.12,
  p90 = 0.16,
  pNegativeNPV = 0.05,
  pIRRLessWACC = 0.10,
}: Props) {
  // Mock distribution if not provided
  const chartData = distribution.length === 0
    ? generateMockDistribution()
    : distribution.map(d => ({
        bin: (d.bin * 100).toFixed(0) + '%',
        count: d.count,
      }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white p-3 rounded shadow-lg border border-gray-200">
        <p className="text-xs font-medium text-gray-700">{payload[0]?.payload.bin}</p>
        <p className="text-xs text-blue-600">Frequency: {payload[0]?.value}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Monte Carlo IRR Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="rounded border border-blue-200 bg-blue-50 p-2">
            <span className="text-gray-600">P10</span>
            <p className="font-bold text-blue-700">{(p10 * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded border border-teal-200 bg-teal-50 p-2">
            <span className="text-gray-600">P50 (Median)</span>
            <p className="font-bold text-teal-700">{(p50 * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded border border-green-200 bg-green-50 p-2">
            <span className="text-gray-600">P90</span>
            <p className="font-bold text-green-700">{(p90 * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded border border-red-200 bg-red-50 p-2">
            <span className="text-gray-600">P(NPV &lt; 0)</span>
            <p className="font-bold text-red-700">{(pNegativeNPV * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded border border-orange-200 bg-orange-50 p-2">
            <span className="text-gray-600">P(IRR &lt; WACC)</span>
            <p className="font-bold text-orange-700">{(pIRRLessWACC * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <ReferenceLine x={(p10 * 100).toFixed(0) + '%'} stroke="#3b82f6" strokeDasharray="5 5" label="P10" />
          <ReferenceLine x={(p50 * 100).toFixed(0) + '%'} stroke="#0d9488" strokeDasharray="5 5" label="P50" />
          <ReferenceLine x={(p90 * 100).toFixed(0) + '%'} stroke="#10b981" strokeDasharray="5 5" label="P90" />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-500 mt-3">
        Monte Carlo simulations show the distribution of potential IRR outcomes across {chartData.length} scenarios.
        Higher concentrations indicate more likely outcomes.
      </p>
    </div>
  );
}

function generateMockDistribution() {
  return [
    { bin: '5%', count: 12 },
    { bin: '7%', count: 28 },
    { bin: '9%', count: 65 },
    { bin: '11%', count: 95 },
    { bin: '13%', count: 115 },
    { bin: '15%', count: 92 },
    { bin: '17%', count: 58 },
    { bin: '19%', count: 22 },
    { bin: '21%', count: 8 },
  ];
}
