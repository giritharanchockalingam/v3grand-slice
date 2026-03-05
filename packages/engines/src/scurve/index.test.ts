// ─── S-Curve Engine Tests ─────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { distribute } from './index.js';

describe('S-Curve Engine', () => {
  const createTestInput = (items: any[], totalMonths: number) => ({
    items,
    totalMonths,
  });

  it('total amount distributed equals input total', () => {
    const items = [
      {
        description: 'Land acquisition',
        amount: 60_000_000,
        startMonth: 0,
        endMonth: 2,
        curveType: 'linear' as const,
      },
      {
        description: 'Structure',
        amount: 120_000_000,
        startMonth: 2,
        endMonth: 20,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    const totalInput = items.reduce((sum, item) => sum + item.amount, 0);
    expect(result.totalAmount).toBe(Math.round(totalInput));
  });

  it('monthly cashflows sum to total', () => {
    const items = [
      {
        description: 'Test item',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 10,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    const sumMonthly = result.monthlyCashflows.reduce((a, b) => a + b, 0);
    expect(sumMonthly).toBe(result.totalAmount);
  });

  it('cumulative is monotonically increasing', () => {
    const items = [
      {
        description: 'Construction',
        amount: 357_000_000,
        startMonth: 0,
        endMonth: 24,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    for (let i = 1; i < result.cumulativeCashflows.length; i++) {
      expect(result.cumulativeCashflows[i]).toBeGreaterThanOrEqual(
        result.cumulativeCashflows[i - 1]
      );
    }
  });

  it('final cumulative equals total amount', () => {
    const items = [
      {
        description: 'Project spend',
        amount: 357_000_000,
        startMonth: 0,
        endMonth: 24,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    const finalCumulative = result.cumulativeCashflows[result.cumulativeCashflows.length - 1];
    expect(finalCumulative).toBe(result.totalAmount);
  });

  it('S-curve peaks in middle months', () => {
    const items = [
      {
        description: 'S-curve spend',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 20,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 20);
    const result = distribute(input);

    // Find peak month
    let peakMonth = 0;
    for (let i = 1; i < result.monthlyCashflows.length; i++) {
      if (result.monthlyCashflows[i] > result.monthlyCashflows[peakMonth]) {
        peakMonth = i;
      }
    }

    // Peak should be in middle (between months 6-14 for 0-19 span)
    expect(peakMonth).toBeGreaterThan(5);
    expect(peakMonth).toBeLessThan(15);
  });

  it('front-loaded curve peaks in early months', () => {
    const items = [
      {
        description: 'Front-loaded spend',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 20,
        curveType: 'front-loaded' as const,
      },
    ];

    const input = createTestInput(items, 20);
    const result = distribute(input);

    // Calculate early vs late spending
    const earlySum = result.monthlyCashflows.slice(0, 7).reduce((a, b) => a + b, 0);
    const lateSum = result.monthlyCashflows.slice(13, 20).reduce((a, b) => a + b, 0);

    // Early months should have significantly more spending
    expect(earlySum).toBeGreaterThan(lateSum * 1.5);
  });

  it('back-loaded curve peaks in late months', () => {
    const items = [
      {
        description: 'Back-loaded spend',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 20,
        curveType: 'back-loaded' as const,
      },
    ];

    const input = createTestInput(items, 20);
    const result = distribute(input);

    // Calculate early vs late spending
    const earlySum = result.monthlyCashflows.slice(0, 7).reduce((a, b) => a + b, 0);
    const lateSum = result.monthlyCashflows.slice(13, 20).reduce((a, b) => a + b, 0);

    // Late months should have significantly more spending
    expect(lateSum).toBeGreaterThan(earlySum * 1.5);
  });

  it('linear gives roughly equal distribution', () => {
    const items = [
      {
        description: 'Linear spend',
        amount: 120_000_000,
        startMonth: 0,
        endMonth: 12,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    const expectedMonthly = 120_000_000 / 12;
    const tolerance = expectedMonthly * 0.05; // 5% tolerance

    for (const monthly of result.monthlyCashflows) {
      expect(monthly).toBeGreaterThan(expectedMonthly - tolerance);
      expect(monthly).toBeLessThan(expectedMonthly + tolerance);
    }
  });

  it('multiple items distribute independently', () => {
    const items = [
      {
        description: 'Early item',
        amount: 50_000_000,
        startMonth: 0,
        endMonth: 6,
        curveType: 'linear' as const,
      },
      {
        description: 'Later item',
        amount: 75_000_000,
        startMonth: 12,
        endMonth: 24,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    // Early months should have ~50M/6
    const earlyAvg =
      result.monthlyCashflows.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    expect(earlyAvg).toBeGreaterThan(8_000_000);
    expect(earlyAvg).toBeLessThan(9_000_000);

    // Late months should have ~75M/12
    const lateAvg =
      result.monthlyCashflows.slice(12, 24).reduce((a, b) => a + b, 0) / 12;
    expect(lateAvg).toBeGreaterThan(6_000_000);
    expect(lateAvg).toBeLessThan(7_000_000);
  });

  it('items extending past totalMonths are clamped', () => {
    const items = [
      {
        description: 'Extended item',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 30, // Beyond totalMonths of 20
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 20);
    const result = distribute(input);

    expect(result.monthlyCashflows.length).toBe(20);
    expect(result.cumulativeCashflows.length).toBe(20);
  });

  it('zero-span items contribute nothing', () => {
    const items = [
      {
        description: 'Zero-span item',
        amount: 100_000_000,
        startMonth: 5,
        endMonth: 5, // span = 0
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    expect(result.totalAmount).toBe(0);
  });

  it('negative span items are skipped', () => {
    const items = [
      {
        description: 'Negative span',
        amount: 100_000_000,
        startMonth: 10,
        endMonth: 5, // negative span
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    expect(result.totalAmount).toBe(0);
  });

  it('returns correct array lengths', () => {
    const items = [
      {
        description: 'Test',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 10,
        curveType: 'linear' as const,
      },
    ];

    const totalMonths = 24;
    const input = createTestInput(items, totalMonths);
    const result = distribute(input);

    expect(result.monthlyCashflows.length).toBe(totalMonths);
    expect(result.cumulativeCashflows.length).toBe(totalMonths);
  });

  it('monthly cashflows start at month 0', () => {
    const items = [
      {
        description: 'Spend from month 0',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 12,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    expect(result.monthlyCashflows[0]).toBeGreaterThan(0);
  });

  it('all monthly values are non-negative', () => {
    const items = [
      {
        description: 'Normal spend',
        amount: 357_000_000,
        startMonth: 0,
        endMonth: 24,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    for (const monthly of result.monthlyCashflows) {
      expect(monthly).toBeGreaterThanOrEqual(0);
    }
  });

  it('s-curve shows bell curve shape in middle', () => {
    const items = [
      {
        description: 'S-curve test',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 24,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 24);
    const result = distribute(input);

    // Early months should be less than middle
    const earlyAvg = result.monthlyCashflows.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const middleAvg = result.monthlyCashflows.slice(10, 14).reduce((a, b) => a + b, 0) / 4;

    expect(middleAvg).toBeGreaterThan(earlyAvg);
  });

  it('front-loaded and back-loaded are inverses of each other', () => {
    const items = [
      {
        description: 'Test',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 20,
        curveType: 'front-loaded' as const,
      },
    ];

    const input = createTestInput(items, 20);
    const frontLoaded = distribute(input);

    const itemsBackLoaded = [
      {
        ...items[0],
        curveType: 'back-loaded' as const,
      },
    ];

    const inputBackLoaded = createTestInput(itemsBackLoaded, 20);
    const backLoaded = distribute(inputBackLoaded);

    // Front-loaded early spending should be greater than back-loaded early
    const frontEarlySum = frontLoaded.monthlyCashflows.slice(0, 5).reduce((a, b) => a + b, 0);
    const backEarlySum = backLoaded.monthlyCashflows.slice(0, 5).reduce((a, b) => a + b, 0);

    expect(frontEarlySum).toBeGreaterThan(backEarlySum);

    // Front-loaded late spending should be less than back-loaded late
    const frontLateSum = frontLoaded.monthlyCashflows.slice(15, 20).reduce((a, b) => a + b, 0);
    const backLateSum = backLoaded.monthlyCashflows.slice(15, 20).reduce((a, b) => a + b, 0);

    expect(frontLateSum).toBeLessThan(backLateSum);
  });

  it('cumulative at month i equals sum of first i monthly values', () => {
    const items = [
      {
        description: 'Test',
        amount: 100_000_000,
        startMonth: 0,
        endMonth: 12,
        curveType: 's-curve' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    for (let i = 0; i < result.cumulativeCashflows.length; i++) {
      const expectedCumulative = result.monthlyCashflows
        .slice(0, i + 1)
        .reduce((a, b) => a + b, 0);

      expect(result.cumulativeCashflows[i]).toBe(expectedCumulative);
    }
  });

  it('handles very large amounts correctly', () => {
    const items = [
      {
        description: 'Large project',
        amount: 1_000_000_000, // 1 billion
        startMonth: 0,
        endMonth: 30,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 30);
    const result = distribute(input);

    expect(result.totalAmount).toBe(1_000_000_000);
    expect(result.cumulativeCashflows[result.cumulativeCashflows.length - 1]).toBe(
      1_000_000_000
    );
  });

  it('handles single month distribution', () => {
    const items = [
      {
        description: 'Single month',
        amount: 50_000_000,
        startMonth: 5,
        endMonth: 6,
        curveType: 'linear' as const,
      },
    ];

    const input = createTestInput(items, 12);
    const result = distribute(input);

    // Month 5 should get all the amount (approximately)
    expect(result.monthlyCashflows[5]).toBeCloseTo(50_000_000, -3);
    expect(result.totalAmount).toBe(50_000_000);
  });
});
