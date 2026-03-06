import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_NAME, TAB_LABELS } from '../helpers/test-data';

test.describe('Full Deal Flow (Integration)', () => {
  // This is a long flow touching all tabs — increase timeout
  test.setTimeout(120_000);

  test('login → deals list → deal detail → all tabs → portfolio', async ({ authedPage: page }) => {
    // Step 1: Verify deals list loaded after auth
    await expect(page.getByText(DEAL_NAME)).toBeVisible({ timeout: 15_000 });

    // Step 2: Click into V3 Grand Madurai
    await page.getByText(DEAL_NAME).click();
    await page.waitForURL('**/deals/**', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });

    // Step 3: Click through all 10 tabs, verify each loads without error
    for (const label of TAB_LABELS) {
      // Wait for network to settle and page to be stable after previous tab
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 15_000 });
      // Use CSS selector with text match — resilient to React re-renders and SVG icon content
      const btn = page.locator(`button:has-text("${label}")`);
      await expect(btn.first()).toBeVisible({ timeout: 20_000 });
      await btn.first().click({ timeout: 15_000 });
      // Wait for tab content to begin loading
      await page.waitForTimeout(1500);
      // Verify no API error banner
      const errorEl = page.getByText(/^API Error|500 Internal|Failed to load/i);
      const hasRealError = await errorEl.isVisible().catch(() => false);
      expect(hasRealError).toBeFalsy();
    }

    // Step 4: Navigate to Portfolio
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Portfolio Analytics' })).toBeVisible({ timeout: 15_000 });
  });
});
