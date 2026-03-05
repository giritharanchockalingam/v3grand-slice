import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

interface IRRDistribution {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

interface MonteCarloHistogramProps {
  histogram: HistogramBin[];
  irrDistribution: IRRDistribution;
  wacc: number;
}

export const MonteCarloHistogram: React.FC<MonteCarloHistogramProps> = ({
  histogram,
  irrDistribution,
  wacc,
}) => {
  // Transform histogram data for Recharts
  const data = histogram.map((bin) => ({
    range: `${bin.binStart.toFixed(1)}%-${bin.binEnd.toFixed(1)}%`,
    count: bin.count,
    binStart: bin.binStart,
    binEnd: bin.binEnd,
  }));

  // Custom bar color based on WACC threshold
  const CustomBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const isAboveWacc = payload.binStart >= wacc;
    const color = isAboveWacc ? '#10b981' : '#ef4444'; // green above WACC, red below

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        opacity={0.8}
      />
    );
  };

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        IRR Distribution (Monte Carlo Analysis)
      </h3>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="range"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
          />
          <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
            }}
            formatter={(value) => [`${value} scenarios`, 'Count']}
            labelFormatter={(label) => `IRR Range: ${label}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            height={30}
            iconType="line"
          />

          {/* Reference lines for distribution percentiles */}
          <ReferenceLine
            x={`${irrDistribution.p10.toFixed(1)}%-${(irrDistribution.p10 + (histogram[0]?.binEnd - histogram[0]?.binStart || 5)).toFixed(1)}%`}
            stroke="#3b82f6"
            strokeDasharray="5 5"
            label={{ value: `P10: ${irrDistribution.p10.toFixed(1)}%`, fill: '#3b82f6', offset: 10 }}
          />
          <ReferenceLine
            x={`${irrDistribution.p50.toFixed(1)}%-${(irrDistribution.p50 + (histogram[0]?.binEnd - histogram[0]?.binStart || 5)).toFixed(1)}%`}
            stroke="#8b5cf6"
            strokeDasharray="5 5"
            label={{ value: `P50: ${irrDistribution.p50.toFixed(1)}%`, fill: '#8b5cf6', offset: 10 }}
          />
          <ReferenceLine
            x={`${irrDistribution.p90.toFixed(1)}%-${(irrDistribution.p90 + (histogram[0]?.binEnd - histogram[0]?.binStart || 5)).toFixed(1)}%`}
            stroke="#06b6d4"
            strokeDasharray="5 5"
            label={{ value: `P90: ${irrDistribution.p90.toFixed(1)}%`, fill: '#06b6d4', offset: 10 }}
          />

          {/* WACC reference line in red */}
          <ReferenceLine
            x={`${wacc.toFixed(1)}%-${(wacc + (histogram[0]?.binEnd - histogram[0]?.binStart || 5)).toFixed(1)}%`}
            stroke="#ef4444"
            strokeWidth={2}
            label={{ value: `WACC: ${wacc.toFixed(1)}%`, fill: '#ef4444', offset: 10, fontWeight: 'bold' }}
          />

          <Bar dataKey="count" shape={<CustomBar />} name="Frequency" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-5 gap-4">
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-xs text-gray-600">P10</p>
          <p className="text-lg font-semibold text-blue-600">
            {irrDistribution.p10.toFixed(2)}%
          </p>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <p className="text-xs text-gray-600">P25</p>
          <p className="text-lg font-semibold text-purple-600">
            {irrDistribution.p25.toFixed(2)}%
          </p>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <p className="text-xs text-gray-600">P50 (Median)</p>
          <p className="text-lg font-semibold text-purple-600">
            {irrDistribution.p50.toFixed(2)}%
          </p>
        </div>
        <div className="bg-cyan-50 p-3 rounded">
          <p className="text-xs text-gray-600">P75</p>
          <p className="text-lg font-semibold text-cyan-600">
            {irrDistribution.p75.toFixed(2)}%
          </p>
        </div>
        <div className="bg-cyan-50 p-3 rounded">
          <p className="text-xs text-gray-600">P90</p>
          <p className="text-lg font-semibold text-cyan-600">
            {irrDistribution.p90.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
};
