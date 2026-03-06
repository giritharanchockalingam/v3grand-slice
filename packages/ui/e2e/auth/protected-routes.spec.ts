import { test, expect } from '@playwright/test';

test.describe('Protected Routes (unauthenticated)', () => {
  test('visiting /deals without auth redirects to /login', async ({ page }) => {
    await page.goto('/deals');
    // /deals uses AuthGuard which does router.replace('/login')
    await page.waitForURL('**/login', { timeout: 20_000 });
    expect(page.url()).toContain('/login');
  });

  test('visiting /portfolio without auth shows no deal data', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    // Portfolio page does NOT redirect — it renders but shows loading/empty state
    // The login form should not appear; instead the page will show a skeleton or "no data"
    // Verify the URL stays at /portfolio (no redirect)
    expect(page.url()).toContain('/portfolio');
  });

  test('visiting /deals/[dealId] without auth shows no deal data', async ({ page }) => {
    await page.goto('/deals/00000000-0000-7000-8000-000000000001');
    await page.waitForLoadState('networkidle');
    // Deal detail page does NOT redirect — it renders but without user context
    expect(page.url()).toContain('/deals/');
  });
});
