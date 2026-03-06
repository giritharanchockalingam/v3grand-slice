import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Construction Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Construction' }).click();
  });

  test('construction tracking heading renders', async ({ authedPage: page }) => {
    await expect(page.getByText('Construction Tracking').first()).toBeVisible({ timeout: 15_000 });
  });

  test('sub-tabs for Budget Lines, Change Orders, Milestones, RFIs visible', async ({ authedPage: page }) => {
    await expect(page.getByText('Budget Lines').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Change Orders').first()).toBeVisible();
    await expect(page.getByText('Milestones').first()).toBeVisible();
    await expect(page.getByText('RFIs').first()).toBeVisible();
  });

  test('overall construction progress indicator visible', async ({ authedPage: page }) => {
    await expect(page.getByText('Overall Construction Progress').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Budget Lines sub-tab shows budget table', async ({ authedPage: page }) => {
    await page.getByText('Budget Lines').first().click();
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
  });

  test('budget table has expected column headers', async ({ authedPage: page }) => {
    await page.getByText('Budget Lines').first().click();
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    for (const col of ['Cost Code', 'Description', 'Category']) {
      await expect(table.getByText(col, { exact: false }).first()).toBeVisible();
    }
  });
});
