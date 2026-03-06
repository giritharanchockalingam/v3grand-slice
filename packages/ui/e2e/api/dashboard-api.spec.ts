import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID, DEAL_NAME } from '../helpers/test-data';

test.describe('Dashboard API', () => {
  test('GET /api/deals/:id/dashboard returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/dashboard`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('dashboard response contains deal info', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/dashboard`);
    const body = await res.json();
    // Should contain deal name somewhere in the response
    const jsonStr = JSON.stringify(body);
    expect(jsonStr).toContain(DEAL_NAME);
  });

  test('dashboard response has recommendation data', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/dashboard`);
    const body = await res.json();
    // Should have recommendation-related keys
    const jsonStr = JSON.stringify(body).toLowerCase();
    expect(jsonStr).toMatch(/recommendation|verdict|proforma/);
  });
});
