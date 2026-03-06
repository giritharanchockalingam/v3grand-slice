import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('/ redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
