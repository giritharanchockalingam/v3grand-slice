import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID } from '../helpers/test-data';

test.describe('Assumptions API', () => {
  test('GET /api/deals/:id/assumptions returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/assumptions`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('assumptions response has market and financial sections', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/assumptions`);
    const body = await res.json();
    expect(body).toHaveProperty('marketAssumptions');
    expect(body).toHaveProperty('financialAssumptions');
  });

  test('market assumptions contain ADR values', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/assumptions`);
    const body = await res.json();
    const market = body.marketAssumptions;
    expect(market).toBeTruthy();
    const jsonStr = JSON.stringify(market).toLowerCase();
    expect(jsonStr).toMatch(/adr|rate|occupancy/);
  });
});
