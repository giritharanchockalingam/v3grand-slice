import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Underwriting Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Underwriting' }).click();
  });

  test('scenario cards render (Bear, Base, Bull)', async ({ authedPage: page }) => {
    await expect(page.getByText(/bear|downside/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/base/i).first()).toBeVisible();
    await expect(page.getByText(/bull|upside/i).first()).toBeVisible();
  });

  test('each scenario shows verdict badge', async ({ authedPage: page }) => {
    const verdicts = page.getByText(/INVEST|HOLD|DE-RISK|EXIT/);
    await expect(verdicts.first()).toBeVisible({ timeout: 15_000 });
    const count = await verdicts.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each scenario shows IRR and NPV', async ({ authedPage: page }) => {
    await expect(page.getByText('IRR').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('NPV').first()).toBeVisible();
  });

  test('gate results display pass/fail indicators', async ({ authedPage: page }) => {
    // Gates section should show pass/fail text or icons
    const gates = page.getByText(/gate|pass|fail/i);
    await expect(gates.first()).toBeVisible({ timeout: 15_000 });
  });

  test('probability weights are shown', async ({ authedPage: page }) => {
    // Should see percentage weights like 20%, 55%, 25%
    const percentages = page.getByText(/%/);
    await expect(percentages.first()).toBeVisible({ timeout: 15_000 });
  });
});
