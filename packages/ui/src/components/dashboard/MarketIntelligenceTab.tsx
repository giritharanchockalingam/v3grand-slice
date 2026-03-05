// ─── Market Intelligence Tab ────────────────────────────────────────
// Shows live macro indicators, city demand profile, and data freshness.
// Every metric from the most accurate source of truth for the investment's geography.
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { TabGlobeIcon } from '../icons/PortalIcons';

interface IndicatorMeta {
  value: number;
  asOfDate: string;
  source: string;
  sourceType: 'live-api' | 'official' | 'fallback';
}

interface MacroIndicators {
  repoRate: number;
  cpi: number;
  gdpGrowthRate: number;
  bondYield10Y: number;
  hotelSupplyGrowthPct: number;
  usdInrRate: number;
  inflationTrend: 'rising' | 'stable' | 'falling';
  source: 'live' | 'cached' | 'fallback';
  fetchedAt: string;
  indicators?: {
    repoRate: IndicatorMeta;
    cpi: IndicatorMeta;
    gdpGrowth: IndicatorMeta;
    bondYield10Y: IndicatorMeta;
    usdInr: IndicatorMeta;
    hotelSupplyGrowth: IndicatorMeta;
  };
}

interface CityProfile {
  city: string;
  state: string;
  airportPassengers: number;
  airportGrowthPct: number;
  touristArrivals: {
    domestic: number;
    foreign: number;
    growthPct: number;
  };
  housingPriceIndex: number;
  housingGrowthPct: number;
  demandOutlook: 'strong' | 'moderate' | 'weak';
  fetchedAt: string;
  source: string;
}

interface DemandSignals {
  touristGrowthPct: number;
  airTrafficGrowthPct: number;
  gdpGrowthPct: number;
  compositeScore: number;
}

interface HealthStatus {
  rbi: string;
  worldBank: string;
  fred: string;
  dataGovIn: string;
  forex: string;
  cacheHitRate: number;
  lastCheck: string;
}

const TREND_ICON = { rising: '↑', stable: '→', falling: '↓' } as const;
const TREND_COLOR = { rising: 'text-red-500', stable: 'text-amber-500', falling: 'text-emerald-500' } as const;

const SOURCE_BADGE = {
  live: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Live' },
  cached: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Cached' },
  fallback: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Fallback' },
} as const;

const SOURCE_TYPE_STYLE = {
  'live-api': { dot: 'bg-emerald-400', label: 'Live API' },
  'official': { dot: 'bg-blue-400', label: 'Official' },
  'fallback': { dot: 'bg-amber-400', label: 'Fallback' },
} as const;

const OUTLOOK_STYLE = {
  strong: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: '🟢' },
  moderate: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '🟡' },
  weak: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '🔴' },
} as const;

function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_BADGE[source as keyof typeof SOURCE_BADGE] ?? SOURCE_BADGE.fallback;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatLargeNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function pct(v: number, decimals = 1): string {
  return (v * 100).toFixed(decimals) + '%';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Status indicator for each data source ──
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    offline: 'bg-red-400',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-gray-300'}`} />
  );
}

// ── Individual indicator card with as-of date and source ──
function IndicatorCard({
  label, value, color, meta, suffix,
}: {
  label: string;
  value: string;
  color: string;
  meta?: IndicatorMeta;
  suffix?: React.ReactNode;
}) {
  const st = meta ? SOURCE_TYPE_STYLE[meta.sourceType] ?? SOURCE_TYPE_STYLE.fallback : null;
  return (
    <div className="metric-card group relative">
      <p className="stat-label mb-1">
        {label}
        {suffix}
      </p>
      <p className={`stat-value ${color}`}>{value}</p>
      {meta && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-2xs text-surface-400 truncate" title={meta.source}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${st?.dot} mr-1`} />
            {meta.source}
          </p>
          <p className="text-2xs text-surface-400">
            As of {meta.asOfDate}
          </p>
        </div>
      )}
    </div>
  );
}

