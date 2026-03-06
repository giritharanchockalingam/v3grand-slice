import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Risks Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Risks' }).click();
  });

  test('risk entries are displayed', async ({ authedPage: page }) => {
    // Should have risk cards or table rows
    await expect(page.getByText(/risk|threat|issue/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('risks show category badges', async ({ authedPage: page }) => {
    // Categories like market, construction, financial, regulatory
    const categories = page.getByText(/market|construction|financial|regulatory|operational/i);
    await expect(categories.first()).toBeVisible({ timeout: 15_000 });
  });

  test('risks show likelihood and impact', async ({ authedPage: page }) => {
    const likelihoodOrImpact = page.getByText(/likelihood|impact|severity|probability/i);
    await expect(likelihoodOrImpact.first()).toBeVisible({ timeout: 15_000 });
  });

  test('risk status indicators present', async ({ authedPage: page }) => {
    const statuses = page.getByText(/open|mitigated|closed|active|monitoring/i);
    await expect(statuses.first()).toBeVisible({ timeout: 15_000 });
  });
});
