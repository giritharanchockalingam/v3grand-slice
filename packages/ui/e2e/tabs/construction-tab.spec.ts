import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME, BUDGET_LINE_COLUMNS } from '../helpers/test-data';

test.describe('Construction Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Construction' }).click();
  });

  test('summary cards render key metrics', async ({ authedPage: page }) => {
    // Should show budget/construction summary metrics
    await expect(page.getByText(/budget|spend|variance|completion/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('budget lines table is visible', async ({ authedPage: page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
  });

  test('budget lines table has data rows', async ({ authedPage: page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('budget table has expected column headers', async ({ authedPage: page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    // Check for key budget columns
    for (const col of ['Description', 'Budget', 'Actual']) {
      await expect(table.getByText(col, { exact: false }).first()).toBeVisible();
    }
  });

  test('progress indicator is visible', async ({ authedPage: page }) => {
    // Should have a progress bar or completion percentage
    const progress = page.getByText(/completion|progress|%/i);
    await expect(progress.first()).toBeVisible({ timeout: 15_000 });
  });
});
