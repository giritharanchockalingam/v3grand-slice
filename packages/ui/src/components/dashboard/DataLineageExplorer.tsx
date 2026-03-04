// ─── Data Lineage Explorer ──────────────────────────────────────────
// G-15/F-6: Click-through provenance from any metric to its inputs.
// Shows the full computation chain for any displayed metric.
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

// ── Types ──

interface EngineResultSummary {
  version: number;
  engineName: string;
  durationMs: number;
  triggeredBy: string;
  createdAt: string;
  contentHash?: string;
  previousHash?: string;
  modelVersion?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

interface LineageNode {
  engine: string;
  version: number;
  timestamp: string;
  modelVersion: string;
  hash: string;
  chainValid: boolean;
  durationMs: number;
  triggeredBy: string;
  inputs: Record<string, unknown>;
  keyOutputs: Record<string, unknown>;
}

interface DataQuality {
  overall: number;
  grade: string;
  freshness: number;
  reliability: number;
  completeness: number;
  consistency: number;
  warnings: string[];
}

// ── Severity colors ──
const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  B: 'bg-blue-100 text-blue-800 border-blue-300',
  C: 'bg-amber-100 text-amber-800 border-amber-300',
  D: 'bg-orange-100 text-orange-800 border-orange-300',
  F: 'bg-red-100 text-red-800 border-red-300',
};

const CHAIN_STATUS = {
  valid: { dot: 'bg-emerald-400', label: 'Chain Intact', color: 'text-emerald-700' },
  broken: { dot: 'bg-red-400', label: 'Chain Broken!', color: 'text-red-700' },
  unknown: { dot: 'bg-gray-300', label: 'No Hash', color: 'text-gray-500' },
};

