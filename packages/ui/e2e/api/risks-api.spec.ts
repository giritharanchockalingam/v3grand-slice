import { test, expect } from '../fixtures/auth.fixture';
import { BASE_URL, DEAL_ID } from '../helpers/test-data';

test.describe('Risks API', () => {
  test('GET /api/deals/:id/risks returns 200', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/risks`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('risks response has risks array', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${BASE_URL}/api/deals/${DEAL_ID}/risks`);
    const body = await res.json();
    // Should have risks array somewhere in the response
    const hasRisks = body.risks || Array.isArray(body);
    expect(hasRisks).toBeTruthy();
  });
});
