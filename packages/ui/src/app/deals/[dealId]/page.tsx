// ─── Deal Dashboard Page ────────────────────────────────────────────
'use client';

import { useParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useDashboard, useRunUnderwriter } from '../../../hooks/use-dashboard';
import { usePermissions } from '../../../hooks/use-permissions';
import { RecommendationCard } from '../../../components/dashboard/RecommendationCard';
import { MetricsStrip } from '../../../components/dashboard/MetricsStrip';
import { CashFlowTable } from '../../../components/dashboard/CashFlowTable';
import { LifecyclePhaseBar } from '../../../components/dashboard/LifecyclePhaseBar';
import { RecommendationHistory } from '../../../components/dashboard/RecommendationHistory';
import { AlertFeed } from '../../../components/dashboard/AlertFeed';
import { RevenueChart } from '../../../components/charts/RevenueChart';
import { MCHistogramChart } from '../../../components/charts/MCHistogramChart';
import { SCurveChart } from '../../../components/charts/SCurveChart';
import { FactorScorePanel } from '../../../components/charts/FactorScorePanel';
import { AssumptionEditor } from '../../../components/assumptions/AssumptionEditor';
import { ScenarioComparison } from '../../../components/scenarios/ScenarioComparison';
import { ConstructionDashboard } from '../../../components/construction/ConstructionDashboard';
import { RisksDashboard } from '../../../components/risks/RisksDashboard';
import { RevaluationPanel } from '../../../components/dashboard/RevaluationPanel';
import { SensitivityAnalysis } from '../../../components/analysis/SensitivityAnalysis';
import { ExportPanel } from '../../../components/export/ExportPanel';
import { useAuth } from '../../../lib/auth-context';
import { MarketIntelligenceTab } from '../../../components/dashboard/MarketIntelligenceTab';
import { PartnerWalkthrough } from '../../../components/dashboard/PartnerWalkthrough';
import { FeasibilityWorkbench } from '../../../components/feasibility/FeasibilityWorkbench';
import {
  TabDashboardIcon,
  TabChartIcon,
  TabConstructionIcon,
  TabRiskIcon,
  TabSettingsIcon,
  TabGlobeIcon,
  TabFlaskIcon,
  TabRefreshIcon,
  TabClipboardIcon,
  TabFeasibilityIcon,
} from '../../../components/icons/PortalIcons';

type TabKey = 'overview' | 'underwriting' | 'construction' | 'risks' | 'assumptions' | 'feasibility' | 'market-intel' | 'sensitivity' | 'revaluation' | 'audit';

const TABS: Array<{ key: TabKey; label: string; Icon: React.ComponentType<{ className?: string }>; requiresConstruction?: boolean }> = [
  { key: 'overview', label: 'Dashboard', Icon: TabDashboardIcon },
  { key: 'underwriting', label: 'Underwriting', Icon: TabChartIcon },
  { key: 'construction', label: 'Construction', Icon: TabConstructionIcon, requiresConstruction: true },
  { key: 'risks', label: 'Risks', Icon: TabRiskIcon },
  { key: 'assumptions', label: 'Assumptions', Icon: TabSettingsIcon },
  { key: 'feasibility', label: 'Feasibility', Icon: TabFeasibilityIcon },
  { key: 'market-intel', label: 'Market Intel', Icon: TabGlobeIcon },
  { key: 'sensitivity', label: 'What-If', Icon: TabFlaskIcon },
  { key: 'revaluation', label: 'Revaluation', Icon: TabRefreshIcon },
  { key: 'audit', label: 'Audit Trail', Icon: TabClipboardIcon },
];

