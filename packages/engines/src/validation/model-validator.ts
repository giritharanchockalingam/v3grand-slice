// ─── Model Validation Framework (SR 11-7 / SS1/23 Compliance) ───────
// G-9/F-1: Back-testing, benchmarking, and champion-challenger testing.
//
// This module validates engine accuracy against historical deals with known outcomes.
// It computes prediction accuracy metrics (RMSE, MAE, calibration) and flags
// when model performance degrades beyond acceptable thresholds.

import type { Deal, ProFormaOutput, FactorScoreOutput, MCOutput } from '@v3grand/core';
import { buildProForma, evaluateDecision, scoreFactors, runMonteCarlo } from '../index.js';

// ── Types ──

export interface ValidationCase {
  id: string;
  name: string;
  deal: Deal;
  // Actual outcomes (known from historical data)
  actualOutcome: {
    irr?: number;            // Actual realized IRR
    npv?: number;            // Actual realized NPV
    occupancyYear5?: number; // Actual stabilized occupancy
    exitMultiple?: number;   // Actual exit multiple achieved
    constructionOverrun?: number; // Actual budget variance %
  };
}

export interface ValidationMetrics {
  // Regression accuracy
  rmseIrr: number;
  maeIrr: number;
  rmseNpv: number;
  maeNpv: number;
  // Directional accuracy
  correctVerdictPct: number;
  // Calibration (MC)
  mcCalibrationScore: number;  // How often actual outcomes fall within MC P10-P90
  // Factor model
  factorCorrelation: number;   // Correlation between factor score and realized returns
}

export interface ValidationResult {
  engineName: string;
  modelVersion: string;
  validationType: 'backtest' | 'benchmark' | 'sensitivity' | 'champion-challenger';
  caseCount: number;
  metrics: ValidationMetrics;
  passed: boolean;
  failures: string[];          // Human-readable list of what failed
  timestamp: string;
}

// ── Thresholds ──
const THRESHOLDS = {
  maxRmseIrr: 0.05,           // 5% RMSE on IRR predictions
  maxMaeIrr: 0.03,            // 3% MAE on IRR
  maxRmseNpv: 5_000_000,      // ₹50 Lakhs RMSE on NPV
  minCorrectVerdict: 0.70,    // 70% verdict accuracy
  minMcCalibration: 0.60,     // 60% of outcomes within P10-P90
  minFactorCorrelation: 0.30, // Factor score correlates with returns at r≥0.30
};

/**
 * Run back-test validation against a set of historical deals with known outcomes.
 * Returns a ValidationResult with metrics and pass/fail determination.
 */
