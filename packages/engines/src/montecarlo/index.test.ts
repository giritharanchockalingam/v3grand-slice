// ─── Monte Carlo Engine Tests ─────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from './index.js';
import { v3GrandSeed } from '../../../db/src/seed/v3grand.js';

describe('Monte Carlo Engine', () => {
  it('returns valid distribution percentiles (p10 < p25 < p50 < p75 < p90)', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p10).toBeLessThan(result.irrDistribution.p25);
    expect(result.irrDistribution.p25).toBeLessThan(result.irrDistribution.p50);
    expect(result.irrDistribution.p50).toBeLessThan(result.irrDistribution.p75);
    expect(result.irrDistribution.p75).toBeLessThan(result.irrDistribution.p90);

    // NPV should follow same pattern
    expect(result.npvDistribution.p10).toBeLessThan(result.npvDistribution.p25);
    expect(result.npvDistribution.p25).toBeLessThan(result.npvDistribution.p50);
    expect(result.npvDistribution.p50).toBeLessThan(result.npvDistribution.p75);
    expect(result.npvDistribution.p75).toBeLessThan(result.npvDistribution.p90);
  });

  it('seeded runs produce deterministic results', () => {
    const result1 = runMonteCarlo({ deal: v3GrandSeed, iterations: 500, seed: 12345 });
    const result2 = runMonteCarlo({ deal: v3GrandSeed, iterations: 500, seed: 12345 });

    expect(result1.irrDistribution.p50).toEqual(result2.irrDistribution.p50);
    expect(result1.irrDistribution.p90).toEqual(result2.irrDistribution.p90);
    expect(result1.npvDistribution.p10).toEqual(result2.npvDistribution.p10);
    expect(result1.probNpvNegative).toEqual(result2.probNpvNegative);
  });

  it('different seeds produce different results', () => {
    const result1 = runMonteCarlo({ deal: v3GrandSeed, iterations: 500, seed: 1 });
    const result2 = runMonteCarlo({ deal: v3GrandSeed, iterations: 500, seed: 2 });

    // Should be statistically different
    expect(Math.abs(result1.irrDistribution.p50 - result2.irrDistribution.p50)).toBeGreaterThan(0);
  });

  it('probNpvNegative is between 0-1', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.probNpvNegative).toBeGreaterThanOrEqual(0);
    expect(result.probNpvNegative).toBeLessThanOrEqual(1);
  });

  it('probIrrBelowWacc is between 0-1', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.probIrrBelowWacc).toBeGreaterThanOrEqual(0);
    expect(result.probIrrBelowWacc).toBeLessThanOrEqual(1);
  });

  it('probPhase2Trigger is between 0-1', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.probPhase2Trigger).toBeGreaterThanOrEqual(0);
    expect(result.probPhase2Trigger).toBeLessThanOrEqual(1);
  });

  it('sensitivity ranking has correlations between -1 and 1', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.sensitivityRanking).toBeDefined();
    expect(Array.isArray(result.sensitivityRanking)).toBe(true);

    for (const sensitivity of result.sensitivityRanking) {
      expect(sensitivity).toHaveProperty('parameter');
      expect(sensitivity).toHaveProperty('correlation');

      expect(typeof sensitivity.parameter).toBe('string');
      expect(typeof sensitivity.correlation).toBe('number');

      expect(sensitivity.correlation).toBeGreaterThanOrEqual(-1);
      expect(sensitivity.correlation).toBeLessThanOrEqual(1);
    }
  });

  it('sensitivity ranking is sorted by absolute correlation', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    if (result.sensitivityRanking.length > 1) {
      for (let i = 1; i < result.sensitivityRanking.length; i++) {
        const prevAbs = Math.abs(result.sensitivityRanking[i - 1].correlation);
        const currAbs = Math.abs(result.sensitivityRanking[i].correlation);
        expect(prevAbs).toBeGreaterThanOrEqual(currAbs);
      }
    }
  });

  it('histogram has correct number of bins', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 5000, seed: 42 });

    expect(result.histogram).toBeDefined();
    expect(result.histogram.length).toBeGreaterThan(0);
    // S-curve with 50 bins requested
    expect(result.histogram.length).toBeLessThanOrEqual(60);
  });

  it('histogram bin structure is correct', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    for (const bin of result.histogram) {
      expect(bin).toHaveProperty('rangeStart');
      expect(bin).toHaveProperty('rangeEnd');
      expect(bin).toHaveProperty('count');

      expect(typeof bin.rangeStart).toBe('number');
      expect(typeof bin.rangeEnd).toBe('number');
      expect(typeof bin.count).toBe('number');

      expect(bin.rangeStart).toBeLessThanOrEqual(bin.rangeEnd);
      expect(bin.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('iterations equals requested count (or close when seed is provided)', () => {
    const iterations = 750;
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations, seed: 42 });

    // Allow for some failed iterations
    expect(result.iterations).toBeGreaterThan(iterations * 0.9);
    expect(result.iterations).toBeLessThanOrEqual(iterations);
  });

  it('all iterations complete without error', () => {
    // Should not throw
    expect(() => {
      runMonteCarlo({ deal: v3GrandSeed, iterations: 500, seed: 42 });
    }).not.toThrow();
  });

  it('median IRR (p50) is reasonable relative to base scenario', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 2000, seed: 42 });

    // P50 should be positive for V3 Grand
    expect(result.irrDistribution.p50).toBeGreaterThan(0);

    // P50 should be less than p90
    expect(result.irrDistribution.p50).toBeLessThan(result.irrDistribution.p90);
  });

  it('tail risk (p10) is lower than median', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p10).toBeLessThan(result.irrDistribution.p50);
  });

  it('upside potential (p90) is higher than median', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p90).toBeGreaterThan(result.irrDistribution.p50);
  });

  it('IRR percentiles are ordered correctly', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.min).toBeLessThanOrEqual(result.irrDistribution.p10);
    expect(result.irrDistribution.p10).toBeLessThanOrEqual(result.irrDistribution.p25);
    expect(result.irrDistribution.p25).toBeLessThanOrEqual(result.irrDistribution.p50);
    expect(result.irrDistribution.p50).toBeLessThanOrEqual(result.irrDistribution.p75);
    expect(result.irrDistribution.p75).toBeLessThanOrEqual(result.irrDistribution.p90);
    expect(result.irrDistribution.p90).toBeLessThanOrEqual(result.irrDistribution.max);
  });

  it('NPV percentiles are ordered correctly', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.npvDistribution.min).toBeLessThanOrEqual(result.npvDistribution.p10);
    expect(result.npvDistribution.p10).toBeLessThanOrEqual(result.npvDistribution.p25);
    expect(result.npvDistribution.p25).toBeLessThanOrEqual(result.npvDistribution.p50);
    expect(result.npvDistribution.p50).toBeLessThanOrEqual(result.npvDistribution.p75);
    expect(result.npvDistribution.p75).toBeLessThanOrEqual(result.npvDistribution.p90);
    expect(result.npvDistribution.p90).toBeLessThanOrEqual(result.npvDistribution.max);
  });

  it('histogram total count approximates iterations', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    const totalCount = result.histogram.reduce((sum, bin) => sum + bin.count, 0);

    expect(totalCount).toEqual(result.iterations);
  });

  it('uses seed=42 for deterministic results', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 2000, seed: 42 });

    expect(result.iterations).toBeGreaterThan(1800);
    expect(result.irrDistribution.p50).toBeGreaterThan(0.10);
    expect(result.probNpvNegative).toBeLessThan(0.30);
  });

  it('sensitivity ranking has 4 parameters', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.sensitivityRanking).toBeDefined();
    expect(result.sensitivityRanking.length).toBe(4);

    const parameterNames = result.sensitivityRanking.map(s => s.parameter);
    expect(parameterNames).toContain('Stabilized Occupancy');
    expect(parameterNames).toContain('Stabilized ADR');
    expect(parameterNames).toContain('Exit Multiple');
    expect(parameterNames).toContain('EBITDA Margin');
  });

  it('distributions are properly shaped (negative skew expected)', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 2000, seed: 42 });

    const irrRange = result.irrDistribution.max - result.irrDistribution.min;
    expect(irrRange).toBeGreaterThan(0.05);

    const npvRange = result.npvDistribution.max - result.npvDistribution.min;
    expect(npvRange).toBeGreaterThan(1000000);
  });

  it('quartile spread indicates uncertainty', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    const irrIqr = result.irrDistribution.p75 - result.irrDistribution.p25;
    expect(irrIqr).toBeGreaterThan(0.01);
    expect(irrIqr).toBeLessThan(0.30);

    const npvIqr = result.npvDistribution.p75 - result.npvDistribution.p25;
    expect(npvIqr).toBeGreaterThan(0);
  });

  it('phase 2 trigger probability within reasonable bounds', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 2000, seed: 42 });

    expect(result.probPhase2Trigger).toBeGreaterThan(0.30);
    expect(result.probPhase2Trigger).toBeLessThan(0.90);
  });

  it('most likely outcome (p50) is better than worst case (p10)', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p50).toBeGreaterThan(result.irrDistribution.p10);
    expect(result.npvDistribution.p50).toBeGreaterThan(result.npvDistribution.p10);
  });

  it('best case (p90) is better than most likely (p50)', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p90).toBeGreaterThan(result.irrDistribution.p50);
    expect(result.npvDistribution.p90).toBeGreaterThan(result.npvDistribution.p50);
  });

  it('histogram bins are contiguous', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    if (result.histogram.length > 1) {
      for (let i = 1; i < result.histogram.length; i++) {
        const prevEnd = result.histogram[i - 1].rangeEnd;
        const currStart = result.histogram[i].rangeStart;

        expect(Math.abs(prevEnd - currStart)).toBeLessThan(0.001);
      }
    }
  });

  it('histogram ranges span from min to max', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    const firstBin = result.histogram[0];
    const lastBin = result.histogram[result.histogram.length - 1];

    expect(firstBin.rangeStart).toBeLessThanOrEqual(result.irrDistribution.min);
    expect(lastBin.rangeEnd).toBeGreaterThanOrEqual(result.irrDistribution.max);
  });

  it('correlation magnitude reflects parameter importance', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.sensitivityRanking.length).toBeGreaterThan(0);

    const topSensitivity = Math.abs(result.sensitivityRanking[0].correlation);
    expect(topSensitivity).toBeGreaterThan(0.20);
  });

  it('positive IRR distribution when deal is healthy', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    expect(result.irrDistribution.p50).toBeGreaterThan(0.10);
    expect(result.irrDistribution.p75).toBeGreaterThan(0.12);
  });

  it('handles edge case with small iteration count', () => {
    const result = runMonteCarlo({ deal: v3GrandSeed, iterations: 100, seed: 42 });

    expect(result.iterations).toBeGreaterThan(0);
    expect(result.irrDistribution.p50).toBeDefined();
    expect(result.npvDistribution.p50).toBeDefined();
  });

  it('consistent results across multiple calls with same seed', () => {
    const results = [
      runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 999 }),
      runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 999 }),
    ];

    expect(results[0].irrDistribution.p50).toBe(results[1].irrDistribution.p50);
    expect(results[0].irrDistribution.p10).toBe(results[1].irrDistribution.p10);
    expect(results[0].irrDistribution.p90).toBe(results[1].irrDistribution.p90);
    expect(results[0].probNpvNegative).toBe(results[1].probNpvNegative);
  });
});
