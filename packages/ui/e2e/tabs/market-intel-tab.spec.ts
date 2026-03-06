import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Market Intel Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Market Intel' }).click();
  });

  test('market intelligence content loads', async ({ authedPage: page }) => {
    await expect(page.getByText(/market|intelligence|quality|health|macro/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('market sections are present', async ({ authedPage: page }) => {
    // Should have market quality, health, or macro sections
    const sections = page.getByText(/quality|health|macro|supply|demand|competitive/i);
    await expect(sections.first()).toBeVisible({ timeout: 15_000 });
  });
});
