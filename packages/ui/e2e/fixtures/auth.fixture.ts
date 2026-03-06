// ─── Auth Fixture — provides pre-authenticated page & API context ───
import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import { DEMO_ACCOUNTS, type DemoRole, BASE_URL } from '../helpers/test-data';

type AuthFixtures = {
  /** A Page already logged in as Lead Investor and on /deals */
  authedPage: Page;
  /** Login helper: fills form, waits for redirect */
  loginAs: (page: Page, role: DemoRole) => Promise<void>;
  /** Get a valid JWT token for the given role via the API */
  getToken: (role?: DemoRole) => Promise<string>;
  /** APIRequestContext with auth header pre-set */
  authedRequest: APIRequestContext;
};

export const test = base.extend<AuthFixtures>({

  loginAs: async ({}, use) => {
    const fn = async (page: Page, role: DemoRole) => {
      const acct = DEMO_ACCOUNTS[role];
      await page.goto('/login');
      await page.locator('#email').fill(acct.email);
      await page.locator('#password').fill(acct.password);
      await page.locator('button[type="submit"]').click();
      // Wait for redirect to /deals
      await page.waitForURL('**/deals', { timeout: 15_000 });
    };
    await use(fn);
  },

  getToken: async ({ playwright }, use) => {
    const fn = async (role: DemoRole = 'lead') => {
      const acct = DEMO_ACCOUNTS[role];
      const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
      const res = await ctx.post('/api/auth/login', {
        data: { email: acct.email, password: acct.password },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      await ctx.dispose();
      return body.token as string;
    };
    await use(fn);
  },

  authedRequest: async ({ playwright, getToken }, use) => {
    const token = await getToken('lead');
    const ctx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(ctx);
    await ctx.dispose();
  },

  authedPage: async ({ page, loginAs }, use) => {
    await loginAs(page, 'lead');
    await use(page);
  },
});

export { expect };