export function DataLineageExplorer({ dealId }: { dealId: string }) {
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);
  const engines = ['factor', 'underwriter', 'montecarlo', 'budget', 'scurve', 'decision'];

  // Fetch latest result for each engine
  const { data: lineageData, isLoading } = useQuery({
    queryKey: ['lineage', dealId],
    queryFn: async () => {
      const results: Record<string, EngineResultSummary[]> = {};
      for (const engine of engines) {
        try {
          const resp = await api.get(`/deals/${dealId}/engines/${engine}/history?limit=5`) as any;
          results[engine] = resp.results ?? [];
        } catch { results[engine] = []; }
      }
      return results;
    },
    staleTime: 60_000,
  });

  // Fetch data quality score
  const { data: qualityResp } = useQuery({
    queryKey: ['data-quality', dealId],
    queryFn: () => api.get('/market/quality') as Promise<{ ok: boolean; quality: DataQuality }>,
    staleTime: 300_000,
  });
  const quality = qualityResp?.quality;

  if (isLoading) {
    return (
      <div className="elevated-card p-6">
        <div className="shimmer h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-16 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Data Quality Score Card ── */}
      {quality && (
        <div className="elevated-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Data Quality Score</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${GRADE_COLORS[quality.grade] ?? GRADE_COLORS.F}`}>
              Grade {quality.grade} — {quality.overall}/100
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <QualityBar label="Freshness" value={quality.freshness} />
            <QualityBar label="Reliability" value={quality.reliability} />
            <QualityBar label="Completeness" value={quality.completeness} />
            <QualityBar label="Consistency" value={quality.consistency} />
          </div>

          {quality.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {quality.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Engine Computation Chain ── */}
      <div className="elevated-card p-6">
        <h3 className="section-title mb-4">Engine Computation Chain</h3>
        <p className="text-xs text-surface-500 mb-4">
          Click any engine to inspect its inputs, outputs, and hash chain integrity.
          The hash chain provides tamper-evidence — if any historical result is modified, the chain breaks.
        </p>

        <div className="space-y-2">
          {engines.map((engine, idx) => {
            const results = lineageData?.[engine] ?? [];
            const latest = results[0];
            const isExpanded = expandedEngine === engine;

            return (
              <div key={engine}>
                {/* Chain connector */}
                {idx > 0 && (
                  <div className="flex items-center ml-6 -my-1">
                    <div className="w-0.5 h-4 bg-surface-200" />
                    <span className="text-2xs text-surface-400 ml-2">feeds into</span>
                  </div>
                )}

                {/* Engine node */}
                <button
                  onClick={() => setExpandedEngine(isExpanded ? null : engine)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isExpanded
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        latest ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-800 capitalize">{engine}</p>
                        {latest && (
                          <p className="text-2xs text-surface-400">
                            v{latest.version} • {latest.durationMs}ms • {latest.triggeredBy}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {latest?.modelVersion && (
                        <span className="text-2xs bg-surface-100 text-surface-600 px-2 py-0.5 rounded">
                          model {latest.modelVersion}
                        </span>
                      )}
                      {latest?.contentHash && (
                        <HashBadge
                          contentHash={latest.contentHash}
                          previousHash={latest.previousHash}
                          results={results}
                        />
                      )}
                      <svg className={`w-4 h-4 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && latest && (
                  <div className="ml-11 mt-2 p-3 rounded-lg bg-surface-50 border border-surface-200 text-xs space-y-3">
                    <div>
                      <p className="font-semibold text-surface-700 mb-1">Key Inputs</p>
                      <pre className="text-2xs text-surface-500 overflow-x-auto max-h-24">
                        {JSON.stringify(latest.input, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-semibold text-surface-700 mb-1">Key Outputs</p>
                      <pre className="text-2xs text-surface-500 overflow-x-auto max-h-32">
                        {JSON.stringify(summarizeOutput(engine, latest.output), null, 2)}
                      </pre>
                    </div>
                    {latest.contentHash && (
                      <div>
                        <p className="font-semibold text-surface-700 mb-1">Hash Chain</p>
                        <p className="text-2xs text-surface-400 font-mono break-all">
                          Content: {latest.contentHash}
                        </p>
                        <p className="text-2xs text-surface-400 font-mono break-all">
                          Previous: {latest.previousHash ?? 'genesis'}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 text-2xs">
                      <span className="text-surface-400">Computed at: {new Date(latest.createdAt).toLocaleString()}</span>
                      <span className="text-surface-400">Duration: {latest.durationMs}ms</span>
                    </div>

                    {/* Version history */}
                    {results.length > 1 && (
                      <div>
                        <p className="font-semibold text-surface-700 mb-1">Recent Versions</p>
                        <div className="space-y-1">
                          {results.slice(1, 5).map((r, i) => (
                            <p key={i} className="text-2xs text-surface-400">
                              v{r.version} — {new Date(r.createdAt).toLocaleString()} — {r.triggeredBy}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function QualityBar({ label, value }: { label: string; value: number }) {
  const barColor = value >= 70 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-surface-500">{label}</span>
        <span className="text-2xs font-semibold text-surface-700">{value}</span>
      </div>
      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function HashBadge({
  contentHash,
  previousHash,
  results,
}: {
  contentHash?: string;
  previousHash?: string;
  results: EngineResultSummary[];
}) {
  if (!contentHash || contentHash === 'genesis') {
    const s = CHAIN_STATUS.unknown;
    return (
      <span className={`inline-flex items-center gap-1 text-2xs ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  }

  // Simple check: does the chain link correctly?
  const valid = results.length < 2 || (results[1]?.contentHash === previousHash);
  const s = valid ? CHAIN_STATUS.valid : CHAIN_STATUS.broken;
  return (
    <span className={`inline-flex items-center gap-1 text-2xs ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Extract key outputs for display (avoid overwhelming the UI with full output) */
function summarizeOutput(engine: string, output: Record<string, unknown>): Record<string, unknown> {
  switch (engine) {
    case 'factor':
      return { compositeScore: output.compositeScore, impliedDiscountRate: output.impliedDiscountRate };
    case 'underwriter':
      return { irr: output.irr, npv: output.npv, equityMultiple: output.equityMultiple, avgDSCR: output.avgDSCR };
    case 'montecarlo':
      return {
        irrP50: (output.irrDistribution as any)?.p50,
        probNpvNegative: output.probNpvNegative,
        iterations: output.iterations,
      };
    case 'decision':
      return { verdict: output.verdict, confidence: output.confidence, passRate: output.passRate };
    case 'budget':
      return { overallStatus: output.overallStatus, varianceToCurrent: output.varianceToCurrent };
    case 'scurve':
      return { totalAmount: output.totalAmount };
    default:
      return output;
  }
}
