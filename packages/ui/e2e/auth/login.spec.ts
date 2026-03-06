import { test, expect } from '../fixtures/auth.fixture';
import { DEMO_ACCOUNTS } from '../helpers/test-data';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form with email and password fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('renders all 4 quick-login demo buttons', async ({ page }) => {
    await expect(page.getByText('Lead Investor')).toBeVisible();
    await expect(page.getByText('Co-Investor')).toBeVisible();
    await expect(page.getByText('Operator')).toBeVisible();
    await expect(page.getByText('Viewer')).toBeVisible();
  });

  test('shows branding: V3 GRAND title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'V3 GRAND' })).toBeVisible();
    await expect(page.getByText('Investment Operating System')).toBeVisible();
  });

  test('successful login redirects to /deals', async ({ page }) => {
    const acct = DEMO_ACCOUNTS.lead;
    await page.locator('#email').fill(acct.email);
    await page.locator('#password').fill(acct.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/deals', { timeout: 15_000 });
    expect(page.url()).toContain('/deals');
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.locator('#email').fill('bad@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Wait for error to appear
    const errorEl = page.locator('text=Invalid credentials').or(page.locator('text=Login failed'));
    await expect(errorEl).toBeVisible({ timeout: 10_000 });
  });

  test('shows loading spinner during login', async ({ page }) => {
    const acct = DEMO_ACCOUNTS.lead;
    await page.locator('#email').fill(acct.email);
    await page.locator('#password').fill(acct.password);
    await page.locator('button[type="submit"]').click();
    // The button should briefly show "Signing in..."
    await expect(page.getByText('Signing in...')).toBeVisible({ timeout: 5_000 });
  });
});
