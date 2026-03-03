// ─── Percentile Calculations ───────────────────────────────────────
// Utility for computing distribution statistics from an array of samples.

import type { PercentileSet } from '@v3grand/core';

/**
 * Compute comprehensive percentile statistics from an array of numbers.
 * Uses linear interpolation between data points.
 */
export function percentiles(values: number[]): PercentileSet {
  if (values.length === 0) {
    return { p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, mean: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    p5: pctile(sorted, 0.05),
    p10: pctile(sorted, 0.10),
    p25: pctile(sorted, 0.25),
    p50: pctile(sorted, 0.50),
    p75: pctile(sorted, 0.75),
    p90: pctile(sorted, 0.90),
    p95: pctile(sorted, 0.95),
    mean,
    stdDev,
  };
}

/**
 * Compute a single percentile using linear interpolation.
 * @param sorted - Pre-sorted array
 * @param p - Percentile as decimal (0-1)
 */
function pctile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];

  const rank = p * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;

  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Build histogram buckets from data.
 * @param values - Array of values
 * @param bucketCount - Number of buckets (default 50)
 */
export function buildHistogram(
  values: number[],
  bucketCount = 50
): { bucketMin: number; bucketMax: number; count: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const bucketWidth = range / bucketCount || 1;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    bucketMin: min + i * bucketWidth,
    bucketMax: min + (i + 1) * bucketWidth,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bucketWidth), bucketCount - 1);
    buckets[idx].count++;
  }

  return buckets;
}
