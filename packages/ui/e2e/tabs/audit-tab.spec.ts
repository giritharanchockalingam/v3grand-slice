import { test, expect } from '../fixtures/auth.fixture';
import { DEAL_URL, DEAL_NAME } from '../helpers/test-data';

test.describe('Audit Trail Tab', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto(DEAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: DEAL_NAME })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Audit Trail' }).click();
  });

  test('audit trail content renders', async ({ authedPage: page }) => {
    await expect(page.getByText(/audit|trail|log|history/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('audit entries have timestamps', async ({ authedPage: page }) => {
    // Should see date/time patterns in audit entries
    const timestamps = page.getByText(/\d{4}[-/]\d{2}|ago|AM|PM/i);
    await expect(timestamps.first()).toBeVisible({ timeout: 15_000 });
  });

  test('audit entries have action descriptions', async ({ authedPage: page }) => {
    // Should see action types like "updated", "created", "computed"
    const actions = page.getByText(/updated|created|computed|changed|recomputed|logged/i);
    await expect(actions.first()).toBeVisible({ timeout: 15_000 });
  });
});
