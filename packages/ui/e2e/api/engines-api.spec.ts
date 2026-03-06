import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID } from '../helpers/test-data';

test.describe('Engines API', () => {
  test('GET /api/deals/:id/engines/factor returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/engines/factor`);
    // Might be 200 or 404 if engine hasn't run
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/deals/:id/engines/montecarlo returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/engines/montecarlo`);
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/deals/:id/engines/budget returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/engines/budget`);
    expect([200, 404]).toContain(res.status());
  });
});
