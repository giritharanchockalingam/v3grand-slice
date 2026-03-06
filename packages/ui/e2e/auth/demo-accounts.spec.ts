import { test, expect } from '../fixtures/auth.fixture';
import { DEMO_ACCOUNTS, type DemoRole } from '../helpers/test-data';

test.describe('Demo Account Quick Login', () => {
  for (const [role, acct] of Object.entries(DEMO_ACCOUNTS)) {
    test(`quick-login as ${acct.label} works`, async ({ page }) => {
      await page.goto('/login');
      await page.getByText(acct.label, { exact: true }).click();
      await page.waitForURL('**/deals', { timeout: 15_000 });
      expect(page.url()).toContain('/deals');
      // Verify user name displayed in nav
      await expect(page.getByText(acct.name)).toBeVisible({ timeout: 5_000 });
    });
  }
});
