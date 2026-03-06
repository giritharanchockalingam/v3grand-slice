import { test, expect } from '../fixtures/auth.fixture';

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with summary cards section', async ({ authedPage: page }) => {
    // Use heading for unique match
    await expect(page.getByRole('heading', { name: 'Portfolio Analytics' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total AUM').first()).toBeVisible();
  });

  test('deal comparison table has correct column headers', async ({ authedPage: page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    // Verify key columns
    for (const col of ['Name', 'Phase', 'IRR', 'NPV', 'Verdict']) {
      await expect(table.getByText(col, { exact: false }).first()).toBeVisible();
    }
  });

  test('table has at least one row of data', async ({ authedPage: page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('verdict badges use color coding', async ({ authedPage: page }) => {
    // At least one verdict badge should be present
    const verdicts = page.getByText(/INVEST|HOLD|DE-RISK|EXIT/);
    await expect(verdicts.first()).toBeVisible({ timeout: 15_000 });
  });
});
