'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MonteCarloHistogram } from '../../components/charts/MonteCarloHistogram';
import { SCurveChart } from '../../components/charts/SCurveChart';
import { SensitivityTornado } from '../../components/charts/SensitivityTornado';
import { KPITrendCard } from '../../components/charts/KPITrendCard';
import { RecommendationSparkline } from '../../components/charts/RecommendationSparkline';
import { FactorRadar } from '../../components/charts/FactorRadar';
import { AlertBanner } from '../../components/AlertBanner';
import { LifecyclePhaseBar } from '../../components/LifecyclePhaseBar';
import { apiClient } from '../../lib/api-client';

interface DealDashboardProps {
  dealId: string;
}

function useDealData(dealId: string) {
  return useQuery({
    queryKey: ['deal-dashboard', dealId],
    queryFn: async () => {
      const [deal, recommendation, mc, factor, budget] = await Promise.all([
        apiClient.get(`/deals/${dealId}`).then(r => r.data),
        apiClient.get(`/deals/${dealId}/recommendations/history`).then(r => r.data),
        apiClient.get(`/deals/${dealId}/engines/montecarlo`).then(r => r.data).catch(() => null),
        apiClient.get(`/deals/${dealId}/engines/factor`).then(r => r.data).catch(() => null),
        apiClient.get(`/deals/${dealId}/engines/budget`).then(r => r.data).catch(() => null),
      ]);
      return { deal, recommendation, mc, factor, budget };
    },
    staleTime: 60_000,
  });
}

export default function DashboardPage() {
  // In real app, dealId comes from route params
  const dealId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('dealId') || 'demo'
    : 'demo';

  const { data, isLoading, error } = useDealData(dealId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500 text-lg">Failed to load dashboard data</div>
      </div>
    );
  }

  const { deal, recommendation, mc, factor } = data;
  const latest = Array.isArray(recommendation) && recommendation.length > 0
    ? recommendation[0]
    : null;

  const kpiTrend = Array.isArray(recommendation)
    ? recommendation.slice(0, 12).reverse().map((r: any, i: number) => ({
        month: i + 1,
        value: r.irr || 0,
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {deal?.property_name || 'Deal Dashboard'}
            </h1>
            <p className="text-sm text-gray-500">
              V3 Grand Investment OS — Real-time Deal Intelligence
            </p>
          </div>
          {latest && (
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold px-4 py-2 rounded-full ${
                latest.verdict === 'INVEST' ? 'bg-green-100 text-green-800' :
                latest.verdict === 'HOLD' ? 'bg-amber-100 text-amber-800' :
                latest.verdict === 'DE-RISK' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {latest.verdict}
              </span>
              <span className="text-sm text-gray-500">
                Confidence: {latest.confidence}%
              </span>
            </div>
          )}
        </div>

        {/* Alert Banner */}
        <AlertBanner dealId={dealId} />

        {/* Lifecycle Phase Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <LifecyclePhaseBar
            currentPhase={deal?.lifecycle_phase || 'Pre-Investment'}
            percentCompleteInPhase={deal?.current_month ? Math.min(100, (deal.current_month / 36) * 100) : 0}
          />
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPITrendCard
            label="IRR"
            currentValue={latest?.irr || 0}
            format="percentage"
            trend={kpiTrend}
            thresholdGood={0.15}
            thresholdBad={0.08}
          />
          <KPITrendCard
            label="NPV"
            currentValue={latest?.npv || 0}
            format="currency"
            trend={kpiTrend.map((p: any) => ({ ...p, value: latest?.npv || 0 }))}
            thresholdGood={0}
          />
          <KPITrendCard
            label="Equity Multiple"
            currentValue={latest?.equityMultiple || 0}
            format="multiple"
            trend={kpiTrend.map((p: any) => ({ ...p, value: latest?.equityMultiple || 0 }))}
            thresholdGood={2.0}
            thresholdBad={1.5}
          />
          <KPITrendCard
            label="DSCR"
            currentValue={latest?.avgDSCR || 0}
            format="ratio"
            trend={kpiTrend.map((p: any) => ({ ...p, value: latest?.avgDSCR || 0 }))}
            thresholdGood={1.5}
            thresholdBad={1.2}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Monte Carlo Histogram */}
          {mc && mc.histogram && (
            <MonteCarloHistogram
              histogram={mc.histogram}
              irrDistribution={mc.irrDistribution || { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 }}
              wacc={mc.wacc || 0.10}
            />
          )}

          {/* Factor Radar */}
          {factor && (
            <FactorRadar
              domains={[
                { name: 'Global', score: factor.domainScores?.global?.score || 0, weight: 0.25, factorCount: factor.domainScores?.global?.factors?.length || 0 },
                { name: 'Local', score: factor.domainScores?.local?.score || 0, weight: 0.25, factorCount: factor.domainScores?.local?.factors?.length || 0 },
                { name: 'Asset', score: factor.domainScores?.asset?.score || 0, weight: 0.30, factorCount: factor.domainScores?.asset?.factors?.length || 0 },
                { name: 'Sponsor', score: factor.domainScores?.sponsor?.score || 0, weight: 0.20, factorCount: factor.domainScores?.sponsor?.factors?.length || 0 },
              ]}
              compositeScore={factor.compositeScore || 0}
              impliedDiscountRate={factor.impliedDiscountRate || 0}
              impliedCapRate={factor.impliedCapRate || 0}
            />
          )}

          {/* S-Curve */}
          <SCurveChart />

          {/* Sensitivity Tornado */}
          {mc && mc.sensitivities && (
            <SensitivityTornado sensitivities={mc.sensitivities} />
          )}
        </div>

        {/* Recommendation History */}
        {Array.isArray(recommendation) && recommendation.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendation History</h3>
            <div className="flex items-center gap-4">
              <RecommendationSparkline
                data={recommendation.slice(0, 12).reverse().map((r: any, i: number) => ({
                  month: i + 1,
                  confidence: r.confidence || 0,
                  verdict: r.verdict || 'HOLD',
                  isFlip: r.isFlip || false,
                }))}
                width={400}
                height={64}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
