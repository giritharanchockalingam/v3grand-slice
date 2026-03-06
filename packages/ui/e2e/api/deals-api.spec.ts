import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID, DEAL_NAME } from '../helpers/test-data';

test.describe('Deals API', () => {
  test('GET /api/deals returns array with deals', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/deals/:id returns V3 Grand Madurai', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name || body.deal?.name).toBe(DEAL_NAME);
  });

  test('GET /api/deals/invalid-id returns 404', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/00000000-0000-0000-0000-000000000000`);
    expect([404, 400]).toContain(res.status());
  });
});
