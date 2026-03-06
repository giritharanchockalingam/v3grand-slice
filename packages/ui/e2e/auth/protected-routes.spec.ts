import { test, expect } from '@playwright/test';

test.describe('Protected Routes (unauthenticated)', () => {
  test('visiting /deals without auth redirects to /login', async ({ page }) => {
    await page.goto('/deals');
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('visiting /portfolio without auth redirects to /login', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('visiting /deals/[dealId] without auth redirects to /login', async ({ page }) => {
    await page.goto('/deals/00000000-0000-7000-8000-000000000001');
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
