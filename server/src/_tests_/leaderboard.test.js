// CSQP-29 / CSQP-F-042: opt-in leaderboard API (TC-Perf-03).
// The Python service is mocked (STP 10): the mock ranks whoever Express sends,
// so these tests prove opted-out students are never sent at all.

jest.mock('../services/analyticsClient', () => {
  const actual = jest.requireActual('../services/analyticsClient');
  return { ...actual, getLeaderboard: jest.fn() };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const analyticsClient = require('../services/analyticsClient');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const tokenFor = (u) =>
  jwt.sign({ id: u._id.toString(), email: u.email, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '1h' });
const sentIds = () => [...new Set(analyticsClient.getLeaderboard.mock.calls.at(-1)[0].attempts.map((a) => a.studentId))].sort();

describe('Leaderboard (CSQP-29)', () => {
  let asha, kiran, hidden, instructor, dsQuiz, dsQuiz2, osQuiz, draftQuiz;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await clearTestDb();
    analyticsClient.getLeaderboard.mockReset();
    // Fake ranking: one entry per student sent, in the order received.
    analyticsClient.getLeaderboard.mockImplementation(async ({ scope, label, attempts }) => {
      const seen = new Map();
      attempts.forEach((a) => seen.set(a.studentId, a.studentName));
      return {
        scope,
        label,
        entries: [...seen].map(([studentId, name], i) => ({ rank: i + 1, studentId, name, score: 50, quizzes: 1, attempts: 1 })),
      };
    });

    const mk = (name, email, role, extra = {}) =>
      User.create({ name, email, password: 'x', role, isVerified: true, ...extra });
    instructor = await mk('Prof', 'prof@pes.edu', 'instructor');
    asha = await mk('Asha', 'asha@pes.edu', 'student', { leaderboardOptIn: true });
    kiran = await mk('Kiran', 'kiran@pes.edu', 'student', { leaderboardOptIn: true });
    hidden = await mk('Hidden', 'hidden@pes.edu', 'student'); // default: not opted in

    const q = await Question.create({
      type: 'MCQ', text: 'Q', options: ['A', 'B'], answer: 'A', subject: 'DSA', topic: 'Trees',
      difficulty: 'easy', status: 'approved', createdBy: instructor._id,
    });
    const quiz = (title, subject, isPublished = true) =>
      Quiz.create({ title, subject, questions: [q._id], duration: 5, createdBy: instructor._id, isPublished });
    dsQuiz = await quiz('DS Quiz 1', 'DSA');
    dsQuiz2 = await quiz('DS Quiz 2', 'DSA');
    osQuiz = await quiz('OS Quiz', 'Operating Systems');
    draftQuiz = await quiz('Draft', 'DSA', false);

    const attempt = (student, quizDoc, score) =>
      QuizAttempt.create({
        student: student._id, quiz: quizDoc._id, status: 'submitted', score,
        shuffledQuestions: [{ question: q._id, text: 'Q', type: 'MCQ', options: ['A', 'B'] }],
        submittedAt: new Date(),
      });
    await attempt(asha, dsQuiz, 1);
    await attempt(kiran, dsQuiz, 0);
    await attempt(hidden, dsQuiz, 1);
    await attempt(asha, osQuiz, 1);
    await attempt(kiran, dsQuiz2, 1);
  });

  const get = (user, query = '') =>
    request(app).get(`/api/leaderboard${query}`).set('Authorization', `Bearer ${tokenFor(user)}`);

  it('requires login', async () => {
    expect((await request(app).get('/api/leaderboard')).status).toBe(401);
  });

  it('new accounts are hidden by default (opt-in, not opt-out)', async () => {
    const fresh = await User.create({ name: 'New', email: 'new@pes.edu', password: 'x', role: 'student' });
    expect(fresh.leaderboardOptIn).toBe(false);
  });

  it('defaults to the first published quiz and lists the options', async () => {
    const res = await get(asha);
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('quiz');
    expect(res.body.label).toBe('DS Quiz 1');
    expect(res.body.options.quizzes.map((x) => x.title)).toEqual(['DS Quiz 1', 'DS Quiz 2', 'OS Quiz']);
    expect(res.body.options.subjects).toEqual(['DSA', 'Operating Systems']);
  });

  it('excludes students who opted out', async () => {
    const res = await get(asha, `?scope=quiz&id=${dsQuiz._id}`);
    expect(sentIds()).toEqual([asha._id, kiran._id].map(String).sort());
    expect(res.body.entries.map((e) => e.name).sort()).toEqual(['Asha', 'Kiran']);
    expect(JSON.stringify(res.body)).not.toContain('Hidden');
  });

  it('ranks per subject across all its published quizzes', async () => {
    const res = await get(kiran, '?scope=subject&id=DSA');
    expect(res.body.label).toBe('DSA');
    const quizIdsSent = new Set(analyticsClient.getLeaderboard.mock.calls[0][0].attempts.map((a) => a.quizId));
    expect(quizIdsSent).toEqual(new Set([dsQuiz._id.toString(), dsQuiz2._id.toString()]));
    expect(analyticsClient.getLeaderboard.mock.calls[0][0].scope).toBe('subject');
  });

  it('flags the viewer\'s own row and never returns student IDs', async () => {
    const res = await get(asha, `?id=${dsQuiz._id}`);
    const mine = res.body.entries.find((e) => e.isYou);
    expect(mine.name).toBe('Asha');
    expect(res.body.entries.every((e) => !('studentId' in e))).toBe(true);
    expect(res.body.viewerOptedIn).toBe(true);
  });

  it('tells an opted-out student they are hidden, and instructors get null', async () => {
    expect((await get(hidden)).body.viewerOptedIn).toBe(false);
    expect((await get(instructor)).body.viewerOptedIn).toBeNull();
  });

  it('validates scope and ids; unpublished quizzes are not available', async () => {
    expect((await get(asha, '?scope=class')).status).toBe(400);
    expect((await get(asha, '?id=not-an-id')).status).toBe(400);
    expect((await get(asha, `?id=${draftQuiz._id}`)).status).toBe(404);
    expect((await get(asha, '?scope=subject&id=Chemistry')).status).toBe(404);
  });

  it('returns 503 when the analytics service is down', async () => {
    analyticsClient.getLeaderboard.mockRejectedValue(new analyticsClient.AnalyticsUnavailableError('down'));
    const res = await get(asha);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ANALYTICS_UNAVAILABLE');
  });

  describe('opt-in setting', () => {
    const settings = (user) => request(app).get('/api/leaderboard/settings').set('Authorization', `Bearer ${tokenFor(user)}`);
    const update = (user, body) =>
      request(app).put('/api/leaderboard/settings').set('Authorization', `Bearer ${tokenFor(user)}`).send(body);

    it('reads and updates the choice; opting in makes the student appear', async () => {
      expect((await settings(hidden)).body.optIn).toBe(false);

      const res = await update(hidden, { optIn: true });
      expect(res.status).toBe(200);
      expect(res.body.optIn).toBe(true);
      expect((await settings(hidden)).body.optIn).toBe(true);

      await get(asha, `?id=${dsQuiz._id}`);
      expect(sentIds()).toContain(hidden._id.toString());
    });

    it('opting out removes the student straight away', async () => {
      await update(asha, { optIn: false });
      const res = await get(kiran, `?id=${dsQuiz._id}`);
      expect(res.body.entries.map((e) => e.name)).toEqual(['Kiran']);
    });

    it('rejects anything that is not true/false', async () => {
      expect((await update(asha, { optIn: 'yes' })).status).toBe(400);
      expect((await update(asha, {})).status).toBe(400);
    });

    it('is for students only', async () => {
      expect((await settings(instructor)).status).toBe(403);
      expect((await update(instructor, { optIn: true })).status).toBe(403);
    });
  });
});
