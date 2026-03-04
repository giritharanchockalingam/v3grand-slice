// ─── Monte Carlo Engine: IRR/NPV Distribution Simulation ──────────
// Pure function: (MCInput) => MCOutput
// Runs N iterations of perturbed Underwriter scenarios,
// collects IRR/NPV distributions, and computes risk metrics.

import type { MCInput, MCOutput, Deal } from '@v3grand/core';
import { buildProForma } from '../underwriter/index.js';
import { triangular, logNormal, createSeededRng, clamp } from '../_shared/distributions.js';
import { percentiles, buildHistogram } from '../_shared/percentile.js';

export function runMonteCarlo(input: MCInput): MCOutput {
  const { deal, iterations = 5000, seed } = input;
  const rng = seed != null ? createSeededRng(seed) : Math.random;

  const baseScenario = deal.scenarios.base;
  if (!baseScenario) throw new Error('Base scenario required for Monte Carlo');

  const irrs: number[] = [];
  const npvs: number[] = [];
  let phase2TriggerCount = 0;

  // Track perturbation samples for sensitivity analysis
  const samples: {
    occStab: number;
    adrStab: number;
    exitMult: number;
    ebitdaAdj: number;
    irr: number;
  }[] = [];

  for (let i = 0; i < iterations; i++) {
    // 1. Sample perturbed assumptions
    const occStab = clamp(
      triangular(0.55, baseScenario.occupancyStabilized, 0.90, rng),
      0.30, 0.95
    );
    const adrStab = logNormal(baseScenario.adrStabilized, 0.10, rng);
    const exitMult = triangular(
      deal.financialAssumptions.exitMultiple * 0.7,
      deal.financialAssumptions.exitMultiple,
      deal.financialAssumptions.exitMultiple * 1.4,
      rng
    );
    const ebitdaMarginAdj = triangular(0.28, baseScenario.ebitdaMargin, 0.50, rng);
    const phase2Trigger = occStab > 0.70 && rng() < 0.75;

    if (phase2Trigger) phase2TriggerCount++;

    // 2. Create perturbed deal with _mc scenario
    const mcScenario = {
      id: '_mc',
      name: 'base' as const,
      probability: 1,
      occupancyStabilized: occStab,
      adrStabilized: Math.round(adrStab),
      ebitdaMargin: ebitdaMarginAdj,
      mouRealizationPct: baseScenario.mouRealizationPct,
      phase2Trigger,
    };

    const perturbedDeal: Deal = {
      ...deal,
      financialAssumptions: {
        ...deal.financialAssumptions,
        exitMultiple: exitMult,
      },
      scenarios: {
        ...deal.scenarios,
        _mc: mcScenario,
      },
    };

    try {
      // 3. Run underwriter with perturbed scenario
      const result = buildProForma({
        deal: perturbedDeal,
        scenarioKey: '_mc' as any,
      });

      // 4. Collect results
      const irr = result.irr;
      const npv = result.npv;

      if (Number.isFinite(irr) && Number.isFinite(npv)) {
        irrs.push(irr);
        npvs.push(npv);
        samples.push({ occStab, adrStab, exitMult, ebitdaAdj: ebitdaMarginAdj, irr });
      }
    } catch {
      // Skip failed iterations (extreme values can cause NaN)
      continue;
    }
  }

  // ── Compute statistics ──
  const validIterations = irrs.length;
  if (validIterations === 0) {
    throw new Error('Monte Carlo: No valid iterations completed');
  }

  const irrDistribution = percentiles(irrs);
  const npvDistribution = percentiles(npvs);

  const probNpvNegative = npvs.filter(n => n < 0).length / validIterations;
  const probIrrBelowWacc = irrs.filter(r => r < deal.financialAssumptions.wacc).length / validIterations;
  const probPhase2Trigger = phase2TriggerCount / iterations;

  // ── Sensitivity ranking via simple correlation ──
  const sensitivityRanking = computeSensitivity(samples);

  // ── Histogram ──
  const histogram = buildHistogram(irrs, 50);

  return {
    iterations: validIterations,
    irrDistribution,
    npvDistribution,
    probNpvNegative: round4(probNpvNegative),
    probIrrBelowWacc: round4(probIrrBelowWacc),
    probPhase2Trigger: round4(probPhase2Trigger),
    sensitivityRanking,
    histogram,
  };
}

/**
 * Compute sensitivity ranking via Pearson correlation between
 * each input parameter and the output IRR.
 */
function computeSensitivity(
  samples: { occStab: number; adrStab: number; exitMult: number; ebitdaAdj: number; irr: number }[]
): { parameter: string; correlation: number }[] {
  if (samples.length < 10) return [];

  const params: { parameter: string; values: number[] }[] = [
    { parameter: 'Stabilized Occupancy', values: samples.map(s => s.occStab) },
    { parameter: 'Stabilized ADR', values: samples.map(s => s.adrStab) },
    { parameter: 'Exit Multiple', values: samples.map(s => s.exitMult) },
    { parameter: 'EBITDA Margin', values: samples.map(s => s.ebitdaAdj) },
  ];

  const irrs = samples.map(s => s.irr);

  return params
    .map(({ parameter, values }) => ({
      parameter,
      correlation: round4(pearsonCorrelation(values, irrs)),
    }))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/**
 * Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom > 0 ? sumXY / denom : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
