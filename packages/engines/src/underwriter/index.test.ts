// ─── Underwriter Engine Tests ────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { buildProForma } from './index.js';
import { v3GrandSeed } from '../../../db/src/seed/v3grand.js';

describe('Underwriter', () => {
  it('base scenario produces positive IRR above WACC', () => {
    const result = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    expect(result.irr).toBeGreaterThan(v3GrandSeed.financialAssumptions.wacc);
    expect(result.npv).toBeGreaterThan(0);
    expect(result.equityMultiple).toBeGreaterThan(1.5);
    expect(result.avgDSCR).toBeGreaterThan(1.0);
    expect(result.years).toHaveLength(10);
    expect(result.cashFlows).toHaveLength(11); // year 0 + years 1-10
    expect(result.cashFlows[0]).toBeLessThan(0); // equity outlay is negative
  });

  it('bear scenario produces lower IRR than base', () => {
    const base = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const bear = buildProForma({ deal: v3GrandSeed, scenarioKey: 'bear' });

    expect(bear.irr).toBeLessThan(base.irr);
    expect(bear.npv).toBeLessThan(base.npv);
  });

  it('bull scenario produces higher IRR than base', () => {
    const base = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const bull = buildProForma({ deal: v3GrandSeed, scenarioKey: 'bull' });

    expect(bull.irr).toBeGreaterThan(base.irr);
    expect(bull.npv).toBeGreaterThan(base.npv);
  });

  it('year-over-year revenue is monotonically increasing', () => {
    const result = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    for (let i = 1; i < result.years.length; i++) {
      expect(result.years[i].totalRevenue).toBeGreaterThanOrEqual(result.years[i - 1].totalRevenue);
    }
  });
});
