import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Feasibility Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Feasibility' }).click();
  });

  test('feasibility workbench renders', async ({ authedPage: page }) => {
    await expect(page.getByText(/feasibility|workbench|workflow/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('workflow steps are visible', async ({ authedPage: page }) => {
    // Should show workflow steps like Scenario, Assumptions, Sensitivity, IC Memo
    const steps = page.getByText(/scenario|assumptions|sensitivity|memo/i);
    await expect(steps.first()).toBeVisible({ timeout: 15_000 });
  });
});
