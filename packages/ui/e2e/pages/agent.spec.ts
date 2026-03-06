import { test, expect } from '../fixtures/auth.fixture';

test.describe('Agent Page', () => {
  test('page loads with workflow and chat panels', async ({ authedPage: page }) => {
    await page.goto('/agent');
    await page.waitForLoadState('networkidle');
    // Agent page should have some visible content
    await expect(page.getByText(/workflow|agent|chat/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('chat input field present', async ({ authedPage: page }) => {
    await page.goto('/agent');
    await page.waitForLoadState('networkidle');
    // Look for a text input or textarea for chat
    const chatInput = page.locator('input[type="text"], textarea').last();
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
  });
});
