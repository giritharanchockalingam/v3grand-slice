import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID } from '../helpers/test-data';

test.describe('Scenarios API', () => {
  test('GET /api/deals/:id/scenarios returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/scenarios`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('scenarios response has bear/base/bull', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/scenarios`);
    const body = await res.json();
    const jsonStr = JSON.stringify(body).toLowerCase();
    expect(jsonStr).toMatch(/bear|base|bull/);
  });
});
