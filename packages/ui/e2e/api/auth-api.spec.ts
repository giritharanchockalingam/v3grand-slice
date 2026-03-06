import { test, expect } from '@playwright/test';
import { BASE_URL, DEMO_ACCOUNTS } from '../helpers/test-data';

test.describe('Auth API', () => {
  test('POST /api/auth/login with valid creds returns 200 and token', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: DEMO_ACCOUNTS.lead.email, password: DEMO_ACCOUNTS.lead.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(DEMO_ACCOUNTS.lead.email);
  });

  test('POST /api/auth/login with bad password returns 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: DEMO_ACCOUNTS.lead.email, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('GET /api/auth/me with valid token returns user', async ({ request }) => {
    // First get a token
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: DEMO_ACCOUNTS.lead.email, password: DEMO_ACCOUNTS.lead.password },
    });
    const { token } = await loginRes.json();

    const meRes = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(200);
    const body = await meRes.json();
    expect(body).toHaveProperty('email');
  });

  test('GET /api/auth/me without token returns 401', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
  });
});