export function MarketIntelligenceTab({ city, state }: { city?: string; state?: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch macro indicators ──
  const { data: macroResp, isLoading: macroLoading } = useQuery({
    queryKey: ['market', 'macro'],
    queryFn: () => api.get('/market/macro') as Promise<{ ok: boolean; data: MacroIndicators }>,
    staleTime: 300_000, // 5 min
  });

  // ── Fetch city profile ──
  const { data: cityResp, isLoading: cityLoading } = useQuery({
    queryKey: ['market', 'city', city],
    queryFn: () => api.get(`/market/city/${city}`) as Promise<{ ok: boolean; data: CityProfile }>,
    enabled: !!city,
    staleTime: 300_000,
  });

  // ── Fetch demand signals ──
  const { data: demandResp } = useQuery({
    queryKey: ['market', 'demand', city],
    queryFn: () => api.get(`/market/demand/${city}`) as Promise<{ ok: boolean; data: DemandSignals }>,
    enabled: !!city,
    staleTime: 300_000,
  });

  // ── Fetch health status ──
  const { data: healthResp } = useQuery({
    queryKey: ['market', 'health'],
    queryFn: () => api.get('/market/health') as Promise<{ ok: boolean; sources: HealthStatus }>,
    staleTime: 60_000,
  });

  // ── Refresh mutation ──
  const refreshMut = useMutation({
    mutationFn: () => api.post('/market/refresh', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market'] });
      setRefreshing(false);
    },
    onError: () => setRefreshing(false),
  });

  const macro = macroResp?.data;
  const cityProfile = cityResp?.data;
  const demand = demandResp?.data;
  const health = healthResp?.sources;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <TabGlobeIcon className="w-5 h-5 text-brand-500" />
            Market Intelligence
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Every metric from the most accurate source of truth for the investment&apos;s geography (India macro; city-level for deal location). Used in Factor engine and recommendation.
          </p>
          <p className="text-2xs text-surface-400 mt-0.5">
            Sources: RBI, MOSPI, World Bank, FRED, data.gov.in
          </p>
        </div>
        <button
          onClick={() => { setRefreshing(true); refreshMut.mutate(); }}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-200 bg-white text-surface-700 hover:bg-surface-50 transition-all"
        >
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* ══════════════ MACRO INDICATORS CARD ══════════════ */}
        <div className="elevated-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">India Macro Indicators</h3>
            {macro && <SourceBadge source={macro.source} />}
          </div>
          <p className="text-2xs text-surface-400 mb-3">
            Risk-free rate, inflation, growth, FX and sector supply — as used in underwriting and Factor engine.
          </p>

        {macroLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="metric-card"><div className="shimmer h-4 w-20 mb-2" /><div className="shimmer h-6 w-14" /></div>
            ))}
          </div>
        ) : macro ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <IndicatorCard
              label="RBI Repo Rate"
              value={pct(macro.repoRate)}
              color="text-brand-700"
              meta={macro.indicators?.repoRate}
            />
            <IndicatorCard
              label="CPI Inflation"
              value={pct(macro.cpi)}
              color="text-brand-700"
              meta={macro.indicators?.cpi}
              suffix={
                <span className={`ml-1 ${TREND_COLOR[macro.inflationTrend]}`}>
                  {TREND_ICON[macro.inflationTrend]}
                </span>
              }
            />
            <IndicatorCard
              label="GDP Growth"
              value={pct(macro.gdpGrowthRate)}
              color="text-emerald-700"
              meta={macro.indicators?.gdpGrowth}
            />
            <IndicatorCard
              label="10Y Bond Yield"
              value={pct(macro.bondYield10Y)}
              color="text-brand-700"
              meta={macro.indicators?.bondYield10Y}
            />
            <IndicatorCard
              label="USD/INR"
              value={`₹${macro.usdInrRate.toFixed(2)}`}
              color="text-blue-700"
              meta={macro.indicators?.usdInr}
            />
            <IndicatorCard
              label="Hotel Supply Growth"
              value={pct(macro.hotelSupplyGrowthPct)}
              color="text-amber-700"
              meta={macro.indicators?.hotelSupplyGrowth}
            />
          </div>
        ) : (
          <p className="text-sm text-surface-400 italic">Unable to fetch macro data. Check API connectivity.</p>
        )}

        {macro?.fetchedAt && (
          <p className="text-2xs text-surface-400 mt-3">
            Last updated: {timeAgo(macro.fetchedAt)}
          </p>
        )}
      </div>

      {/* ══════════════ CITY DEMAND PROFILE CARD ══════════════ */}
      {city && (
        <div className="elevated-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">
              City Demand Profile — {cityProfile?.city ?? city}
              {(cityProfile?.state ?? state) && (
                <span className="font-normal text-surface-400 ml-1">
                  ({cityProfile?.state ?? state})
                </span>
              )}
            </h3>
            {cityProfile && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${OUTLOOK_STYLE[cityProfile.demandOutlook].bg} ${OUTLOOK_STYLE[cityProfile.demandOutlook].text}`}>
                  {OUTLOOK_STYLE[cityProfile.demandOutlook].icon}
                  {cityProfile.demandOutlook.charAt(0).toUpperCase() + cityProfile.demandOutlook.slice(1)} Demand
                </span>
                <SourceBadge source={cityProfile.source} />
              </div>
            )}
          </div>

          {cityLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="metric-card"><div className="shimmer h-4 w-24 mb-2" /><div className="shimmer h-6 w-16" /></div>
              ))}
            </div>
          ) : cityProfile ? (
            <>
              <p className="text-2xs text-surface-400 mb-3">
                City-level data from deal location. Sources: AAI/data.gov.in (airport), Ministry of Tourism (tourists), RBI HPI (housing).
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="metric-card">
                  <p className="stat-label mb-1">Airport Passengers</p>
                  <p className="stat-value text-blue-700">{formatLargeNumber(cityProfile.airportPassengers)}</p>
                  <p className="text-2xs text-surface-400 mt-0.5">
                    YoY: <span className="text-emerald-600 font-medium">+{pct(cityProfile.airportGrowthPct)}</span>
                  </p>
                </div>
                <div className="metric-card">
                  <p className="stat-label mb-1">Domestic Tourists</p>
                  <p className="stat-value text-brand-700">{formatLargeNumber(cityProfile.touristArrivals.domestic)}</p>
                  <p className="text-2xs text-surface-400 mt-0.5">
                    YoY: <span className="text-emerald-600 font-medium">+{pct(cityProfile.touristArrivals.growthPct)}</span>
                  </p>
                </div>
                <div className="metric-card">
                  <p className="stat-label mb-1">Foreign Tourists</p>
                  <p className="stat-value text-violet-700">{formatLargeNumber(cityProfile.touristArrivals.foreign)}</p>
                </div>
                <div className="metric-card">
                  <p className="stat-label mb-1">Housing Price Index</p>
                  <p className="stat-value text-amber-700">{cityProfile.housingPriceIndex}</p>
                  <p className="text-2xs text-surface-400 mt-0.5">
                    YoY: <span className="text-emerald-600 font-medium">+{pct(cityProfile.housingGrowthPct)}</span>
                  </p>
                </div>
              </div>

              {/* Demand Score Gauge */}
              {demand && (
                <div className="rounded-xl bg-surface-50/50 border border-surface-200/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-700">Composite Demand Score</p>
                      <p className="text-2xs text-surface-400 mt-0.5">
                        Feeds Factor engine and recommendation (weights: Tourism 40%, Air traffic 30%, GDP 30%)
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand-700">{demand.compositeScore}/100</span>
                  </div>
                  <div className="w-full h-3 bg-surface-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-brand-500 to-brand-400"
                      style={{ width: `${Math.min(100, demand.compositeScore)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-2xs text-surface-400">Tourism Growth</p>
                      <p className="text-sm font-semibold text-surface-700">{pct(demand.touristGrowthPct)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-surface-400">Air Traffic Growth</p>
                      <p className="text-sm font-semibold text-surface-700">{pct(demand.airTrafficGrowthPct)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xs text-surface-400">GDP Growth</p>
                      <p className="text-sm font-semibold text-surface-700">{pct(demand.gdpGrowthPct)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-surface-400 italic">City data not available for "{city}".</p>
          )}
        </div>
      )}

      {/* ══════════════ DATA SOURCES HEALTH FOOTER ══════════════ */}
      {health && (
        <div className="elevated-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs font-semibold text-surface-600">Data Sources</p>
              <div className="flex items-center gap-3">
                {[
                  { label: 'RBI', status: health.rbi },
                  { label: 'World Bank', status: health.worldBank },
                  { label: 'FRED', status: health.fred },
                  { label: 'Forex', status: health.forex },
                  { label: 'data.gov.in', status: health.dataGovIn },
                ].map((s) => (
                  <span key={s.label} className="flex items-center gap-1 text-2xs text-surface-500">
                    <StatusDot status={s.status} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 text-2xs text-surface-400">
              <span>Cache hit rate: <strong className="text-surface-600">{(health.cacheHitRate * 100).toFixed(0)}%</strong></span>
              <span>Checked: {timeAgo(health.lastCheck)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
