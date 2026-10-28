const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / sorted.length;

  const getP = (p) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    avg: Math.round(avg * 10) / 10,
    p50: Math.round(getP(50) * 10) / 10,
    p90: Math.round(getP(90) * 10) / 10,
    p95: Math.round(getP(95) * 10) / 10,
    p99: Math.round(getP(99) * 10) / 10,
  };
}

describe('CSQP-32: System Response Time Benchmark (CSQP-NF-001 / TC-Perf-01)', () => {
  let testUser, testUserToken, testQuiz, testQuestions;
  const allSystemLatencies = [];
  let total500Errors = 0;

  beforeAll(async () => {
    await connectTestDb();
  }, 15000);

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create verified test user with valid bcrypt hash
    const hashedPassword = await bcrypt.hash('TestPassword123!', 8);
    testUser = await User.create({
      name: 'Benchmark Student',
      email: 'bench.student@pes.edu',
      password: hashedPassword,
      role: 'student',
      isVerified: true,
    });

    testUserToken = jwt.sign(
      { id: testUser._id.toString(), role: 'student', email: testUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create approved questions
    testQuestions = await Question.insertMany([
      {
        text: 'What is the time complexity of quicksort average case?',
        type: 'MCQ',
        options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'],
        answer: 'O(n log n)',
        subject: 'Algorithms',
        topic: 'Sorting',
        difficulty: 'medium',
        status: 'approved',
        createdBy: testUser._id,
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
        createdBy: testUser._id,
      },
    ]);

    testQuiz = await Quiz.create({
      title: 'Performance Benchmark Quiz',
      subject: 'Computer Science',
      description: 'Load test verification quiz',
      duration: 30,
      questions: testQuestions.map((q) => q._id),
      isPublished: true,
      createdBy: testUser._id,
    });
  });

  it('Scenario 1: Health check endpoint responsiveness under concurrent load (100 requests)', async () => {
    const REQUEST_COUNT = 100;
    const latencies = [];

    const tasks = Array.from({ length: REQUEST_COUNT }, async () => {
      const start = process.hrtime.bigint();
      const res = await request(app).get('/api/health');
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

      latencies.push(durationMs);
      allSystemLatencies.push(durationMs);

      if (res.status === 500) total500Errors++;
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    await Promise.all(tasks);

    const stats = calculatePercentiles(latencies);
    console.log(`\n--- Health Check Benchmark (${REQUEST_COUNT} concurrent requests) ---`);
    console.log(`Min: ${stats.min}ms | Avg: ${stats.avg}ms | p50: ${stats.p50}ms | p90: ${stats.p90}ms | p99: ${stats.p99}ms | Max: ${stats.max}ms`);

    // Verify p90 <= 2000ms SLA (CSQP-NF-001)
    expect(stats.p90).toBeLessThanOrEqual(2000);
  });

  it('Scenario 2: Auth login endpoint responsiveness under concurrent load (50 requests)', async () => {
    const REQUEST_COUNT = 50;
    const latencies = [];

    // Send requests in batches of 10 to simulate concurrent arriving logins
    const batchSize = 10;
    for (let i = 0; i < REQUEST_COUNT; i += batchSize) {
      const batch = Array.from({ length: batchSize }, async () => {
        const start = process.hrtime.bigint();
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'bench.student@pes.edu', password: 'TestPassword123!' });
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

        latencies.push(durationMs);
        allSystemLatencies.push(durationMs);

        if (res.status === 500) total500Errors++;
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
      });

      await Promise.all(batch);
    }

    const stats = calculatePercentiles(latencies);
    console.log(`\n--- Authentication Benchmark (${REQUEST_COUNT} login requests) ---`);
    console.log(`Min: ${stats.min}ms | Avg: ${stats.avg}ms | p50: ${stats.p50}ms | p90: ${stats.p90}ms | p99: ${stats.p99}ms | Max: ${stats.max}ms`);

    expect(stats.p90).toBeLessThanOrEqual(2000);
  });

  it('Scenario 3: Catalog retrieval responsiveness under concurrent load (100 requests)', async () => {
    const REQUEST_COUNT = 100;
    const latencies = [];

    const tasks = Array.from({ length: REQUEST_COUNT }, async () => {
      const start = process.hrtime.bigint();
      const res = await request(app)
        .get('/api/quizzes')
        .set('Authorization', `Bearer ${testUserToken}`);
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

      latencies.push(durationMs);
      allSystemLatencies.push(durationMs);

      if (res.status === 500) total500Errors++;
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.quizzes)).toBe(true);
    });

    await Promise.all(tasks);

    const stats = calculatePercentiles(latencies);
    console.log(`\n--- Quiz Catalog Benchmark (${REQUEST_COUNT} concurrent requests) ---`);
    console.log(`Min: ${stats.min}ms | Avg: ${stats.avg}ms | p50: ${stats.p50}ms | p90: ${stats.p90}ms | p99: ${stats.p99}ms | Max: ${stats.max}ms`);

    expect(stats.p90).toBeLessThanOrEqual(2000);
  });

  it('Scenario 4: End-to-end quiz attempt and submission under load (50 students)', async () => {
    const STUDENT_COUNT = 50;
    const latencies = [];

    // Pre-create 50 students with tokens
    const students = await Promise.all(
      Array.from({ length: STUDENT_COUNT }, async (_, i) => {
        const student = await User.create({
          name: `Student ${i}`,
          email: `student_${i}_${Date.now()}@pes.edu`,
          password: 'HashedPassword123',
          role: 'student',
          isVerified: true,
        });
        const token = jwt.sign(
          { id: student._id.toString(), role: 'student', email: student.email },
          JWT_SECRET,
          { expiresIn: '1h' }
        );
        return { student, token };
      })
    );

    // Each student concurrently starts an attempt and immediately submits answers
    const tasks = students.map(async ({ token }) => {
      // 1. Start attempt
      const startTimer = process.hrtime.bigint();
      const startRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${token}`);
      const startDurationMs = Number(process.hrtime.bigint() - startTimer) / 1e6;

      latencies.push(startDurationMs);
      allSystemLatencies.push(startDurationMs);
      if (startRes.status === 500) total500Errors++;
      expect(startRes.status).toBe(201);

      const attemptId = startRes.body.attempt.id;

      // 2. Submit attempt
      const submitTimer = process.hrtime.bigint();
      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          responses: [
            { question: testQuestions[0]._id.toString(), selectedOption: 'O(n log n)' },
            { question: testQuestions[1]._id.toString(), selectedOption: 'Stack' },
          ],
        });
      const submitDurationMs = Number(process.hrtime.bigint() - submitTimer) / 1e6;

      latencies.push(submitDurationMs);
      allSystemLatencies.push(submitDurationMs);
      if (submitRes.status === 500) total500Errors++;
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.score).toBe(2);
    });

    await Promise.all(tasks);

    const stats = calculatePercentiles(latencies);
    console.log(`\n--- Quiz Attempt & Auto-Grading Benchmark (${STUDENT_COUNT * 2} requests) ---`);
    console.log(`Min: ${stats.min}ms | Avg: ${stats.avg}ms | p50: ${stats.p50}ms | p90: ${stats.p90}ms | p99: ${stats.p99}ms | Max: ${stats.max}ms`);

    expect(stats.p90).toBeLessThanOrEqual(2000);
  });

  it('TC-Perf-01 Summary: Overall System Response Time meets CSQP-NF-001 (p90 <= 2s, 0 HTTP 500 errors)', () => {
    expect(allSystemLatencies.length).toBeGreaterThanOrEqual(350);
    expect(total500Errors).toBe(0);

    const overallStats = calculatePercentiles(allSystemLatencies);
    console.log('\n================================================================');
    console.log('       CSQP-NF-001 / TC-Perf-01 SYSTEM PERFORMANCE BENCHMARK     ');
    console.log('================================================================');
    console.log(`Total Requests Tested:  ${allSystemLatencies.length}`);
    console.log(`HTTP 500 Server Errors: ${total500Errors}`);
    console.log(`Min Latency:            ${overallStats.min} ms`);
    console.log(`Average Latency:        ${overallStats.avg} ms`);
    console.log(`Median (p50):           ${overallStats.p50} ms`);
    console.log(`90th Percentile (p90):  ${overallStats.p90} ms  [Target: <= 2000 ms]`);
    console.log(`95th Percentile (p95):  ${overallStats.p95} ms`);
    console.log(`99th Percentile (p99):  ${overallStats.p99} ms`);
    console.log(`Max Latency:            ${overallStats.max} ms`);
    console.log('================================================================\n');

    expect(overallStats.p90).toBeLessThanOrEqual(2000);
  });
});
