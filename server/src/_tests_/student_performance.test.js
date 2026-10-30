// CSQP-27 / CSQP-F-040: student performance dashboard API (TC-Perf-01).
// The Python service is mocked here (STP 10); its maths has its own pytest suite.

jest.mock('../services/analyticsClient', () => {
  const actual = jest.requireActual('../services/analyticsClient');
  return { ...actual, getStudentSummary: jest.fn() };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const analyticsClient = require('../services/analyticsClient');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const tokenFor = (u) =>
  jwt.sign({ id: u._id.toString(), email: u.email, role: u.role, name: u.name }, JWT_SECRET, {
    expiresIn: '1h',
  });

describe('GET /api/analytics/me (CSQP-27)', () => {
  let student, otherStudent, instructor, quiz, questions;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await clearTestDb();
    analyticsClient.getStudentSummary.mockReset();
    analyticsClient.getStudentSummary.mockImplementation(async (payload) => ({
      studentId: payload.studentId,
      attemptsCompleted: payload.attempts.length,
    }));

    instructor = await User.create({
      name: 'Prof Rao', email: 'prof@pes.edu', password: 'x', role: 'instructor', isVerified: true,
    });
    student = await User.create({
      name: 'Asha Rao', email: 'asha@pes.edu', password: 'x', role: 'student', isVerified: true,
    });
    otherStudent = await User.create({
      name: 'Kiran', email: 'kiran@pes.edu', password: 'x', role: 'student', isVerified: true,
    });

    const base = { type: 'MCQ', options: ['A', 'B', 'C', 'D'], subject: 'DSA', difficulty: 'easy',
      status: 'approved', createdBy: instructor._id };
    questions = await Question.create([
      { ...base, text: 'Q1', answer: 'A', topic: 'Trees' },
      { ...base, text: 'Q2', answer: 'B', topic: 'Trees' },
      { ...base, text: 'Q3', answer: 'C', topic: 'Graphs' },
    ]);
    quiz = await Quiz.create({
      title: 'DSA Quiz 1', subject: 'DSA', questions: questions.map((q) => q._id), duration: 10,
      createdBy: instructor._id, isPublished: true,
    });
  });

  async function takeQuiz(user, answers) {
    const token = tokenFor(user);
    const start = await request(app)
      .post(`/api/quizzes/${quiz._id}/attempts`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(start.status).toBe(201);
    const byText = Object.fromEntries(questions.map((q) => [q._id.toString(), q.text]));
    const responses = start.body.attempt.questions.map((q) => ({
      question: q.question,
      answer: answers[byText[q.question.toString()]] || '',
    }));
    const submit = await request(app)
      .post(`/api/attempts/${start.body.attempt.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ responses });
    expect(submit.status).toBe(200);
    return submit.body;
  }

  it('requires login', async () => {
    const res = await request(app).get('/api/analytics/me');
    expect(res.status).toBe(401);
  });

  it('is for students only', async () => {
    const res = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${tokenFor(instructor)}`);
    expect(res.status).toBe(403);
  });

  it('sends an empty history for a student with no attempts', async () => {
    const res = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(analyticsClient.getStudentSummary).toHaveBeenCalledWith({
      studentId: student._id.toString(),
      attempts: [],
    });
  });

  it('includes a quiz right after it is submitted, graded per question and topic', async () => {
    // Q1 right, Q2 wrong (lowercase "a" vs key "B"), Q3 right with different case/spaces
    await takeQuiz(student, { Q1: 'A', Q2: 'a', Q3: ' c ' });

    const started = Date.now();
    const res = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(res.status).toBe(200);

    const [payload] = analyticsClient.getStudentSummary.mock.calls[0];
    expect(payload.attempts).toHaveLength(1);
    const [attempt] = payload.attempts;
    expect(attempt).toMatchObject({
      quizId: quiz._id.toString(),
      quizTitle: 'DSA Quiz 1',
      subject: 'DSA',
      score: 2,
      totalQuestions: 3,
    });
    const tally = attempt.questions.reduce((acc, q) => {
      acc[q.topic] = acc[q.topic] || { right: 0, total: 0 };
      acc[q.topic].total += 1;
      acc[q.topic].right += q.correct ? 1 : 0;
      return acc;
    }, {});
    expect(tally).toEqual({ Trees: { right: 1, total: 2 }, Graphs: { right: 1, total: 1 } });
  });

  it('never sends answer keys to the analytics service', async () => {
    await takeQuiz(student, { Q1: 'A', Q2: 'B', Q3: 'C' });
    await request(app).get('/api/analytics/me').set('Authorization', `Bearer ${tokenFor(student)}`);
    const json = JSON.stringify(analyticsClient.getStudentSummary.mock.calls[0][0]);
    expect(json).not.toMatch(/"answer"/);
  });

  it("only uses the logged-in student's submitted attempts", async () => {
    await takeQuiz(otherStudent, { Q1: 'A', Q2: 'B', Q3: 'C' });
    // An unfinished attempt must not count
    await request(app)
      .post(`/api/quizzes/${quiz._id}/attempts`)
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .send({});

    await request(app).get('/api/analytics/me').set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(analyticsClient.getStudentSummary.mock.calls[0][0].attempts).toEqual([]);
  });

  it('returns 503 with a clear message when the analytics service is down', async () => {
    analyticsClient.getStudentSummary.mockRejectedValue(
      new analyticsClient.AnalyticsUnavailableError('The analytics service is not reachable.'),
    );
    const res = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${tokenFor(student)}`);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: 'ANALYTICS_UNAVAILABLE' });
  });
});

describe('analyticsClient (CSQP-27)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ANALYTICS_URL;
    delete process.env.ANALYTICS_INTERNAL_TOKEN;
  });

  const { getStudentSummary } = jest.requireActual('../services/analyticsClient');

  it('posts to the analytics service with the internal token', async () => {
    process.env.ANALYTICS_URL = 'http://analytics.test:9000/';
    process.env.ANALYTICS_INTERNAL_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) });

    await expect(getStudentSummary({ studentId: 's', attempts: [] })).resolves.toEqual({ ok: 1 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('http://analytics.test:9000/api/students/summary');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Internal-Token']).toBe('tok');
  });

  it('turns network failures and HTTP errors into AnalyticsUnavailableError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getStudentSummary({})).rejects.toMatchObject({ code: 'ANALYTICS_UNAVAILABLE' });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(getStudentSummary({})).rejects.toMatchObject({ statusCode: 503 });
  });
});
