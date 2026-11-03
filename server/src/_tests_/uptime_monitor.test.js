// CSQP-35 / CSQP-NF-002: uptime probe and the admin ops API.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const UptimeCheck = require('../models/UptimeCheck');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const { checkOnce, recordCheck } = require('../monitoring/uptimeMonitor');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const tokenFor = (u) => jwt.sign({ id: u._id.toString(), email: u.email, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '1h' });
const fakeFetch = (status, body) => jest.fn().mockResolvedValue({ status, json: async () => body });

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  await UptimeCheck.deleteMany({});
  await MaintenanceWindow.deleteMany({});
});

describe('checkOnce (CSQP-35)', () => {
  it('healthy when /api/health returns 200 and the database is connected', async () => {
    const r = await checkOnce({ url: 'http://x/api/health', fetchImpl: fakeFetch(200, { status: 'ok', mongodb: 'connected' }) });
    expect(r).toMatchObject({ ok: true, statusCode: 200, error: '', target: 'http://x/api/health' });
    expect(typeof r.responseMs).toBe('number');
  });

  it('down when the API is up but MongoDB is disconnected', async () => {
    const r = await checkOnce({ fetchImpl: fakeFetch(200, { status: 'ok', mongodb: 'disconnected' }) });
    expect(r).toMatchObject({ ok: false, error: 'Database disconnected' });
  });

  it('down on an HTTP error', async () => {
    const r = await checkOnce({ fetchImpl: fakeFetch(503, {}) });
    expect(r).toMatchObject({ ok: false, statusCode: 503, error: 'HTTP 503' });
  });

  it('down when the API cannot be reached', async () => {
    const r = await checkOnce({ fetchImpl: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) });
    expect(r).toMatchObject({ ok: false, statusCode: null });
    expect(r.error).toMatch(/Unreachable: connect ECONNREFUSED/);
  });

  it('down on a timeout', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const r = await checkOnce({ timeoutMs: 50, fetchImpl: jest.fn().mockRejectedValue(timeout) });
    expect(r.error).toBe('Timed out after 50 ms');
  });

  it('works against the real /api/health endpoint and stores the result', async () => {
    const server = app.listen(0);
    try {
      const { port } = server.address();
      const r = await recordCheck({ url: `http://127.0.0.1:${port}/api/health` });
      expect(r.ok).toBe(true);
      const saved = await UptimeCheck.find();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ ok: true, statusCode: 200 });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('Ops API (CSQP-35)', () => {
  let admin, instructor;
  beforeEach(async () => {
    admin = await User.create({ name: 'Admin', email: 'admin@pes.edu', password: 'x', role: 'admin', isVerified: true });
    instructor = await User.create({ name: 'Prof', email: 'prof@pes.edu', password: 'x', role: 'instructor', isVerified: true });
  });

  const report = (user) => request(app).get('/api/ops/uptime').set('Authorization', `Bearer ${tokenFor(user)}`);
  const schedule = (user, body) => request(app).post('/api/ops/maintenance').set('Authorization', `Bearer ${tokenFor(user)}`).send(body);

  it('is for admins only', async () => {
    expect((await request(app).get('/api/ops/uptime')).status).toBe(401);
    expect((await report(instructor)).status).toBe(403);
    expect((await schedule(instructor, {})).status).toBe(403);
  });

  it('reports this month\'s availability from recorded checks', async () => {
    const now = Date.now();
    const docs = Array.from({ length: 200 }, (_, i) => ({
      checkedAt: new Date(now - (200 - i) * 1000),
      ok: i !== 50,
      statusCode: i === 50 ? 500 : 200,
      error: i === 50 ? 'HTTP 500' : '',
    }));
    await UptimeCheck.insertMany(docs);

    const res = await report(admin);
    expect(res.status).toBe(200);
    expect(res.body.target).toBe(99.5);
    const month = res.body.months.find((m) => m.checks > 0);
    // 199 healthy of 200 = 99.5%
    expect(month).toMatchObject({ checks: 200, healthy: 199, failed: 1, availability: 99.5, meetsTarget: true });
    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.latest).toMatchObject({ ok: true, statusCode: 200 });
  });

  it('shows an empty report before the monitor has run', async () => {
    const res = await report(admin);
    expect(res.body).toMatchObject({ months: [], incidents: [], latest: null, maintenance: [] });
  });

  it('schedules maintenance announced at least 24 h ahead', async () => {
    const start = new Date(Date.now() + 25 * 3600 * 1000);
    const end = new Date(start.getTime() + 3600 * 1000);
    const res = await schedule(admin, { start, end, reason: 'Database upgrade' });
    expect(res.status).toBe(201);
    expect(res.body.maintenance).toMatchObject({ reason: 'Database upgrade', excludedFromTarget: true });
    expect((await report(admin)).body.maintenance).toHaveLength(1);
  });

  it('rejects maintenance with less than 24 h notice and bad input', async () => {
    const soon = new Date(Date.now() + 2 * 3600 * 1000);
    const late = await schedule(admin, { start: soon, end: new Date(soon.getTime() + 3600e3), reason: 'Patch' });
    expect(late.status).toBe(400);
    expect(late.body.error).toBe('NOTICE_TOO_SHORT');

    const start = new Date(Date.now() + 48 * 3600 * 1000);
    expect((await schedule(admin, { start, end: start, reason: 'x' })).status).toBe(400);
    expect((await schedule(admin, { start, end: new Date(start.getTime() + 1), reason: '  ' })).status).toBe(400);
    expect((await schedule(admin, { start: 'nope', end: 'nope', reason: 'x' })).status).toBe(400);
    expect(await MaintenanceWindow.countDocuments()).toBe(0);
  });
});