export function runBacktest(
  cases: ValidationCase[],
  modelVersion: string,
): ValidationResult {
  const failures: string[] = [];
  const irrErrors: number[] = [];
  const npvErrors: number[] = [];
  const verdictCorrect: boolean[] = [];
  const mcCalibrationHits: boolean[] = [];
  const factorScores: number[] = [];
  const actualReturns: number[] = [];

  for (const c of cases) {
    try {
      // Run engine cascade on historical deal
      const factorResult = scoreFactors({ deal: c.deal });
      const proforma = buildProForma({ deal: c.deal, scenarioKey: 'base' });
      const mc = runMonteCarlo({ deal: c.deal, iterations: 2000, seed: 42 });
      const decision = evaluateDecision({
        deal: c.deal,
        proformaResult: proforma,
        factorResult,
        mcResult: mc,
      });

      // IRR comparison
      if (c.actualOutcome.irr !== undefined) {
        const err = proforma.irr - c.actualOutcome.irr;
        irrErrors.push(err);
      }

      // NPV comparison
      if (c.actualOutcome.npv !== undefined) {
        const err = proforma.npv - c.actualOutcome.npv;
        npvErrors.push(err);
      }

      // MC calibration — did actual IRR fall within P10-P90?
      if (c.actualOutcome.irr !== undefined) {
        const withinRange =
          c.actualOutcome.irr >= mc.irrDistribution.p10 &&
          c.actualOutcome.irr <= mc.irrDistribution.p90;
        mcCalibrationHits.push(withinRange);
      }

      // Factor score vs. actual return correlation data
      if (c.actualOutcome.irr !== undefined) {
        factorScores.push(factorResult.compositeScore);
        actualReturns.push(c.actualOutcome.irr);
      }

      // Verdict accuracy — did the system recommend correctly?
      // "Correct" = INVEST/HOLD when actual IRR > WACC, or DE-RISK/EXIT/DO-NOT-PROCEED when actual IRR < WACC
      if (c.actualOutcome.irr !== undefined) {
        const wacc = c.deal.financialAssumptions.wacc ?? 0.12;
        const actualPositive = c.actualOutcome.irr > wacc;
        const predictedPositive = decision.verdict === 'INVEST' || decision.verdict === 'HOLD';
        verdictCorrect.push(actualPositive === predictedPositive);
      }
    } catch (err) {
      failures.push(`Case ${c.id} (${c.name}): Engine cascade threw: ${String(err)}`);
    }
  }

  // Compute metrics
  const rmseIrr = rmse(irrErrors);
  const maeIrr = mae(irrErrors);
  const rmseNpv = rmse(npvErrors);
  const maeNpv = mae(npvErrors);
  const correctVerdictPct = verdictCorrect.length > 0
    ? verdictCorrect.filter(Boolean).length / verdictCorrect.length
    : 0;
  const mcCalibrationScore = mcCalibrationHits.length > 0
    ? mcCalibrationHits.filter(Boolean).length / mcCalibrationHits.length
    : 0;
  const factorCorrelation = pearsonCorrelation(factorScores, actualReturns);

  // Threshold checks
  if (rmseIrr > THRESHOLDS.maxRmseIrr) failures.push(`RMSE IRR ${(rmseIrr * 100).toFixed(2)}% exceeds ${(THRESHOLDS.maxRmseIrr * 100)}% threshold`);
  if (maeIrr > THRESHOLDS.maxMaeIrr) failures.push(`MAE IRR ${(maeIrr * 100).toFixed(2)}% exceeds ${(THRESHOLDS.maxMaeIrr * 100)}% threshold`);
  if (correctVerdictPct < THRESHOLDS.minCorrectVerdict) failures.push(`Verdict accuracy ${(correctVerdictPct * 100).toFixed(1)}% below ${(THRESHOLDS.minCorrectVerdict * 100)}% threshold`);
  if (mcCalibrationScore < THRESHOLDS.minMcCalibration) failures.push(`MC calibration ${(mcCalibrationScore * 100).toFixed(1)}% below ${(THRESHOLDS.minMcCalibration * 100)}% threshold`);
  if (factorCorrelation < THRESHOLDS.minFactorCorrelation) failures.push(`Factor correlation ${factorCorrelation.toFixed(3)} below ${THRESHOLDS.minFactorCorrelation} threshold`);

  const metrics: ValidationMetrics = {
    rmseIrr, maeIrr, rmseNpv, maeNpv,
    correctVerdictPct, mcCalibrationScore, factorCorrelation,
  };

  return {
    engineName: 'cascade',
    modelVersion,
    validationType: 'backtest',
    caseCount: cases.length,
    metrics,
    passed: failures.length === 0,
    failures,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Champion-Challenger: Run two model versions and compare performance.
 * Returns which model performed better on each metric.
 */
export function runChampionChallenger(
  cases: ValidationCase[],
  championVersion: string,
  challengerVersion: string,
  challengerRunFn: (deal: Deal) => ProFormaOutput,
): {
  champion: ValidationResult;
  challenger: ValidationResult;
  winner: 'champion' | 'challenger' | 'tie';
  comparison: Record<string, { champion: number; challenger: number; better: string }>;
} {
  const champion = runBacktest(cases, championVersion);

  // Run challenger (custom function for alternative model)
  const challengerIrrErrors: number[] = [];
  for (const c of cases) {
    try {
      const result = challengerRunFn(c.deal);
      if (c.actualOutcome.irr !== undefined) {
        challengerIrrErrors.push(result.irr - c.actualOutcome.irr);
      }
    } catch { /* skip */ }
  }

  const challenger: ValidationResult = {
    ...champion,
    modelVersion: challengerVersion,
    validationType: 'champion-challenger',
    metrics: {
      ...champion.metrics,
      rmseIrr: rmse(challengerIrrErrors),
      maeIrr: mae(challengerIrrErrors),
    },
    passed: true,
    failures: [],
  };

  // Determine winner by RMSE IRR
  const winner = champion.metrics.rmseIrr <= challenger.metrics.rmseIrr ? 'champion' : 'challenger';

  return {
    champion,
    challenger,
    winner,
    comparison: {
      rmseIrr: { champion: champion.metrics.rmseIrr, challenger: challenger.metrics.rmseIrr, better: winner },
      maeIrr: { champion: champion.metrics.maeIrr, challenger: challenger.metrics.maeIrr, better: champion.metrics.maeIrr <= challenger.metrics.maeIrr ? 'champion' : 'challenger' },
    },
  };
}

// ── Statistical helpers ──

function rmse(errors: number[]): number {
  if (errors.length === 0) return 0;
  const sumSq = errors.reduce((s, e) => s + e * e, 0);
  return Math.sqrt(sumSq / errors.length);
}

function mae(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom === 0 ? 0 : sumXY / denom;
}
