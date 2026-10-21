// End-to-end check that the seed accounts can actually log in through the
// real auth API (CSQP-5 + CSQP-8). Uses the real seeded test database, not mocks.

const request = require('supertest');
const app = require('../app');
const { DEFAULT_SEED_PASSWORD } = require('../seed/seed');
const { SEED_USERS } = require('../seed/users');
const { useSeededDatabase } = require('../test-utils/testDb');

useSeededDatabase();

describe('seed accounts can log in (CSQP-5)', () => {
  it.each(SEED_USERS.map((u) => [u.role, u.email]))(
    '%s %s logs in and gets an access token',
    async (role, email) => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: DEFAULT_SEED_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email, role });
    },
  );

  it('still rejects a wrong password for a seed account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@pes.edu', password: 'WrongPassword9' });

    expect(res.status).toBe(401);
  });
});
