// ─── Deal Dashboard Page ────────────────────────────────────────────
'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDashboard, useRunUnderwriter } from '../../../hooks/use-dashboard';
import { RecommendationCard } from '../../../components/dashboard/RecommendationCard';
import { MetricsStrip } from '../../../components/dashboard/MetricsStrip';
import { CashFlowTable } from '../../../components/dashboard/CashFlowTable';
import { AssumptionEditor } from '../../../components/assumptions/AssumptionEditor';
import { ScenarioComparison } from '../../../components/scenarios/ScenarioComparison';
import { ConstructionDashboard } from '../../../components/construction/ConstructionDashboard';
import { useAuth } from '../../../lib/auth-context';

export default function DealDashboardPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboard(dealId);
  const underwrite = useRunUnderwriter(dealId);
  const [tab, setTab] = useState<'dashboard' | 'assumptions' | 'scenarios' | 'construction'>('dashboard');

  const canRecompute = ['lead-investor', 'co-investor', 'operator'].includes(user?.role || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading deal dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error?.message ?? 'Deal not found'}</div>
      </div>
    );
  }

  const { deal, property, latestRecommendation, latestProforma, recentAudit } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* ── Deal Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
          <div className="flex gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {deal.assetClass}
            </span>
            <span className="bg-gray-50 text-gray-700 px-2 py-0.5 rounded">
              {deal.lifecyclePhase}
            </span>
            <span>Month {deal.currentMonth}</span>
            <span>{(property as any).keys?.phase1 ?? '?'} keys (Phase 1)</span>
            <span>{(property as any).location?.city}, {(property as any).location?.state}</span>
          </div>
        </div>

        {canRecompute && (
          <button
            onClick={() => underwrite.mutate()}
            disabled={underwrite.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                       disabled:bg-blue-300 rounded-lg transition-colors"
          >
            {underwrite.isPending ? 'Recomputing...' : 'Recompute'}
          </button>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'dashboard'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTab('assumptions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'assumptions'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Assumptions
        </button>
        <button
          onClick={() => setTab('scenarios')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'scenarios'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Scenarios
        </button>
        {user?.role === 'operator' && (
          <button
            onClick={() => setTab('construction')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === 'construction'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Construction
          </button>
        )}
      </div>

      {tab === 'assumptions' ? (
        <AssumptionEditor dealId={dealId} />
      ) : tab === 'scenarios' ? (
        <ScenarioComparison dealId={dealId} />
      ) : tab === 'construction' ? (
        <ConstructionDashboard dealId={dealId} />
      ) : (
        <>
          {/* ── Recommendation ── */}
          <RecommendationCard recommendation={latestRecommendation} />

          {/* ── Key Metrics ── */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">Key Metrics (Base Scenario)</h2>
            <MetricsStrip proforma={latestProforma} />
          </div>

          {/* ── 10-Year Pro Forma ── */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">10-Year Pro Forma</h2>
            <CashFlowTable years={latestProforma?.years ?? []} />
          </div>

          {/* ── Recent Activity ── */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">Recent Activity</h2>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {recentAudit.length === 0 && (
                <p className="p-3 text-sm text-gray-400">No activity yet.</p>
              )}
              {recentAudit.map((entry, i) => (
                <div key={i} className="px-3 py-2 flex justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-700">{entry.action}</span>
                    <span className="text-gray-400 ml-2">({entry.module})</span>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
