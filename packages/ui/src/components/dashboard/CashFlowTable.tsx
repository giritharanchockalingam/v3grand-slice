// ─── 10-Year Cash Flow Table ────────────────────────────────────────
'use client';

import type { YearProjection } from '@v3grand/core';

interface Props {
  years: YearProjection[];
}

function fmt(n: number): string {
  // Display in Lakhs (1L = 100,000)
  const lakhs = n / 100_000;
  if (Math.abs(lakhs) >= 100) return (lakhs / 100).toFixed(1) + ' Cr';
  return lakhs.toFixed(0) + ' L';
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function CashFlowTable({ years }: Props) {
  if (!years || years.length === 0) {
    return <p className="text-sm text-gray-400">No projection data available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2 font-medium text-gray-600">Year</th>
            <th className="px-3 py-2 font-medium text-gray-600">Occ%</th>
            <th className="px-3 py-2 font-medium text-gray-600">ADR</th>
            <th className="px-3 py-2 font-medium text-gray-600">RevPAR</th>
            <th className="px-3 py-2 font-medium text-gray-600">Revenue</th>
            <th className="px-3 py-2 font-medium text-gray-600">GOP</th>
            <th className="px-3 py-2 font-medium text-gray-600">GOP%</th>
            <th className="px-3 py-2 font-medium text-gray-600">EBITDA</th>
            <th className="px-3 py-2 font-medium text-gray-600">EBITDA%</th>
            <th className="px-3 py-2 font-medium text-gray-600">Debt Svc</th>
            <th className="px-3 py-2 font-medium text-gray-600">FCFE</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-1.5 font-medium">{y.year}</td>
              <td className="px-3 py-1.5">{pct(y.occupancy)}</td>
              <td className="px-3 py-1.5">₹{y.adr.toLocaleString()}</td>
              <td className="px-3 py-1.5">₹{y.revpar.toLocaleString()}</td>
              <td className="px-3 py-1.5">{fmt(y.totalRevenue)}</td>
              <td className="px-3 py-1.5">{fmt(y.gop)}</td>
              <td className="px-3 py-1.5">{pct(y.gopMargin)}</td>
              <td className="px-3 py-1.5">{fmt(y.ebitda)}</td>
              <td className="px-3 py-1.5">{pct(y.ebitdaMargin)}</td>
              <td className="px-3 py-1.5">{fmt(y.debtService)}</td>
              <td className={`px-3 py-1.5 font-medium ${y.fcfe >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(y.fcfe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
