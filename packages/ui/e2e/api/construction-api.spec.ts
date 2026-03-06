import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID } from '../helpers/test-data';

test.describe('Construction API', () => {
  test('GET /api/deals/:id/construction returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/construction`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('construction response has budget data', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/construction`);
    const body = await res.json();
    const jsonStr = JSON.stringify(body).toLowerCase();
    expect(jsonStr).toMatch(/budget|spend|variance|line/);
  });
});
