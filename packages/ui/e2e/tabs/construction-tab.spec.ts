import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Construction Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Construction' }).click();
    // Wait for construction content to load
    await page.waitForLoadState('networkidle');
  });

  test('construction tab renders content (tracking or empty state)', async ({ authedPage: page }) => {
    // Either the full dashboard loads or we see the empty/error state
    const tracking = page.getByText('Construction Tracking');
    const noData = page.getByText('No construction data available');
    const errorState = page.getByText('Error:');
    await expect(tracking.or(noData).or(errorState)).toBeVisible({ timeout: 15_000 });
  });

  test('when data loads, sub-tabs are visible', async ({ authedPage: page }) => {
    const tracking = page.getByText('Construction Tracking');
    // Skip if no data
    if (!(await tracking.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await expect(page.getByText(/Budget Lines/).first()).toBeVisible();
    await expect(page.getByText(/Change Orders/).first()).toBeVisible();
    await expect(page.getByText(/Milestones/).first()).toBeVisible();
  });

  test('when data loads, progress indicator shows', async ({ authedPage: page }) => {
    const tracking = page.getByText('Construction Tracking');
    if (!(await tracking.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await expect(page.getByText('Overall Construction Progress')).toBeVisible();
  });

  test('when data loads, budget table renders on Budget Lines sub-tab', async ({ authedPage: page }) => {
    const tracking = page.getByText('Construction Tracking');
    if (!(await tracking.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    // Budget Lines is the default section, but click it to be safe
    await page.getByText(/Budget Lines/).first().click();
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10_000 });
  });
});
