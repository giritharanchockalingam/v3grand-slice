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
    await expect(page.getByText(/risk|threat|issue/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('risks show category badges', async ({ authedPage: page }) => {
    const categories = page.getByText(/market|construction|financial|regulatory|operational/i);
    await expect(categories.first()).toBeVisible({ timeout: 15_000 });
  });

  test('risk matrix sub-tab shows Probability vs Impact', async ({ authedPage: page }) => {
    // Click Risk Matrix sub-tab
    await page.getByText('Risk Matrix').first().click();
    await expect(page.getByText(/Probability vs Impact/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('risk list sub-tab shows likelihood and impact columns', async ({ authedPage: page }) => {
    // Click Risk List sub-tab
    await page.getByText('Risk List').first().click();
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('Likelihood').first()).toBeVisible();
    await expect(table.getByText('Impact').first()).toBeVisible();
  });

  test('risk status indicators present', async ({ authedPage: page }) => {
    const statuses = page.getByText(/open|mitigated|closed|active|monitoring/i);
    await expect(statuses.first()).toBeVisible({ timeout: 15_000 });
  });
});
