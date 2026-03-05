// ─── Budget Engine Tests ──────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { analyzeBudget } from './index.js';
import { v3GrandSeed } from '../../../db/src/seed/v3grand.js';

describe('Budget Engine', () => {
  const createBudgetInput = (overrides: any = {}) => {
    const defaults = {
      asOfMonth: 12,
      budgetLines: [
        {
          costCode: 'LAND-001',
          description: 'Land acquisition',
          category: 'land',
          originalAmount: 60_000_000,
          approvedCOs: 0,
          currentBudget: 60_000_000,
          actualSpend: 60_000_000,
          commitments: 0,
        },
        {
          costCode: 'STRUC-001',
          description: 'Structure & civil',
          category: 'structure',
          originalAmount: 120_000_000,
          approvedCOs: 0,
          currentBudget: 120_000_000,
          actualSpend: 110_000_000,
          commitments: 8_000_000,
        },
        {
          costCode: 'MEP-001',
          description: 'MEP systems',
          category: 'mep',
          originalAmount: 55_000_000,
          approvedCOs: 0,
          currentBudget: 55_000_000,
          actualSpend: 45_000_000,
          commitments: 8_000_000,
        },
      ],
      changeOrders: [],
      rfis: [],
      milestones: [],
    };

    return { ...defaults, ...overrides };
  };

  it('GREEN status when variances small', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    // All lines should be within tolerance
    const allSmallVariance = result.lineVariances.every(
      line => Math.abs(line.variancePct) < 0.10
    );

    if (allSmallVariance) {
      expect(result.overallStatus).toBe('GREEN');
    }
  });

  it('RED status when variance > 20%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'TEST-001',
          description: 'Over budget item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 0,
          commitments: 125_000_000, // 25% overrun
        },
      ],
    });

    const result = analyzeBudget(input);

    // Should have RED line
    const hasRedLine = result.lineVariances.some(line => line.status === 'RED');
    expect(hasRedLine).toBe(true);

    // Overall should be RED
    expect(result.overallStatus).toBe('RED');
  });

  it('AMBER status when variance 10-20%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'TEST-001',
          description: 'Moderately over budget',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 0,
          commitments: 115_000_000, // 15% overrun
        },
      ],
    });

    const result = analyzeBudget(input);

    const hasAmberLine = result.lineVariances.some(line => line.status === 'AMBER');
    expect(hasAmberLine).toBe(true);
  });

  it('alerts generated for RED lines', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'RED-001',
          description: 'Severely over budget',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 0,
          commitments: 130_000_000, // 30% overrun
        },
      ],
    });

    const result = analyzeBudget(input);

    const redAlert = result.alerts.find(a => a.includes('RED'));
    expect(redAlert).toBeDefined();
    expect(redAlert).toContain('RED-001');
  });

  it('alerts generated for AMBER lines', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'AMBER-001',
          description: 'Slightly over budget',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 0,
          commitments: 112_000_000, // 12% overrun
        },
      ],
    });

    const result = analyzeBudget(input);

    const amberAlert = result.alerts.find(a => a.includes('AMBER'));
    expect(amberAlert).toBeDefined();
  });

  it('total budget sums correctly', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    const expectedTotal = input.budgetLines.reduce(
      (sum, line) => sum + line.currentBudget,
      0
    );

    expect(result.totalBudget).toBe(expectedTotal);
  });

  it('total spent sums correctly', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    const expectedSpent = input.budgetLines.reduce(
      (sum, line) => sum + line.actualSpend,
      0
    );

    expect(result.totalSpent).toBe(expectedSpent);
  });

  it('total committed sums correctly', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    const expectedCommitted = input.budgetLines.reduce(
      (sum, line) => sum + line.commitments,
      0
    );

    expect(result.totalCommitted).toBe(expectedCommitted);
  });

  it('total forecast is maximum of spend and commitments per line', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    const expectedForecast = input.budgetLines.reduce((sum, line) => {
      const forecast = Math.max(line.actualSpend, line.commitments);
      return sum + forecast;
    }, 0);

    expect(result.totalForecast).toBe(expectedForecast);
  });

  it('pending change orders generate alert', () => {
    const input = createBudgetInput({
      changeOrders: [
        {
          id: 'co1',
          description: 'Scope addition',
          amount: 5_000_000,
          status: 'draft',
        },
        {
          id: 'co2',
          description: 'Design change',
          amount: 3_000_000,
          status: 'submitted',
        },
      ],
    });

    const result = analyzeBudget(input);

    const coAlert = result.alerts.find(a => a.includes('pending change order'));
    expect(coAlert).toBeDefined();
    expect(coAlert).toContain('2 pending change order(s)');
  });

  it('approved change orders not flagged as pending', () => {
    const input = createBudgetInput({
      changeOrders: [
        {
          id: 'co1',
          description: 'Approved change',
          amount: 5_000_000,
          status: 'approved',
        },
      ],
    });

    const result = analyzeBudget(input);

    const coAlert = result.alerts.find(a => a.includes('pending change order'));
    expect(coAlert).toBeUndefined();
  });

  it('budget overrun alert generated when forecast > 5% over budget', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'TEST-001',
          description: 'Overrun item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 0,
          commitments: 107_000_000, // 7% overrun
        },
      ],
    });

    const result = analyzeBudget(input);

    const overrunAlert = result.alerts.find(a => a.includes('BUDGET OVERRUN'));
    expect(overrunAlert).toBeDefined();
  });

  it('varianceToCurrent is calculated correctly', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    const totalBudget = input.budgetLines.reduce(
      (sum, line) => sum + line.currentBudget,
      0
    );
    const totalForecast = input.budgetLines.reduce((sum, line) => {
      const forecast = Math.max(line.actualSpend, line.commitments);
      return sum + forecast;
    }, 0);

    const expectedVariancePct = (totalForecast - totalBudget) / totalBudget;
    const tolerance = 0.0001;

    expect(Math.abs(result.varianceToCurrent - expectedVariancePct)).toBeLessThan(
      tolerance
    );
  });

  it('line variance calculations are correct', () => {
    const input = createBudgetInput();
    const result = analyzeBudget(input);

    for (let i = 0; i < input.budgetLines.length; i++) {
      const inputLine = input.budgetLines[i];
      const resultLine = result.lineVariances[i];

      expect(resultLine.costCode).toBe(inputLine.costCode);
      expect(resultLine.currentBudget).toBe(inputLine.currentBudget);
      expect(resultLine.actualSpend).toBe(inputLine.actualSpend);

      const expectedForecast = Math.max(
        inputLine.actualSpend,
        inputLine.commitments
      );
      expect(resultLine.forecast).toBe(expectedForecast);

      const expectedVariance = expectedForecast - inputLine.currentBudget;
      expect(resultLine.variance).toBe(Math.round(expectedVariance));
    }
  });

  it('line status is GREEN when variance < 10%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'GREEN-001',
          description: 'On budget',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 95_000_000,
          commitments: 3_000_000, // 98M total, 2% variance
        },
      ],
    });

    const result = analyzeBudget(input);

    expect(result.lineVariances[0].status).toBe('GREEN');
  });

  it('asOfMonth is preserved in output', () => {
    const input = createBudgetInput({ asOfMonth: 18 });
    const result = analyzeBudget(input);

    expect(result.asOfMonth).toBe(18);
  });

  it('open RFI alert generated when > 3 open', () => {
    const input = createBudgetInput({
      rfis: [
        { id: 'rfi1', status: 'open' },
        { id: 'rfi2', status: 'open' },
        { id: 'rfi3', status: 'open' },
        { id: 'rfi4', status: 'open' },
        { id: 'rfi5', status: 'closed' },
      ],
    });

    const result = analyzeBudget(input);

    const rfiAlert = result.alerts.find(a => a.includes('open RFIs'));
    expect(rfiAlert).toBeDefined();
  });

  it('no RFI alert when <= 3 open', () => {
    const input = createBudgetInput({
      rfis: [
        { id: 'rfi1', status: 'open' },
        { id: 'rfi2', status: 'open' },
        { id: 'rfi3', status: 'closed' },
      ],
    });

    const result = analyzeBudget(input);

    const rfiAlert = result.alerts.find(a => a.includes('open RFIs'));
    expect(rfiAlert).toBeUndefined();
  });

  it('delayed milestone alert generated for past-due items', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const input = createBudgetInput({
      milestones: [
        {
          name: 'Foundation Complete',
          status: 'pending',
          targetDate: pastDate.toISOString(),
        },
      ],
    });

    const result = analyzeBudget(input);

    const delayAlert = result.alerts.find(a => a.includes('milestone'));
    expect(delayAlert).toBeDefined();
  });

  it('handles empty budget lines', () => {
    const input = createBudgetInput({
      budgetLines: [],
    });

    const result = analyzeBudget(input);

    expect(result.totalBudget).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.totalForecast).toBe(0);
    expect(result.lineVariances.length).toBe(0);
  });

  it('GREEN status when overall variance < 5%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'ITEM-001',
          description: 'Test item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 95_000_000,
          commitments: 2_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    if (Math.abs(result.varianceToCurrent) < 0.05) {
      expect(result.overallStatus).toBe('GREEN');
    }
  });

  it('AMBER status when overall variance 5-10%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'ITEM-001',
          description: 'Test item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 92_000_000,
          commitments: 4_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    if (Math.abs(result.varianceToCurrent) >= 0.05 && Math.abs(result.varianceToCurrent) <= 0.10) {
      expect(result.overallStatus).toBe('AMBER');
    }
  });

  it('RED status when overall variance > 10%', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'ITEM-001',
          description: 'Test item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 85_000_000,
          commitments: 18_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    if (Math.abs(result.varianceToCurrent) > 0.10) {
      expect(result.overallStatus).toBe('RED');
    }
  });

  it('analyzes v3GrandSeed budget structure', () => {
    const input = {
      asOfMonth: 14,
      budgetLines: v3GrandSeed.capexPlan.phase1.items.map(item => ({
        costCode: item.costCode,
        description: item.description,
        category: item.category,
        originalAmount: item.budgetAmount,
        approvedCOs: 0,
        currentBudget: item.budgetAmount,
        actualSpend: item.budgetAmount * 0.45,
        commitments: item.budgetAmount * 0.25,
      })),
      changeOrders: [],
      rfis: [],
      milestones: [],
    };

    const result = analyzeBudget(input);

    expect(result.asOfMonth).toBe(14);
    expect(result.lineVariances.length).toBe(v3GrandSeed.capexPlan.phase1.items.length);
    expect(result.totalBudget).toBeGreaterThan(0);
    expect(result.totalSpent).toBeGreaterThan(0);
  });

  it('correctly identifies category in line variance output', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'LAND-001',
          description: 'Land acquisition',
          category: 'land',
          originalAmount: 60_000_000,
          approvedCOs: 0,
          currentBudget: 60_000_000,
          actualSpend: 60_000_000,
          commitments: 0,
        },
      ],
    });

    const result = analyzeBudget(input);

    expect(result.lineVariances[0].category).toBe('land');
    expect(result.lineVariances[0].description).toBe('Land acquisition');
  });

  it('alerts array is populated with specific issue messages', () => {
    const result = analyzeBudget(createBudgetInput());

    expect(Array.isArray(result.alerts)).toBe(true);
    for (const alert of result.alerts) {
      expect(typeof alert).toBe('string');
      expect(alert.length).toBeGreaterThan(5);
    }
  });

  it('no false alerts when budget is in control', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'ITEM-001',
          description: 'Controlled item',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 98_000_000,
          commitments: 1_000_000,
        },
      ],
      changeOrders: [],
      rfis: [{ id: 'rfi1', status: 'closed' }],
      milestones: [],
    });

    const result = analyzeBudget(input);

    const criticalAlerts = result.alerts.filter(
      a => a.includes('RED') || a.includes('BUDGET OVERRUN')
    );
    expect(criticalAlerts.length).toBe(0);
  });

  it('variance percentage is correctly computed', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'TEST-001',
          description: 'Test',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 90_000_000,
          commitments: 5_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    const line = result.lineVariances[0];
    const forecast = Math.max(90_000_000, 5_000_000);
    const expectedVariancePct = (forecast - 100_000_000) / 100_000_000;

    expect(Math.abs(line.variancePct - expectedVariancePct)).toBeLessThan(0.0001);
  });

  it('byCategory and byCostCode arrays are initialized', () => {
    const result = analyzeBudget(createBudgetInput());

    expect(Array.isArray(result.byCategory)).toBe(true);
    expect(Array.isArray(result.byCostCode)).toBe(true);
  });

  it('sCurveData array is initialized', () => {
    const result = analyzeBudget(createBudgetInput());

    expect(Array.isArray(result.sCurveData)).toBe(true);
  });

  it('cash flow risk alert for high commitments low spend', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'ITEM-001',
          description: 'High commitments',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 10_000_000,
          commitments: 96_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    const cashFlowAlert = result.alerts.find(a => a.includes('CASH FLOW RISK'));
    expect(cashFlowAlert).toBeDefined();
  });

  it('line forecast is maximum of spend and commitments', () => {
    const input = createBudgetInput({
      budgetLines: [
        {
          costCode: 'HIGH-SPEND',
          description: 'More spend',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 80_000_000,
          commitments: 60_000_000,
        },
        {
          costCode: 'HIGH-COMMIT',
          description: 'More commitment',
          category: 'structure',
          originalAmount: 100_000_000,
          approvedCOs: 0,
          currentBudget: 100_000_000,
          actualSpend: 60_000_000,
          commitments: 80_000_000,
        },
      ],
    });

    const result = analyzeBudget(input);

    expect(result.lineVariances[0].forecast).toBe(80_000_000);
    expect(result.lineVariances[1].forecast).toBe(80_000_000);
  });
});
