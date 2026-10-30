// CSQP-30 / CSQP-F-043: PDF / CSV export endpoints (TC-Perf-04).
// The Python service is mocked (STP 10); report rendering has its own pytest suite.

jest.mock('../services/analyticsClient', () => {
  const actual = jest.requireActual('../services/analyticsClient');
  return {
    ...actual,
    getStudentSummary: jest.fn(),
    getStudentReport: jest.fn(),
    getClassSummary: jest.fn(),
    getClassReport: jest.fn(),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const analyticsClient = require('../services/analyticsClient');
const User = require('../models/User');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const tokenFor = (u) =>
  jwt.sign({ id: u._id.toString(), email: u.email, role: u.role, name: u.name }, JWT_SECRET, {
    expiresIn: '1h',
  });
const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const PDF = { content: Buffer.from('%PDF-1.4 fake'), contentType: 'application/pdf', disposition: 'attachment; filename="csqp-my-progress-2026-10-30.pdf"' };
const CSV = { content: Buffer.from('﻿Summary\nA,B\n1,2\n'), contentType: 'text/csv; charset=utf-8', disposition: 'attachment; filename="csqp-class-analytics-2026-10-30.csv"' };

describe('Report export (CSQP-30)', () => {
  let student, instructor;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();
    analyticsClient.getStudentReport.mockResolvedValue(PDF);
    analyticsClient.getClassReport.mockResolvedValue(CSV);
    analyticsClient.getStudentSummary.mockImplementation(async (p) => ({ fromPayload: p }));
    analyticsClient.getClassSummary.mockImplementation(async (p) => ({ fromPayload: p }));
    student = await User.create({ name: 'Asha Rao', email: 'asha@pes.edu', password: 'x', role: 'student', isVerified: true });
    instructor = await User.create({ name: 'Prof Rao', email: 'prof@pes.edu', password: 'x', role: 'instructor', isVerified: true });
  });

  const get = (url, user) => {
    const r = request(app).get(url).buffer(true).parse(binary);
    return user ? r.set('Authorization', `Bearer ${tokenFor(user)}`) : r;
  };

  it('student downloads their report as a PDF file', async () => {
    const res = await get('/api/analytics/me/export?format=pdf', student);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="csqp-my-progress-');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.toString()).toBe('%PDF-1.4 fake');

    const [payload, format] = analyticsClient.getStudentReport.mock.calls[0];
    expect(format).toBe('pdf');
    expect(payload).toMatchObject({ studentId: student._id.toString(), studentName: 'Asha Rao', attempts: [] });
  });

  it('PDF is the default format', async () => {
    await get('/api/analytics/me/export', student);
    expect(analyticsClient.getStudentReport.mock.calls[0][1]).toBe('pdf');
  });

  it('export uses exactly the same data as the on-screen dashboard', async () => {
    await get('/api/analytics/me', student);
    await get('/api/analytics/me/export?format=csv', student);
    const screen = analyticsClient.getStudentSummary.mock.calls[0][0];
    const { studentName, ...exported } = analyticsClient.getStudentReport.mock.calls[0][0];
    expect(studentName).toBe('Asha Rao');
    expect(exported).toEqual(screen);

    await get('/api/analytics/class', instructor);
    await get('/api/analytics/class/export?format=csv', instructor);
    const classScreen = analyticsClient.getClassSummary.mock.calls[0][0];
    const { instructorName, ...classExported } = analyticsClient.getClassReport.mock.calls[0][0];
    expect(instructorName).toBe('Prof Rao');
    expect(classExported).toEqual(classScreen);
  });

  it('instructor downloads class analytics as CSV', async () => {
    const res = await get('/api/analytics/class/export?format=CSV', instructor);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toContain('.csv"');
    expect(analyticsClient.getClassReport.mock.calls[0][1]).toBe('csv');
  });

  it('rejects unknown formats', async () => {
    const res = await request(app)
      .get('/api/analytics/me/export?format=docx')
      .set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_FORMAT');
    expect(analyticsClient.getStudentReport).not.toHaveBeenCalled();
  });

  it('enforces roles: students cannot export class analytics, instructors cannot export /me', async () => {
    expect((await get('/api/analytics/me/export')).status).toBe(401);
    expect((await get('/api/analytics/class/export', student)).status).toBe(403);
    expect((await get('/api/analytics/me/export', instructor)).status).toBe(403);
  });

  it('returns 503 when the analytics service is down', async () => {
    analyticsClient.getClassReport.mockRejectedValue(new analyticsClient.AnalyticsUnavailableError('down'));
    const res = await request(app)
      .get('/api/analytics/class/export?format=pdf')
      .set('Authorization', `Bearer ${tokenFor(instructor)}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ANALYTICS_UNAVAILABLE');
  });
});

describe('analyticsClient.getStudentReport (CSQP-30)', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });
  const { getStudentReport } = jest.requireActual('../services/analyticsClient');

  it('returns bytes and headers from the analytics service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/pdf'], ['content-disposition', 'attachment; filename="x.pdf"']]),
      arrayBuffer: async () => new TextEncoder().encode('%PDF').buffer,
    });
    const file = await getStudentReport({ studentId: 's' }, 'pdf');
    expect(global.fetch.mock.calls[0][0]).toBe('http://localhost:8001/api/reports/student?format=pdf');
    expect(file.content.toString()).toBe('%PDF');
    expect(file.contentType).toBe('application/pdf');
    expect(file.disposition).toBe('attachment; filename="x.pdf"');
  });
});

describe('CORS for report downloads (CSQP-30)', () => {
  it('exposes Content-Disposition so the browser can read the file name', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });
});
