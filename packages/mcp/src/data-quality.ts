// ─── Data Quality & Confidence Scoring ──────────────────────────────
// G-16/F-9: Aggregate confidence metric for market data quality.
//
// Weighs:
//   1. Freshness — how recently each indicator was updated (exponential decay)
//   2. Source reliability — live-api > official > fallback
//   3. Completeness — what fraction of indicators have data at all
//   4. Consistency — are indicators internally consistent (e.g., high CPI + low repo rate = warning)

import type { IndicatorMeta } from './types.js';

export interface DataQualityScore {
  overall: number;           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  freshness: number;         // 0-100
  reliability: number;       // 0-100
  completeness: number;      // 0-100
  consistency: number;       // 0-100
  warnings: string[];
}

// ── Weight configuration ──
const WEIGHTS = {
  freshness: 0.35,
  reliability: 0.30,
  completeness: 0.20,
  consistency: 0.15,
};

// ── Source reliability scores ──
const SOURCE_RELIABILITY: Record<string, number> = {
  'live-api': 100,
  'official': 85,
  'fallback': 30,
};

// ── Freshness decay (days → score) ──
// Score = 100 * exp(-decay * days)
const FRESHNESS_DECAY: Record<string, number> = {
  usdInr: 0.5,          // Forex stale after 2 days
  cpi: 0.02,            // CPI okay for 30+ days
  repoRate: 0.01,       // Repo rate okay for 60+ days (changes 6x/year)
  gdpGrowth: 0.005,     // GDP okay for 180+ days (annual)
  bondYield10Y: 0.3,    // Bond yield stale after 3 days
  hotelSupplyGrowth: 0.003, // Industry estimate okay for 300+ days
};

/**
 * Compute aggregate data quality score from indicator metadata.
 */
export function computeDataQualityScore(
  indicators: Partial<Record<string, IndicatorMeta>>,
  referenceDate?: Date,
): DataQualityScore {
  const now = referenceDate ?? new Date();
  const warnings: string[] = [];
  const allIndicators = ['repoRate', 'cpi', 'gdpGrowth', 'bondYield10Y', 'usdInr', 'hotelSupplyGrowth'];

  // ── Completeness ──
  const present = allIndicators.filter(k => indicators[k] !== undefined);
  const completeness = (present.length / allIndicators.length) * 100;
  if (completeness < 100) {
    const missing = allIndicators.filter(k => !indicators[k]);
    warnings.push(`Missing indicators: ${missing.join(', ')}`);
  }

  // ── Freshness ──
  let freshnessSum = 0;
  let freshnessCount = 0;
  for (const key of present) {
    const meta = indicators[key]!;
    const asOf = new Date(meta.asOfDate);
    const daysSince = Math.max(0, (now.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));
    const decay = FRESHNESS_DECAY[key] ?? 0.05;
    const freshScore = 100 * Math.exp(-decay * daysSince);
    freshnessSum += freshScore;
    freshnessCount++;

    if (freshScore < 30) {
      warnings.push(`${key} is stale (${Math.round(daysSince)} days old, score ${Math.round(freshScore)})`);
    }
  }
  const freshness = freshnessCount > 0 ? freshnessSum / freshnessCount : 0;

  // ── Reliability ──
  let reliabilitySum = 0;
  let reliabilityCount = 0;
  for (const key of present) {
    const meta = indicators[key]!;
    const score = SOURCE_RELIABILITY[meta.sourceType] ?? 30;
    reliabilitySum += score;
    reliabilityCount++;

    if (meta.sourceType === 'fallback') {
      warnings.push(`${key} using fallback data (source: ${meta.source})`);
    }
  }
  const reliability = reliabilityCount > 0 ? reliabilitySum / reliabilityCount : 0;

  // ── Consistency ──
  let consistency = 100;
  const cpi = indicators.cpi?.value;
  const repoRate = indicators.repoRate?.value;
  const bondYield = indicators.bondYield10Y?.value;

  // Check: CPI above 6% but repo rate below 5% would be unusual
  if (cpi !== undefined && repoRate !== undefined) {
    if (cpi > 0.06 && repoRate < 0.05) {
      consistency -= 20;
      warnings.push('Inconsistency: High CPI but low repo rate — verify data sources');
    }
  }

  // Check: Bond yield below repo rate would be unusual (inverted curve)
  if (bondYield !== undefined && repoRate !== undefined) {
    if (bondYield < repoRate) {
      consistency -= 15;
      warnings.push('Inverted yield curve detected: 10Y bond yield below repo rate');
    }
  }

  // ── Overall score ──
  const overall = Math.round(
    freshness * WEIGHTS.freshness +
    reliability * WEIGHTS.reliability +
    completeness * WEIGHTS.completeness +
    consistency * WEIGHTS.consistency
  );

  // ── Grade ──
  let grade: DataQualityScore['grade'];
  if (overall >= 85) grade = 'A';
  else if (overall >= 70) grade = 'B';
  else if (overall >= 55) grade = 'C';
  else if (overall >= 40) grade = 'D';
  else grade = 'F';

  return {
    overall,
    grade,
    freshness: Math.round(freshness),
    reliability: Math.round(reliability),
    completeness: Math.round(completeness),
    consistency: Math.round(consistency),
    warnings,
  };
}
