import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_NAME, SEEDED_DEAL_NAMES } from '../helpers/test-data';

test.describe('Deals List Page', () => {
  test('loads and shows deal cards', async ({ authedPage: page }) => {
    // Already on /deals after login
    // V3 Grand Madurai should be visible
    await expect(page.getByText(DEAL_NAME)).toBeVisible({ timeout: 15_000 });
  });

  test('shows at least 4 seeded deals', async ({ authedPage: page }) => {
    for (const name of SEEDED_DEAL_NAMES) {
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('deal cards show asset class and status badges', async ({ authedPage: page }) => {
    // V3 Grand Madurai should show "hotel" badge
    await expect(page.getByText('hotel').first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a deal navigates to deal detail', async ({ authedPage: page }) => {
    await page.getByText(DEAL_NAME).click();
    await page.waitForURL('**/deals/**', { timeout: 10_000 });
    expect(page.url()).toContain('/deals/');
  });
});
