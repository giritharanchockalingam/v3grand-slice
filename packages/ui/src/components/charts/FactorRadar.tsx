/**
 * ─── Factor Radar Chart ─────────────────────────────────────────────
 * Radar chart displaying 4-domain factor scores.
 * Shows Global, Local, Asset, Sponsor scores on 1-5 scale.
 * Includes composite score badge and domain breakdowns.
 */

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface DomainScore {
  name: string;
  score: number;
  weight: number;
  factorCount: number;
}

interface FactorRadarProps {
  domains: DomainScore[];
  compositeScore: number;
  impliedDiscountRate: number;
  impliedCapRate: number;
  comparisonDomains?: DomainScore[];
  comparisonLabel?: string;
}

function getCompositeColor(score: number): string {
  if (score >= 4.0) return '#10b981';
  if (score >= 3.0) return '#f59e0b';
  if (score >= 2.0) return '#f97316';
  return '#ef4444';
}

function getCompositeLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 3.5) return 'Good';
  if (score >= 2.5) return 'Fair';
  if (score >= 1.5) return 'Weak';
  return 'Poor';
}

export const FactorRadar: React.FC<FactorRadarProps> = ({
  domains,
  compositeScore,
  impliedDiscountRate,
  impliedCapRate,
  comparisonDomains,
  comparisonLabel = 'Previous',
}) => {
  const radarData = domains.map((d, i) => ({
    domain: d.name,
    score: d.score,
    weight: d.weight,
    factorCount: d.factorCount,
    fullMark: 5,
    ...(comparisonDomains ? { comparison: comparisonDomains[i]?.score ?? 0 } : {}),
  }));

  const compositeColor = getCompositeColor(compositeScore);

  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Factor Analysis</h3>
        <div className="flex items-center gap-2">
          <div
            className="text-xl font-bold px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${compositeColor}15`,
              color: compositeColor,
            }}
          >
            {compositeScore.toFixed(1)} / 5.0
          </div>
          <span className="text-xs text-gray-500">{getCompositeLabel(compositeScore)}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fontSize: 13, fill: '#374151' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tickCount={6}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)} / 5.0`,
              name === 'comparison' ? comparisonLabel : 'Current',
            ]}
          />
          <Radar
            name="Current"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {comparisonDomains && (
            <Radar
              name={comparisonLabel}
              dataKey="comparison"
              stroke="#9ca3af"
              fill="#9ca3af"
              fillOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="5 5"
            />
          )}
        </RadarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {domains.map((d) => (
          <div key={d.name} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
            <div>
              <p className="text-sm font-medium text-gray-700">{d.name}</p>
              <p className="text-xs text-gray-400">
                {d.factorCount} factors | {(d.weight * 100).toFixed(0)}% weight
              </p>
            </div>
            <p className="text-lg font-semibold" style={{ color: getCompositeColor(d.score) }}>
              {d.score.toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
        <div className="text-center">
          <p className="text-xs text-gray-500">Implied Discount Rate</p>
          <p className="text-lg font-semibold text-gray-900">
            {(impliedDiscountRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Implied Cap Rate</p>
          <p className="text-lg font-semibold text-gray-900">
            {(impliedCapRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};
