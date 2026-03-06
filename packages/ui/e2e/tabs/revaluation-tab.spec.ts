import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Revaluation Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Revaluation' }).click();
  });

  test('revaluation panel renders', async ({ authedPage: page }) => {
    await expect(page.getByText(/revaluation|valuation|timeline/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('monthly timeline or recommendation history present', async ({ authedPage: page }) => {
    // Should show a timeline or historical recommendations
    const timeline = page.getByText(/month|timeline|history|recommendation/i);
    await expect(timeline.first()).toBeVisible({ timeout: 15_000 });
  });
});
