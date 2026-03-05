// ─── Decision Engine Tests ────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { evaluate } from './index.js';
import { buildProForma } from '../underwriter/index.js';
import { scoreFactors } from '../factor/index.js';
import { runMonteCarlo } from '../montecarlo/index.js';
import { analyzeBudget } from '../budget/index.js';
import { v3GrandSeed } from '../../../db/src/seed/v3grand.js';

describe('Decision Engine', () => {
  it('INVEST verdict when all gates pass and confidence high', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const factors = scoreFactors({ deal: v3GrandSeed });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      factorResult: factors,
      currentRecommendation: undefined,
    });

    expect(result.verdict).toBe('INVEST');
    expect(result.confidence).toBeGreaterThan(70);
  });

  it('DO-NOT-PROCEED when poor metrics fail multiple gates', () => {
    const poorDeal = {
      ...v3GrandSeed,
      marketAssumptions: {
        ...v3GrandSeed.marketAssumptions,
        occupancyRamp: [0, 0.1, 0.15, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
        adrBase: 2000,
      },
      scenarios: {
        ...v3GrandSeed.scenarios,
        base: {
          ...v3GrandSeed.scenarios.base,
          occupancyStabilized: 0.30,
          adrStabilized: 2500,
        },
      },
    };

    const proForma = buildProForma({ deal: poorDeal, scenarioKey: 'base' });

    const result = evaluate({
      deal: poorDeal,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    expect(['EXIT', 'DO-NOT-PROCEED']).toContain(result.verdict);
  });

  it('flip detection identifies verdict change', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const secondRecommendation = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: { verdict: 'HOLD' } as any,
    });

    if (secondRecommendation.verdict !== 'HOLD') {
      expect(secondRecommendation.isFlip).toBe(true);
    }
  });

  it('no flip when verdict remains unchanged', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: { verdict: 'INVEST' } as any,
    });

    if (result.verdict === 'INVEST') {
      expect(result.isFlip).toBe(false);
    }
  });

  it('all gates have required properties', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    expect(result.gateResults.length).toBeGreaterThan(0);

    for (const gate of result.gateResults) {
      expect(gate).toHaveProperty('name');
      expect(gate).toHaveProperty('actual');
      expect(gate).toHaveProperty('threshold');
      expect(gate).toHaveProperty('passed');
      expect(typeof gate.passed).toBe('boolean');
    }
  });

  it('gate checks pass when metrics exceed thresholds', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    // At least some gates should pass for base scenario
    const passCount = result.gateResults.filter(g => g.passed).length;
    expect(passCount).toBeGreaterThan(0);
  });

  it('gate checks fail when metrics are below thresholds', () => {
    const poorDeal = {
      ...v3GrandSeed,
      scenarios: {
        ...v3GrandSeed.scenarios,
        base: {
          ...v3GrandSeed.scenarios.base,
          occupancyStabilized: 0.25,
          adrStabilized: 2000,
        },
      },
    };

    const proForma = buildProForma({ deal: poorDeal, scenarioKey: 'base' });

    const result = evaluate({
      deal: poorDeal,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    // Poor scenario should have some failed gates
    const failCount = result.gateResults.filter(g => !g.passed).length;
    expect(failCount).toBeGreaterThan(0);
  });

  it('confidence between 0-100', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const factors = scoreFactors({ deal: v3GrandSeed });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      factorResult: factors,
      currentRecommendation: undefined,
    });

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.confidence)).toBe(true);
  });

  it('verdict is valid recommendation verdict', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    const validVerdicts = ['INVEST', 'HOLD', 'DE-RISK', 'EXIT', 'DO-NOT-PROCEED'];
    expect(validVerdicts).toContain(result.verdict);
  });

  it('includes MC gates when Monte Carlo results provided', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const mc = runMonteCarlo({ deal: v3GrandSeed, iterations: 1000, seed: 42 });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      mcResult: mc,
      currentRecommendation: undefined,
    });

    const mcGates = result.gateResults.filter(g =>
      g.name.includes('MC') || g.name.includes('P(')
    );
    expect(mcGates.length).toBeGreaterThan(0);
  });

  it('includes Factor gate when Factor results provided', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const factors = scoreFactors({ deal: v3GrandSeed });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      factorResult: factors,
      currentRecommendation: undefined,
    });

    const factorGate = result.gateResults.find(g => g.name.includes('Factor'));
    expect(factorGate).toBeDefined();
  });

  it('includes Budget gate when Budget results provided', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const budget = analyzeBudget({
      asOfMonth: 6,
      budgetLines: v3GrandSeed.capexPlan.phase1.items.map(item => ({
        costCode: item.costCode,
        description: item.description,
        category: item.category,
        originalAmount: item.budgetAmount,
        approvedCOs: 0,
        currentBudget: item.budgetAmount,
        actualSpend: item.budgetAmount * 0.5,
        commitments: item.budgetAmount * 0.3,
      })),
      changeOrders: [],
      rfis: [],
      milestones: [],
    });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      budgetResult: budget,
      currentRecommendation: undefined,
    });

    const budgetGate = result.gateResults.find(g => g.name.includes('Budget'));
    expect(budgetGate).toBeDefined();
  });

  it('populates explanation with gate results summary', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('populates narrative for investor audience', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const factors = scoreFactors({ deal: v3GrandSeed });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      factorResult: factors,
      currentRecommendation: undefined,
    });

    expect(result.narrative).toBeDefined();
    expect(typeof result.narrative).toBe('string');
    expect(result.narrative.length).toBeGreaterThan(50);
  });

  it('topDrivers populated for strong cases', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });
    const factors = scoreFactors({ deal: v3GrandSeed });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      factorResult: factors,
      currentRecommendation: undefined,
    });

    expect(result.topDrivers).toBeDefined();
    expect(Array.isArray(result.topDrivers)).toBe(true);

    if (result.verdict === 'INVEST') {
      expect(result.topDrivers.length).toBeGreaterThan(0);
      expect(result.topDrivers.length).toBeLessThanOrEqual(3);
    }
  });

  it('topRisks populated for weak cases', () => {
    const poorDeal = {
      ...v3GrandSeed,
      scenarios: {
        ...v3GrandSeed.scenarios,
        base: {
          ...v3GrandSeed.scenarios.base,
          occupancyStabilized: 0.35,
          adrStabilized: 3000,
        },
      },
    };

    const proForma = buildProForma({ deal: poorDeal, scenarioKey: 'base' });

    const result = evaluate({
      deal: poorDeal,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    expect(result.topRisks).toBeDefined();
    expect(Array.isArray(result.topRisks)).toBe(true);

    if (result.verdict !== 'INVEST') {
      expect(result.topRisks.length).toBeGreaterThan(0);
    }
  });

  it('flipConditions provide actionable guidance', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    expect(result.flipConditions).toBeDefined();
    expect(Array.isArray(result.flipConditions)).toBe(true);
    expect(result.flipConditions.length).toBeGreaterThan(0);
    expect(result.flipConditions.length).toBeLessThanOrEqual(4);

    for (const condition of result.flipConditions) {
      expect(typeof condition).toBe('string');
      expect(condition.length).toBeGreaterThan(10);
    }
  });

  it('riskFlags populated for concerning metrics', () => {
    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: {
        irr: 0.05,
        npv: -5000000,
        equityMultiple: 1.2,
        avgDSCR: 1.1,
        paybackYear: 10,
        years: [],
        cashFlows: [],
        debtSchedule: [],
      },
      currentRecommendation: undefined,
    });

    expect(result.riskFlags).toBeDefined();
    expect(Array.isArray(result.riskFlags)).toBe(true);
  });

  it('gate pass rate determines verdict level', () => {
    const proForma = buildProForma({ deal: v3GrandSeed, scenarioKey: 'base' });

    const result = evaluate({
      deal: v3GrandSeed,
      proformaResult: proForma,
      currentRecommendation: undefined,
    });

    const passRate = result.gateResults.filter(g => g.passed).length / result.gateResults.length;

    if (passRate >= 0.85) {
      expect(result.verdict).toBe('INVEST');
    } else if (passRate >= 0.70) {
      expect(result.verdict).toBe('HOLD');
    } else if (passRate >= 0.50) {
      expect(result.verdict).toBe('DE-RISK');
    } else if (passRate >= 0.30) {
      expect(result.verdict).toBe('EXIT');
    } else {
      expect(result.verdict).toBe('DO-NOT-PROCEED');
    }
  });
});
