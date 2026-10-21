
const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('returns API status, MongoDB status, and memory usage', async () => {
    const response = await request(app).get('/api/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('mongodb');
    expect(response.body).toHaveProperty('memoryUsage');
    expect(response.body.memoryUsage).toHaveProperty('rss');
    expect(response.body.memoryUsage).toHaveProperty('heapUsed');
    expect(response.body.memoryUsage).toHaveProperty('heapTotal');
    expect(response.body.memoryUsage).toHaveProperty('external');
  });
});
