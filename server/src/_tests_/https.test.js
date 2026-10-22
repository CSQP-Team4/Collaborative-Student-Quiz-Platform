
const request = require('supertest');

describe('HTTPS enforcement (TC-Sec-01)', () => {
  let app;
  let originalNodeEnv;
  let originalHttpsMode;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalHttpsMode = process.env.HTTPS_MODE;

    process.env.NODE_ENV = 'production';
    process.env.HTTPS_MODE = 'proxy';

    jest.isolateModules(() => {
      app = require('../app');
    });
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalHttpsMode === undefined) {
      delete process.env.HTTPS_MODE;
    } else {
      process.env.HTTPS_MODE = originalHttpsMode;
    }
  });

  test('rejects requests that do not use HTTPS', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('HTTPS_REQUIRED');
    expect(response.body.message).toBe('HTTPS is required.');
  });
});
