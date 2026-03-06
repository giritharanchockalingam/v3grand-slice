import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Assumptions Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Assumptions' }).click();
  });

  test('revenue drivers section renders', async ({ authedPage: page }) => {
    await expect(page.getByText(/Revenue Drivers|Base ADR/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('revenue sliders show ADR values', async ({ authedPage: page }) => {
    // Should have ADR-related labels
    await expect(page.getByText(/ADR/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('financial assumptions section renders', async ({ authedPage: page }) => {
    // Should show financial parameters
    await expect(page.getByText(/Debt|Interest|WACC|Tax/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('slider inputs are present', async ({ authedPage: page }) => {
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible({ timeout: 15_000 });
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Save & Recompute button is visible', async ({ authedPage: page }) => {
    await expect(page.getByRole('button', { name: /save|recompute/i })).toBeVisible({ timeout: 15_000 });
  });

  test('slider values display with units', async ({ authedPage: page }) => {
    // Values should show %, ₹, yr, or x units
    const values = page.getByText(/[₹%]|\byr\b|\bx\b/);
    await expect(values.first()).toBeVisible({ timeout: 15_000 });
  });
});
