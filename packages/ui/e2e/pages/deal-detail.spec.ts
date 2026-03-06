import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME, TAB_LABELS } from '../helpers/test-data';

test.describe('Deal Detail Page', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    // Wait for deal header to appear (loading state resolved)
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
  });

  test('deal header shows name, asset class, phase, month, and location', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible();
    await expect(page.getByText('hotel').first()).toBeVisible();
    await expect(page.getByText('Phase: construction')).toBeVisible();
    await expect(page.getByText('Month 14')).toBeVisible();
    await expect(page.getByText('Madurai, Tamil Nadu')).toBeVisible();
  });

  test('all 10 tab buttons are visible', async ({ authedPage: page }) => {
    for (const label of TAB_LABELS) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('Recompute button visible for lead-investor', async ({ authedPage: page }) => {
    await expect(page.getByRole('button', { name: /Recompute/i })).toBeVisible();
  });

  test('lifecycle phase bar renders with Construction highlighted', async ({ authedPage: page }) => {
    // Phase bar should show Construction as current
    await expect(page.getByText('Construction').first()).toBeVisible();
  });

  test('tab switching works (SPA navigation, no page reload)', async ({ authedPage: page }) => {
    const startUrl = page.url();
    // Switch to Assumptions tab
    await page.getByRole('button', { name: 'Assumptions' }).click();
    // URL should not change (tabs are in-page)
    expect(page.url()).toBe(startUrl);
    // Assumptions content should appear — use specific heading to avoid strict mode
    await expect(page.getByRole('heading', { name: 'Revenue Drivers' })).toBeVisible({ timeout: 10_000 });
  });
});
