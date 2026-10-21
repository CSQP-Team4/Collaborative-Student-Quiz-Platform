
const request = require('supertest');
const app = require('../app');

describe('CSQP-3: Centralized error handling and request logging', () => {
  test('unknown routes return the standardized JSON error format', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      error: 'NOT_FOUND',
    });
    expect(response.body.message).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(response.headers['x-request-id']).toBeDefined();
  });

  test('health endpoint includes a request ID', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
