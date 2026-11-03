// CSQP-28 / CSQP-F-041: instructor class analytics API (TC-Perf-02).
// The Python service is mocked here (STP 10); its maths has its own pytest suite.

jest.mock('../services/analyticsClient', () => {
  const actual = jest.requireActual('../services/analyticsClient');
  return { ...actual, getClassSummary: jest.fn() };
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
const lastPayload = () => analyticsClient.getClassSummary.mock.calls.at(-1)[0];

describe('GET /api/analytics/class (CSQP-28)', () => {
  let instructor, otherInstructor, admin, students, myQuiz, otherQuiz, questions;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await clearTestDb();
    analyticsClient.getClassSummary.mockReset();
    analyticsClient.getClassSummary.mockResolvedValue({ totalStudents: 0, quizzes: [] });

    const mk = (name, email, role) => User.create({ name, email, password: 'x', role, isVerified: true });
    instructor = await mk('Prof Rao', 'prof@pes.edu', 'instructor');
    otherInstructor = await mk('Prof Iyer', 'iyer@pes.edu', 'instructor');
    admin = await mk('Admin', 'admin@pes.edu', 'admin');
    students = await Promise.all([1, 2, 3, 4].map((i) => mk(`S${i}`, `s${i}@pes.edu`, 'student')));

    const base = { type: 'MCQ', options: ['A', 'B', 'C', 'D'], subject: 'DSA', difficulty: 'easy',
      status: 'approved', createdBy: instructor._id };
    questions = await Question.create([
      { ...base, text: 'Q1', answer: 'A', topic: 'Trees' },
      { ...base, text: 'Q2', answer: 'B', topic: 'Graphs' },
    ]);
    const quizBase = { subject: 'DSA', questions: questions.map((q) => q._id), duration: 10, isPublished: true };
    myQuiz = await Quiz.create({ ...quizBase, title: 'My quiz', createdBy: instructor._id });
    otherQuiz = await Quiz.create({ ...quizBase, title: 'Other quiz', createdBy: otherInstructor._id });
  });

  async function takeQuiz(student, quiz, answers) {
    const token = tokenFor(student);
    const start = await request(app)
      .post(`/api/quizzes/${quiz._id}/attempts`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(start.status).toBe(201);
    const textById = Object.fromEntries(questions.map((q) => [q._id.toString(), q.text]));
    const responses = start.body.attempt.questions.map((q) => ({
      question: q.question,
      answer: answers[textById[q.question.toString()]] || '',
    }));
    const submit = await request(app)
      .post(`/api/attempts/${start.body.attempt.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ responses });
    expect(submit.status).toBe(200);
  }

  const get = (user) => request(app).get('/api/analytics/class').set('Authorization', `Bearer ${tokenFor(user)}`);

  it('requires login and an instructor or admin role', async () => {
    expect((await request(app).get('/api/analytics/class')).status).toBe(401);
    expect((await get(students[0])).status).toBe(403);
    expect((await get(instructor)).status).toBe(200);
    expect((await get(admin)).status).toBe(200);
  });

  it("covers only the instructor's own quizzes; admins see all", async () => {
    await get(instructor);
    expect(lastPayload().quizzes.map((q) => q.title)).toEqual(['My quiz']);
    await get(admin);
    expect(lastPayload().quizzes.map((q) => q.title)).toEqual(['My quiz', 'Other quiz']);
  });

  it('sends class size and graded attempts, recomputed after each submission', async () => {
    await takeQuiz(students[0], myQuiz, { Q1: 'A', Q2: 'B' });
    await takeQuiz(students[1], myQuiz, { Q1: 'A', Q2: 'x' });
    await takeQuiz(students[2], otherQuiz, { Q1: 'A', Q2: 'B' }); // not this instructor's quiz

    await get(instructor);
    let payload = lastPayload();
    expect(payload.totalStudents).toBe(4);
    expect(payload.quizzes[0]).toEqual({ quizId: myQuiz._id.toString(), title: 'My quiz', subject: 'DSA', questionCount: 2 });
    expect(payload.attempts).toHaveLength(2);
    const s2 = payload.attempts.find((a) => a.studentId === students[1]._id.toString());
    expect(s2.score).toBe(1);
    const q2 = s2.questions.find((q) => q.text === 'Q2');
    expect(q2).toMatchObject({ questionId: questions[1]._id.toString(), topic: 'Graphs', correct: false });

    // A new submission shows up on the very next request
    await takeQuiz(students[3], myQuiz, { Q1: 'x', Q2: 'x' });
    await get(instructor);
    payload = lastPayload();
    expect(payload.attempts).toHaveLength(3);
  });

  it('never sends answer keys to the analytics service', async () => {
    await takeQuiz(students[0], myQuiz, { Q1: 'A', Q2: 'B' });
    await get(instructor);
    expect(JSON.stringify(lastPayload())).not.toMatch(/"answer"/);
  });

  it('returns the analytics result to the client', async () => {
    analyticsClient.getClassSummary.mockResolvedValue({ totalStudents: 4, quizzes: [{ quizId: 'x', averageScore: 50 }] });
    const res = await get(instructor);
    expect(res.body).toMatchObject({ success: true, summary: { totalStudents: 4, quizzes: [{ averageScore: 50 }] } });
  });

  it('returns 503 when the analytics service is down', async () => {
    analyticsClient.getClassSummary.mockRejectedValue(
      new analyticsClient.AnalyticsUnavailableError('The analytics service is not reachable.'),
    );
    const res = await get(instructor);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ANALYTICS_UNAVAILABLE');
  });
});
