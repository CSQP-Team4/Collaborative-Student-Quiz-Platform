const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');
const { verifyPayloadIsAnswerFree } = require('../utils/antiCheat');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

describe('CSQP-23 & CSQP-24: Quiz Anti-Cheat & Single Attempt (TC-Att-03, TC-Att-04)', () => {
  let student1, student2, instructor, student1Token, student2Token, testQuiz, testQuestions;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Setup instructor
    instructor = await User.create({
      name: 'Prof Rao',
      email: 'instructor@pes.edu',
      password: 'HashedPassword1',
      role: 'instructor',
      isVerified: true,
    });

    // Setup two students
    student1 = await User.create({
      name: 'Asha Rao',
      email: 'asha@pes.edu',
      password: 'HashedPassword1',
      role: 'student',
      isVerified: true,
    });

    student2 = await User.create({
      name: 'Kiran Patel',
      email: 'kiran@pes.edu',
      password: 'HashedPassword1',
      role: 'student',
      isVerified: true,
    });

    student1Token = jwt.sign(
      { id: student1._id.toString(), email: student1.email, role: 'student', name: student1.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    student2Token = jwt.sign(
      { id: student2._id.toString(), email: student2.email, role: 'student', name: student2.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup 10 test approved questions with distinct options and answers
    const questionDocs = [];
    for (let i = 1; i <= 10; i++) {
      questionDocs.push({
        type: 'MCQ',
        text: `Question ${i}: What is the time complexity of operation ${i}?`,
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
        answer: 'O(log n)',
        subject: 'Algorithms',
        topic: 'Complexity',
        difficulty: 'medium',
        status: 'approved',
        createdBy: instructor._id,
      });
    }
    testQuestions = await Question.insertMany(questionDocs);

    // Setup published test quiz
    testQuiz = await Quiz.create({
      title: 'Algorithms Exam 1',
      subject: 'Algorithms',
      description: 'Midterm timed quiz',
      questions: testQuestions.map((q) => q._id),
      duration: 15, // 15 minutes
      createdBy: instructor._id,
      isPublished: true,
    });
  });

  describe('CSQP-23: Answer-Key Stripping (SAD 3.7 / AC-CSQP-F-032)', () => {
    it('strictly strips answers from payload when student starts an attempt', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attempt).toBeDefined();

      const questions = res.body.attempt.questions;
      expect(questions.length).toBe(10);

      // Verify each question has text and options, but absolutely NO answer field
      for (const q of questions) {
        expect(q.text).toBeDefined();
        expect(q.options).toBeDefined();
        expect(q.answer).toBeUndefined();
        expect(q.correctAnswer).toBeUndefined();
        expect(q.solution).toBeUndefined();
      }

      // Deep security assertion passes without error
      expect(() => verifyPayloadIsAnswerFree(res.body)).not.toThrow();
    });
  });

  describe('CSQP-23: Question & Option Order Randomization (TC-Att-03)', () => {
    it('delivers randomized question order or option order across attempts', async () => {
      const res1 = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      const res2 = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send();

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const qList1 = res1.body.attempt.questions.map((q) => q.question);
      const qList2 = res2.body.attempt.questions.map((q) => q.question);

      // With 10 items, probability of two random permutations being identical is 1 / 10! (1 in 3.6 million)
      expect(qList1).not.toEqual(qList2);

      // Verify options are also present in randomized order
      const opt1 = res1.body.attempt.questions[0].options;
      expect(opt1.length).toBe(4);
      expect(opt1).toEqual(expect.arrayContaining(['O(1)', 'O(n)', 'O(log n)', 'O(n^2)']));
    });
  });

  describe('CSQP-24: Single Active Attempt Concurrency Lock (AC-CSQP-F-033 / TC-Att-04)', () => {
    it('blocks a second concurrent attempt with 409 Conflict', async () => {
      // 1. Student starts initial attempt
      const firstRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      expect(firstRes.status).toBe(201);
      const attemptId = firstRes.body.attempt.id;

      // 2. Student attempts to start parallel attempt from another tab/device -> 409 Conflict
      const secondRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error).toBe('ACTIVE_ATTEMPT_EXISTS');
      expect(secondRes.body.activeAttemptId).toBe(attemptId);
    });

    it('allows resuming an existing active attempt with resume: true', async () => {
      const firstRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      const attemptId = firstRes.body.attempt.id;

      // Resume request
      const resumeRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ resume: true });

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.resumed).toBe(true);
      expect(resumeRes.body.attempt.id).toBe(attemptId);
    });

    it('auto-closes expired attempt as timed_out and permits starting new attempt', async () => {
      const firstRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      const attemptId = firstRes.body.attempt.id;

      // Manually simulate time expiration (started 20 mins ago on a 15-min quiz)
      await QuizAttempt.findByIdAndUpdate(attemptId, {
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
      });

      // Starting next attempt should auto-close old one and return 201
      const newAttemptRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      expect(newAttemptRes.status).toBe(201);

      // Verify old attempt status was marked timed_out
      const oldAttempt = await QuizAttempt.findById(attemptId);
      expect(oldAttempt.status).toBe('timed_out');
    });
  });

  describe('CSQP-23: Anti-Cheat Telemetry Logging', () => {
    it('records tab-switch, blur, and clipboard violations and flags for review', async () => {
      const startRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      const attemptId = startRes.body.attempt.id;

      // Event 1: Tab switch
      const ev1 = await request(app)
        .post(`/api/attempts/${attemptId}/anti-cheat`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ eventType: 'TAB_SWITCH', details: { target: 'another_tab' } });
      expect(ev1.status).toBe(200);
      expect(ev1.body.totalSecurityViolations).toBe(1);
      expect(ev1.body.flaggedForReview).toBe(false);

      // Event 2: Clipboard attempt
      await request(app)
        .post(`/api/attempts/${attemptId}/anti-cheat`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ eventType: 'CLIPBOARD_ATTEMPT', details: { action: 'paste' } });

      // Event 3: Window blur (3rd event crosses threshold)
      const ev3 = await request(app)
        .post(`/api/attempts/${attemptId}/anti-cheat`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ eventType: 'WINDOW_BLUR', details: {} });

      expect(ev3.status).toBe(200);
      expect(ev3.body.totalSecurityViolations).toBe(3);
      expect(ev3.body.flaggedForReview).toBe(true);

      const savedAttempt = await QuizAttempt.findById(attemptId);
      expect(savedAttempt.isFlaggedForReview).toBe(true);
      expect(savedAttempt.antiCheatEvents.length).toBe(3);
    });
  });

  describe('Quiz Submission & Instant Auto-Grading', () => {
    it('scores student responses, marks submitted, and locks attempt from further submission', async () => {
      const startRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send();

      const attemptId = startRes.body.attempt.id;
      const questions = startRes.body.attempt.questions;

      // Provide correct answer ('O(log n)') for first 6 questions, wrong for others
      const responses = questions.map((q, idx) => ({
        question: q.question,
        answer: idx < 6 ? 'O(log n)' : 'O(n^2)',
      }));

      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ responses });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.result.score).toBe(6);
      expect(submitRes.body.result.totalQuestions).toBe(10);
      expect(submitRes.body.result.status).toBe('submitted');

      // Attempting to submit again fails with 400
      const duplicateSubmit = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ responses });

      expect(duplicateSubmit.status).toBe(400);
      expect(duplicateSubmit.body.error).toBe('ATTEMPT_ALREADY_CLOSED');
    });
  });
});