export default function DealDashboardPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { user } = useAuth();
  const { canRecompute, canManageConstruction, canEdit } = usePermissions();
  const { data, isLoading, error } = useDashboard(dealId);
  const underwrite = useRunUnderwriter(dealId);
  const [tab, setTab] = useState<TabKey>('overview');
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const showConstruction = canManageConstruction || user?.role === 'co-investor';

  useEffect(() => {
    if (underwrite.isError) {
      setToast({ msg: underwrite.error?.message ?? 'Recompute failed', type: 'error' });
    }
    if (underwrite.isSuccess) {
      const result = underwrite.data as any;
      if (result && result.ok === false) {
        setToast({ msg: result.error ?? 'Partial engine failure — existing numbers preserved', type: 'error' });
      } else {
        setToast({ msg: 'Recompute complete — all engines updated', type: 'success' });
      }
    }
  }, [underwrite.isError, underwrite.isSuccess, underwrite.error, underwrite.data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Skeleton Header */}
        <div className="elevated-card p-8">
          <div className="shimmer h-8 w-64 mb-4" />
          <div className="flex gap-3">
            <div className="shimmer h-7 w-24 rounded-full" />
            <div className="shimmer h-7 w-32 rounded-full" />
            <div className="shimmer h-7 w-20 rounded-full" />
          </div>
        </div>
        {/* Skeleton Metrics */}
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="elevated-card p-4">
              <div className="shimmer h-3 w-20 mb-3" />
              <div className="shimmer h-8 w-16" />
            </div>
          ))}
        </div>
        {/* Skeleton Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="elevated-card p-6"><div className="shimmer h-48 w-full" /></div>
          <div className="elevated-card p-6"><div className="shimmer h-48 w-full" /></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="elevated-card p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-surface-900 mb-2">Failed to Load Deal</h2>
          <p className="text-sm text-surface-500">{error?.message ?? 'Deal not found or you may not have access.'}</p>
        </div>
      </div>
    );
  }

  const {
    deal, property, latestRecommendation, latestProforma, recentEvents,
    latestMC, latestFactor, latestBudget, latestSCurve,
    constructionProgress, budgetSummary, recommendationHistory,
    marketAssumptions, financialAssumptions, decisionInsight,
  } = data;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Deal Header ── */}
      <div className="elevated-card overflow-hidden">
        {/* Gradient accent */}
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-teal-300" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{deal.name}</h1>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="badge-brand">{deal.assetClass}</span>
                <span className="badge bg-brand-50/50 text-brand-600 border border-brand-200/30">
                  Phase: {deal.lifecyclePhase}
                </span>
                <span className="badge-neutral">Month {deal.currentMonth}</span>
                {(property as any)?.location?.city && (
                  <span className="badge bg-violet-50 text-violet-600 border border-violet-200/50">
                    {(property as any).location.city}, {(property as any).location.state}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <PartnerWalkthrough data={data} />
              </div>
            </div>

            {canRecompute && (
              <button
                onClick={() => underwrite.mutate()}
                disabled={underwrite.isPending}
                className="btn-primary flex-shrink-0 ml-4"
              >
                {underwrite.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running Engines...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recompute
                  </>
                )}
              </button>
            )}
          </div>

          <LifecyclePhaseBar currentPhase={deal.lifecyclePhase} currentMonth={deal.currentMonth} />
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="elevated-card rounded-b-none border-b-0">
        <div className="flex gap-0 overflow-x-auto px-2">
          {TABS.filter(t => !t.requiresConstruction || showConstruction).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={tab === t.key ? 'tab-item-active' : 'tab-item'}
            >
              <t.Icon className="mr-1.5 w-4 h-4 flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toast Banner ── */}
      {toast && (
        <div className={toast.type === 'error' ? 'toast-error' : 'toast-success'}>
          <span className="font-medium">
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
          </span>
          <button onClick={() => setToast(null)} className="ml-3 text-xs font-semibold hover:underline opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* ────── OVERVIEW TAB ────── */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-slide-up">
          {/* Recommendation + Quick Metrics */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
              <RecommendationCard recommendation={latestRecommendation} decisionInsight={decisionInsight} />
            </div>
            <div className="xl:col-span-2">
              {latestProforma && (
                <div className="elevated-card p-6">
                  <h3 className="section-title mb-4">Key Metrics (Base Scenario)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="metric-card">
                      <p className="stat-label mb-1.5">IRR (Base)</p>
                      <p className="stat-value text-brand-700">{(latestProforma.irr * 100).toFixed(1)}%</p>
                    </div>
                    <div className="metric-card">
                      <p className="stat-label mb-1.5">NPV</p>
                      <p className="stat-value text-brand-700">{(latestProforma.npv / 1e7).toFixed(1)} Cr</p>
                    </div>
                    <div className="metric-card">
                      <p className="stat-label mb-1.5">Equity Multiple</p>
                      <p className="stat-value text-brand-700">{latestProforma.equityMultiple.toFixed(2)}x</p>
                    </div>
                    <div className="metric-card">
                      <p className="stat-label mb-1.5">Payback</p>
                      <p className="stat-value text-brand-700">{latestProforma.paybackYear} yr</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Strip */}
          <MetricsStrip proforma={latestProforma} />

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="elevated-card p-6">
              <RevenueChart years={latestProforma?.years ?? []} />
            </div>
            <div className="elevated-card p-6">
              <MCHistogramChart
                distribution={latestMC?.histogram?.map((h: any) => ({
                  bin: ((h.bucketMin + h.bucketMax) / 2),
                  count: h.count,
                }))}
                p10={latestMC?.irrDistribution?.p10}
                p50={latestMC?.irrDistribution?.p50}
                p90={latestMC?.irrDistribution?.p90}
                pNegativeNPV={latestMC?.probNpvNegative}
                pIRRLessWACC={latestMC?.probIrrBelowWacc}
              />
            </div>
          </div>

          {/* More Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="elevated-card p-6">
              <SCurveChart
                data={latestSCurve?.cumulativeCashflows
                  ? latestSCurve.cumulativeCashflows.map((cum: number, i: number) => ({
                      month: i + 1,
                      planned: cum,
                      actual: cum,
                    }))
                  : latestSCurve?.monthlyData?.map((d: any) => ({
                      month: d.month,
                      planned: d.cumulativePlanned,
                      actual: d.cumulativeActual ?? d.cumulativePlanned,
                    }))
                }
              />
            </div>
            <div className="elevated-card p-6">
              <FactorScorePanel
                globalScore={(latestFactor?.domainScores?.global?.score ?? latestFactor?.domains?.global?.score) != null ? (latestFactor?.domainScores?.global?.score ?? latestFactor?.domains?.global?.score)! * 20 : undefined}
                localScore={(latestFactor?.domainScores?.local?.score ?? latestFactor?.domains?.local?.score) != null ? (latestFactor?.domainScores?.local?.score ?? latestFactor?.domains?.local?.score)! * 20 : undefined}
                assetScore={(latestFactor?.domainScores?.asset?.score ?? latestFactor?.domains?.asset?.score) != null ? (latestFactor?.domainScores?.asset?.score ?? latestFactor?.domains?.asset?.score)! * 20 : undefined}
                sponsorScore={(latestFactor?.domainScores?.sponsor?.score ?? latestFactor?.domains?.sponsor?.score) != null ? (latestFactor?.domainScores?.sponsor?.score ?? latestFactor?.domains?.sponsor?.score)! * 20 : undefined}
                composite={latestFactor?.compositeScore != null ? latestFactor?.compositeScore * 20 : undefined}
                requiredReturn={latestFactor?.impliedDiscountRate}
                impliedDiscount={latestFactor?.impliedCapRate}
              />
            </div>
          </div>

          {/* 10-Year Cash Flow Table */}
          {latestProforma?.years && latestProforma.years.length > 0 && (
            <div className="elevated-card p-6">
              <CashFlowTable years={latestProforma.years} />
            </div>
          )}

          {/* Recommendation History + Alert Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="elevated-card p-6">
              <RecommendationHistory history={recommendationHistory} />
            </div>
            <div className="elevated-card p-6">
              <AlertFeed alerts={recentEvents?.map((e: any) => ({
                id: e.id,
                message: e.description,
                severity: e.severity ?? 'info',
                timestamp: e.timestamp,
                module: e.module,
              }))} />
            </div>
          </div>

          {/* Construction Progress */}
          {constructionProgress && (
            <div className="elevated-card p-6">
              <h3 className="section-title mb-4">Construction Progress</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="metric-card">
                  <p className="stat-label">Completion</p>
                  <p className="stat-value text-brand-700">{constructionProgress.completionPct?.toFixed(0) ?? 0}%</p>
                </div>
                <div className="metric-card">
                  <p className="stat-label">Budget Variance</p>
                  <p className={`stat-value ${(constructionProgress.variance ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {((constructionProgress.variance ?? 0) / 1e7).toFixed(1)} Cr
                  </p>
                </div>
                <div className="metric-card">
                  <p className="stat-label">Actual Spend</p>
                  <p className="stat-value text-blue-600">{((constructionProgress.actualSpend ?? 0) / 1e7).toFixed(1)} Cr</p>
                </div>
                <div className="metric-card">
                  <p className="stat-label">Approved COs</p>
                  <p className="stat-value text-amber-600">{((constructionProgress.approvedCOs ?? 0) / 1e7).toFixed(1)} Cr</p>
                </div>
              </div>
            </div>
          )}

          {/* Budget Alerts */}
          {budgetSummary?.alerts && budgetSummary.alerts.length > 0 && (
            <div className="elevated-card border-l-4 border-l-amber-400 p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <span>⚠️</span> Budget Alerts
                <span className="badge-warning ml-2">{budgetSummary.overallStatus}</span>
              </h3>
              <div className="space-y-2">
                {budgetSummary.alerts.map((alert: string, i: number) => (
                  <p key={i} className="text-sm text-amber-700 pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-amber-400">{alert}</p>
                ))}
              </div>
            </div>
          )}

          {/* Export & Reports */}
          <ExportPanel
            dealName={deal.name}
            deal={deal}
            latestProforma={latestProforma}
            latestRecommendation={latestRecommendation}
            latestMC={latestMC}
            latestFactor={latestFactor}
          />
        </div>
      )}

      {/* ────── UNDERWRITING TAB ────── */}
      {tab === 'underwriting' && (
        <div className="elevated-card p-6 animate-slide-up">
          <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
            <span className="text-base">📈</span> Scenario Analysis & Underwriting
          </h2>
          <ScenarioComparison dealId={dealId} />
        </div>
      )}

      {/* ────── CONSTRUCTION TAB ────── */}
      {tab === 'construction' && (
        <div className="elevated-card p-6 animate-slide-up">
          <ConstructionDashboard dealId={dealId} />
        </div>
      )}

      {/* ────── RISKS TAB ────── */}
      {tab === 'risks' && (
        <div className="elevated-card p-6 animate-slide-up">
          <RisksDashboard dealId={dealId} />
        </div>
      )}

      {/* ────── ASSUMPTIONS TAB ────── */}
      {tab === 'assumptions' && (
        <div className="elevated-card p-6 animate-slide-up">
          <AssumptionEditor dealId={dealId} />
        </div>
      )}

      {/* ────── FEASIBILITY TAB ────── */}
      {tab === 'feasibility' && (
        <div className="animate-slide-up">
          <FeasibilityWorkbench dealId={dealId} />
        </div>
      )}

      {/* ────── MARKET INTEL TAB ────── */}
      {tab === 'market-intel' && (
        <div className="animate-slide-up">
          <MarketIntelligenceTab city={(property as any)?.location?.city} state={(property as any)?.location?.state} />
        </div>
      )}

      {/* ────── SENSITIVITY (WHAT-IF) TAB ────── */}
      {tab === 'sensitivity' && (
        <div className="elevated-card p-6 animate-slide-up">
          <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
            <span className="text-base">🔬</span> Sensitivity Analysis & What-If Scenarios
          </h2>
          <SensitivityAnalysis
            baseIRR={latestProforma?.irr ?? 0.15}
            baseNPV={latestProforma?.npv ?? 100000000}
            baseEM={latestProforma?.equityMultiple ?? 2.0}
            baseDSCR={(latestProforma as any)?.avgDSCR ?? 1.3}
            baseADRGrowth={(marketAssumptions as any)?.adrGrowthRate ?? 0.05}
            baseOccupancy={(marketAssumptions as any)?.occupancyRamp?.[4] ?? 0.72}
            baseExitCapRate={(financialAssumptions as any)?.exitCapRate ?? 0.08}
            baseWACC={(financialAssumptions as any)?.wacc ?? 0.12}
            targetIRR={(financialAssumptions as any)?.targetIRR ?? 0.15}
            targetDSCR={(financialAssumptions as any)?.targetDSCR ?? 1.2}
          />
        </div>
      )}

      {/* ────── REVALUATION TAB ────── */}
      {tab === 'revaluation' && (
        <div className="elevated-card p-6 animate-slide-up">
          <RevaluationPanel
            dealId={dealId}
            currentMonth={deal.currentMonth}
            lifecyclePhase={deal.lifecyclePhase}
            recommendationHistory={recommendationHistory}
            latestRecommendation={latestRecommendation}
          />
        </div>
      )}

      {/* ────── AUDIT TRAIL TAB ────── */}
      {tab === 'audit' && (
        <div className="elevated-card p-6 animate-slide-up">
          <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
            <span className="text-base">📋</span> Audit Trail & Activity Log
          </h2>
          {recentEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-surface-400">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((entry: any) => (
                <div key={entry.id} className="flex items-start justify-between p-4 rounded-xl bg-surface-50/50 border border-surface-200/60 hover:bg-surface-50 hover:border-surface-300/60 transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs">📝</span>
                    </div>
                    <div>
                      <p className="font-medium text-surface-900 text-sm">{entry.type}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{entry.description}</p>
                    </div>
                  </div>
                  <span className="text-2xs text-surface-400 flex-shrink-0 ml-4 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
