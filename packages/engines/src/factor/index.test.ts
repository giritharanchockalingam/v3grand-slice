// ─── Factor Engine Tests ──────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { scoreFactors } from './index.js';
import { v3GrandSeed } from '../../../db/src/seed/v3grand.js';
import type { MacroIndicators } from '@v3grand/core';

describe('Factor Engine', () => {
  it('scoreFactors returns valid composite score (1-5)', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.compositeScore).toBeGreaterThanOrEqual(1);
    expect(result.compositeScore).toBeLessThanOrEqual(5);
  });

  it('composite score is weighted average of 4 domain scores', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.domainScores).toBeDefined();
    expect(result.domainScores.global).toBeDefined();
    expect(result.domainScores.local).toBeDefined();
    expect(result.domainScores.asset).toBeDefined();
    expect(result.domainScores.sponsor).toBeDefined();

    // Each domain score should be 1-5
    expect(result.domainScores.global.score).toBeGreaterThanOrEqual(1);
    expect(result.domainScores.global.score).toBeLessThanOrEqual(5);
    expect(result.domainScores.local.score).toBeGreaterThanOrEqual(1);
    expect(result.domainScores.local.score).toBeLessThanOrEqual(5);
    expect(result.domainScores.asset.score).toBeGreaterThanOrEqual(1);
    expect(result.domainScores.asset.score).toBeLessThanOrEqual(5);
    expect(result.domainScores.sponsor.score).toBeGreaterThanOrEqual(1);
    expect(result.domainScores.sponsor.score).toBeLessThanOrEqual(5);
  });

  it('each domain has correct weight', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.domainScores.global.weight).toBe(0.25);
    expect(result.domainScores.local.weight).toBe(0.25);
    expect(result.domainScores.asset.weight).toBe(0.30);
    expect(result.domainScores.sponsor.weight).toBe(0.20);
  });

  it('domain weights sum to 1.0', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const totalWeight =
      result.domainScores.global.weight +
      result.domainScores.local.weight +
      result.domainScores.asset.weight +
      result.domainScores.sponsor.weight;

    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001);
  });

  it('each domain contains multiple factors', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.domainScores.global.factors.length).toBeGreaterThan(0);
    expect(result.domainScores.local.factors.length).toBeGreaterThan(0);
    expect(result.domainScores.asset.factors.length).toBeGreaterThan(0);
    expect(result.domainScores.sponsor.factors.length).toBeGreaterThan(0);
  });

  it('implied discount rate is reasonable (5-20%)', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.impliedDiscountRate).toBeGreaterThanOrEqual(0.05);
    expect(result.impliedDiscountRate).toBeLessThanOrEqual(0.20);
  });

  it('higher composite score yields lower implied discount rate', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const expectedRate =
      v3GrandSeed.financialAssumptions.riskFreeRate +
      (5 - result.compositeScore) * 0.03;

    expect(result.impliedDiscountRate).toBeCloseTo(expectedRate, 4);
  });

  it('implied cap rate is between 4-6.5%', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    expect(result.impliedCapRate).toBeGreaterThanOrEqual(0.04);
    expect(result.impliedCapRate).toBeLessThanOrEqual(0.065);
  });

  describe('high interest rate environment', () => {
    it('reduces global domain score', () => {
      const highRatesMacro: MacroIndicators = {
        repoRate: 0.08,
        cpi: 0.04,
        gdpGrowthRate: 0.05,
        bondYield10Y: 0.10,
        hotelSupplyGrowthPct: 0.03,
      };

      const baseResult = scoreFactors({ deal: v3GrandSeed });
      const highRateResult = scoreFactors({
        deal: v3GrandSeed,
        macroIndicators: highRatesMacro,
      });

      expect(highRateResult.domainScores.global.score).toBeLessThan(
        baseResult.domainScores.global.score
      );
    });

    it('increases composite score when rates drop', () => {
      const lowRatesMacro: MacroIndicators = {
        repoRate: 0.035,
        cpi: 0.02,
        gdpGrowthRate: 0.07,
        bondYield10Y: 0.055,
        hotelSupplyGrowthPct: 0.02,
      };

      const baseResult = scoreFactors({ deal: v3GrandSeed });
      const lowRateResult = scoreFactors({
        deal: v3GrandSeed,
        macroIndicators: lowRatesMacro,
      });

      expect(lowRateResult.compositeScore).toBeGreaterThan(
        baseResult.compositeScore
      );
    });

    it('increases implied discount rate with higher repo rate', () => {
      const highRatesMacro: MacroIndicators = {
        repoRate: 0.08,
        cpi: 0.04,
        gdpGrowthRate: 0.05,
        bondYield10Y: 0.10,
        hotelSupplyGrowthPct: 0.03,
      };

      const baseResult = scoreFactors({ deal: v3GrandSeed });
      const highRateResult = scoreFactors({
        deal: v3GrandSeed,
        macroIndicators: highRatesMacro,
      });

      expect(highRateResult.impliedDiscountRate).toBeGreaterThan(
        baseResult.impliedDiscountRate
      );
    });
  });

  describe('low interest rate environment', () => {
    it('increases global domain score', () => {
      const lowRatesMacro: MacroIndicators = {
        repoRate: 0.035,
        cpi: 0.02,
        gdpGrowthRate: 0.07,
        bondYield10Y: 0.055,
        hotelSupplyGrowthPct: 0.02,
      };

      const baseResult = scoreFactors({ deal: v3GrandSeed });
      const lowRateResult = scoreFactors({
        deal: v3GrandSeed,
        macroIndicators: lowRatesMacro,
      });

      expect(lowRateResult.domainScores.global.score).toBeGreaterThan(
        baseResult.domainScores.global.score
      );
    });

    it('decreases implied discount rate with lower repo rate', () => {
      const lowRatesMacro: MacroIndicators = {
        repoRate: 0.035,
        cpi: 0.02,
        gdpGrowthRate: 0.07,
        bondYield10Y: 0.055,
        hotelSupplyGrowthPct: 0.02,
      };

      const baseResult = scoreFactors({ deal: v3GrandSeed });
      const lowRateResult = scoreFactors({
        deal: v3GrandSeed,
        macroIndicators: lowRatesMacro,
      });

      expect(lowRateResult.impliedDiscountRate).toBeLessThan(
        baseResult.impliedDiscountRate
      );
    });
  });

  it('uses default macro indicators when none provided', () => {
    const result1 = scoreFactors({ deal: v3GrandSeed });
    const result2 = scoreFactors({
      deal: v3GrandSeed,
      macroIndicators: undefined,
    });

    expect(result1.compositeScore).toBe(result2.compositeScore);
    expect(result1.impliedDiscountRate).toBe(result2.impliedDiscountRate);
    expect(result1.domainScores.global.score).toBe(
      result2.domainScores.global.score
    );
  });

  it('Madurai property gets higher local domain score', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const maduraiLocalScore = result.domainScores.local.score;
    expect(maduraiLocalScore).toBeGreaterThan(3.0);
  });

  it('asset domain includes all required factors', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const assetFactors = result.domainScores.asset.factors;
    const factorNames = assetFactors.map(f => f.name);

    expect(factorNames).toContain('Star Rating');
    expect(factorNames).toContain('Stabilized Occupancy');
    expect(factorNames).toContain('ADR Competitiveness');
    expect(factorNames).toContain('Phase 2 Optionality');
    expect(factorNames).toContain('CAPEX Discipline');
  });

  it('sponsor domain includes partnership quality factors', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const sponsorFactors = result.domainScores.sponsor.factors;
    const factorNames = sponsorFactors.map(f => f.name);

    expect(factorNames).toContain('JV Structure');
    expect(factorNames).toContain('Lead Investor Commitment');
    expect(factorNames).toContain('Operator Presence');
    expect(factorNames).toContain('Capital Adequacy');
  });

  it('phase 2 property gets higher phase 2 optionality score', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const phase2Factor = result.domainScores.asset.factors.find(
      f => f.name === 'Phase 2 Optionality'
    );
    expect(phase2Factor).toBeDefined();
    expect(phase2Factor!.score).toBeGreaterThan(3.0);
  });

  it('domain scores weighted sum equals composite score', () => {
    const result = scoreFactors({ deal: v3GrandSeed });

    const weightedSum =
      result.domainScores.global.score * result.domainScores.global.weight +
      result.domainScores.local.score * result.domainScores.local.weight +
      result.domainScores.asset.score * result.domainScores.asset.weight +
      result.domainScores.sponsor.score * result.domainScores.sponsor.weight;

    expect(Math.abs(weightedSum - result.compositeScore)).toBeLessThan(0.01);
  });

  it('higher occupancy improves asset domain score', () => {
    const highOccScenario = {
      ...v3GrandSeed,
      scenarios: {
        ...v3GrandSeed.scenarios,
        base: {
          ...v3GrandSeed.scenarios.base,
          occupancyStabilized: 0.85,
        },
      },
    };

    const baseResult = scoreFactors({ deal: v3GrandSeed });
    const highOccResult = scoreFactors({ deal: highOccScenario });

    expect(highOccResult.domainScores.asset.score).toBeGreaterThan(
      baseResult.domainScores.asset.score
    );
  });

  it('higher ADR improves asset domain score', () => {
    const higherAdrSeed = {
      ...v3GrandSeed,
      scenarios: {
        ...v3GrandSeed.scenarios,
        base: {
          ...v3GrandSeed.scenarios.base,
          adrStabilized: 6000,
        },
      },
    };

    const baseResult = scoreFactors({ deal: v3GrandSeed });
    const higherAdrResult = scoreFactors({ deal: higherAdrSeed });

    expect(higherAdrResult.domainScores.asset.score).toBeGreaterThan(
      baseResult.domainScores.asset.score
    );
  });
});
