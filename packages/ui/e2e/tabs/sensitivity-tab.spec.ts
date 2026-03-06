import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('What-If / Sensitivity Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'What-If' }).click();
  });

  test('sensitivity panel renders', async ({ authedPage: page }) => {
    await expect(page.getByText(/sensitivity|what-if|scenario/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('input controls for sensitivity variables are present', async ({ authedPage: page }) => {
    // Should have sliders or input fields
    const inputs = page.locator('input[type="range"], input[type="number"]');
    await expect(inputs.first()).toBeVisible({ timeout: 15_000 });
  });

  test('chart or visualization renders', async ({ authedPage: page }) => {
    // Should have a tornado diagram, chart, or SVG visualization
    const chart = page.locator('svg, canvas, [class*="chart"], [class*="tornado"]');
    await expect(chart.first()).toBeVisible({ timeout: 15_000 });
  });
});
