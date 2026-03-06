import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_NAME, TAB_LABELS } from '../helpers/test-data';

test.describe('Full Deal Flow (Integration)', () => {
  test('login → deals list → deal detail → all tabs → portfolio', async ({ authedPage: page }) => {
    // Step 1: Verify deals list loaded after auth
    await expect(page.getByText(DEAL_NAME)).toBeVisible({ timeout: 15_000 });

    // Step 2: Click into V3 Grand Madurai
    await page.getByText(DEAL_NAME).click();
    await page.waitForURL('**/deals/**', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });

    // Step 3: Click through all 10 tabs, verify each loads without error
    for (const label of TAB_LABELS) {
      await page.getByRole('button', { name: label }).click();
      // Wait for tab content to settle
      await page.waitForLoadState('networkidle');
      // Verify no error message
      const errorVisible = await page.getByText(/error|500|failed to load/i).isVisible().catch(() => false);
      if (errorVisible) {
        // Check it's not just a risk with "error" in the name
        const errorEl = page.getByText(/^Error|API Error|500 Internal|Failed to load/i);
        const hasRealError = await errorEl.isVisible().catch(() => false);
        expect(hasRealError).toBeFalsy();
      }
    }

    // Step 4: Navigate to Portfolio
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(DEAL_NAME).or(page.getByText('Portfolio'))).toBeVisible({ timeout: 15_000 });
  });
});
