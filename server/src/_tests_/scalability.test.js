const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

const TOTAL_USERS = 5000;
const CONCURRENT_ATTEMPTS = 500;
const LOGIN_SAMPLE = 50;
const PASSWORD = 'TestPassword123!';

function calculatePercentiles(latencies) {
  if (!latencies.length) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const getP = (p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
  const r = (n) => Math.round(n * 10) / 10;
  return {
    min: r(sorted[0]),
    max: r(sorted[sorted.length - 1]),
    avg: r(sum / sorted.length),
    p50: r(getP(50)),
    p90: r(getP(90)),
    p95: r(getP(95)),
    p99: r(getP(99)),
  };
}

describe('CSQP-37: Scalability - 5,000 users / 500 concurrent attempts (CSQP-NF-005 / TC-Scale-01)', () => {
  const latencies = [];
  let errors5xx = 0;
  let rateLimited = 0;

  let server;
  let quiz;
  let questions;
  let students = []; // [{ _id, email, token }]
  let attemptIds = [];

  // Times one request and records latency / error counts.
  async function timed(fn) {
    const start = process.hrtime.bigint();
    const res = await fn();
    latencies.push(Number(process.hrtime.bigint() - start) / 1e6);
    if (res.status >= 500) errors5xx++;
    if (res.status === 429) rateLimited++;
    return res;
  }

  beforeAll(async () => {
    await connectTestDb();
    await clearTestDb();

    server = app.listen(0);

    // Hash once and reuse: hashing 5,000 passwords one by one would take minutes.
    const hash = await bcrypt.hash(PASSWORD, 8);

    const instructor = await User.create({
      name: 'Scale Instructor',
      email: 'scale.instructor@pes.edu',
      password: hash,
      role: 'instructor',
      isVerified: true,
    });

    const studentDocs = Array.from({ length: TOTAL_USERS }, (_, i) => ({
      name: `Scale Student ${i}`,
      email: `scale_student_${i}@pes.edu`,
      password: hash,
      role: 'student',
      isVerified: true,
    }));
    await User.insertMany(studentDocs, { ordered: false });

    questions = await Question.insertMany([
      {
        text: 'What is the time complexity of quicksort average case?',
        type: 'MCQ',
        options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'],
        answer: 'O(n log n)',
        subject: 'Algorithms',
        topic: 'Sorting',
        difficulty: 'medium',
        status: 'approved',
        createdBy: instructor._id,
      },
      {
        text: 'Which data structure uses LIFO ordering?',
        type: 'MCQ',
        options: ['Queue', 'Stack', 'Array', 'Tree'],
        answer: 'Stack',
        subject: 'Data Structures',
        topic: 'Stacks',
        difficulty: 'easy',
        status: 'approved',
        createdBy: instructor._id,
      },
    ]);

    quiz = await Quiz.create({
      title: 'Scalability Exam Quiz',
      subject: 'Computer Science',
      description: 'TC-Scale-01 load test quiz',
      duration: 30,
      questions: questions.map((q) => q._id),
      isPublished: true,
      createdBy: instructor._id,
    });

    // One token per student who will take the quiz.
    const takers = await User.find({ role: 'student' }).limit(CONCURRENT_ATTEMPTS);
    students = takers.map((s) => ({
      _id: s._id,
      email: s.email,
      token: jwt.sign(
        { id: s._id.toString(), role: 'student', email: s.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      ),
    }));
  }, 120000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
  });

  it('holds 5,000 registered users', async () => {
    const count = await User.countDocuments({ role: 'student' });
    expect(count).toBeGreaterThanOrEqual(TOTAL_USERS);
    expect(students).toHaveLength(CONCURRENT_ATTEMPTS);
  });

  it('logins still work with 5,000 users in the database', async () => {
    const step = Math.floor(TOTAL_USERS / LOGIN_SAMPLE);
    const tasks = Array.from({ length: LOGIN_SAMPLE }, async (_, i) => {
      const res = await timed(() =>
        request(server)
          .post('/api/auth/login')
          .send({ email: `scale_student_${i * step}@pes.edu`, password: PASSWORD })
      );
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
    await Promise.all(tasks);
  }, 120000);

  it('500 students start a quiz attempt at the same time', async () => {
    const results = await Promise.all(
      students.map(({ token }) =>
        timed(() =>
          request(server)
            .post(`/api/quizzes/${quiz._id}/attempts`)
            .set('Authorization', `Bearer ${token}`)
        )
      )
    );

    results.forEach((res) => expect(res.status).toBe(201));
    attemptIds = results.map((res) => res.body.attempt.id);
    expect(new Set(attemptIds).size).toBe(CONCURRENT_ATTEMPTS);

    // All 500 attempts exist at once, and none has been submitted yet.
    const open = await QuizAttempt.countDocuments({ quiz: quiz._id });
    expect(open).toBe(CONCURRENT_ATTEMPTS);
  }, 120000);

  it('500 students submit and are auto-graded at the same time', async () => {
    const results = await Promise.all(
      students.map(({ token }, i) =>
        timed(() =>
          request(server)
            .post(`/api/attempts/${attemptIds[i]}/submit`)
            .set('Authorization', `Bearer ${token}`)
            .send({
              responses: [
                { question: questions[0]._id.toString(), selectedOption: 'O(n log n)' },
                { question: questions[1]._id.toString(), selectedOption: 'Stack' },
              ],
            })
        )
      )
    );

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.score).toBe(2);
    });
  }, 120000);

  it('TC-Scale-01 Summary: 5,000 users / 500 concurrent attempts meet CSQP-NF-001 (p90 <= 2s, 0 HTTP 5xx)', () => {
    expect(latencies.length).toBeGreaterThanOrEqual(LOGIN_SAMPLE + CONCURRENT_ATTEMPTS * 2);
    expect(errors5xx).toBe(0);
    expect(rateLimited).toBe(0);

    const stats = calculatePercentiles(latencies);
    console.log('\n================================================================');
    console.log('     CSQP-NF-005 / TC-Scale-01 SCALABILITY LOAD TEST');
    console.log('================================================================');
    console.log(`Registered users:       ${TOTAL_USERS}`);
    console.log(`Concurrent attempts:    ${CONCURRENT_ATTEMPTS}`);
    console.log(`Total requests:         ${latencies.length}`);
    console.log(`HTTP 5xx errors:        ${errors5xx}`);
    console.log(`HTTP 429 (rate limited): ${rateLimited}`);
    console.log(`Min / Avg:              ${stats.min} ms / ${stats.avg} ms`);
    console.log(`p50:                    ${stats.p50} ms`);
    console.log(`p90:                    ${stats.p90} ms  [Target: <= 2000 ms]`);
    console.log(`p95 / p99:              ${stats.p95} ms / ${stats.p99} ms`);
    console.log(`Max:                    ${stats.max} ms`);
    console.log('================================================================\n');

    expect(stats.p90).toBeLessThanOrEqual(2000);
  });
});
