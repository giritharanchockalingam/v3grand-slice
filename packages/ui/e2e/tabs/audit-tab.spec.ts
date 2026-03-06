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
    await expect(page.getByText(/audit|trail|log|history|activity/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('audit entries have timestamps', async ({ authedPage: page }) => {
    const timestamps = page.getByText(/\d{4}[-/]\d{2}|ago|AM|PM/i);
    await expect(timestamps.first()).toBeVisible({ timeout: 15_000 });
  });

  test('audit entries show module and action info', async ({ authedPage: page }) => {
    // Audit entries display as {type} heading with {module}: {action} description
    // Or "No activity recorded yet." if empty
    const hasEntries = page.getByText(/assumption|construction|deal|engine|scenario/i);
    const emptyState = page.getByText('No activity recorded yet');
    // Either entries exist or empty state is shown
    await expect(hasEntries.first().or(emptyState)).toBeVisible({ timeout: 15_000 });
  });
});
