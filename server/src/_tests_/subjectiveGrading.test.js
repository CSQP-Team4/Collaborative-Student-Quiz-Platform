const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const { useSeededDatabase } = require('../test-utils/testDb');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

function authFor(role) {
  const token = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: `${role}@test.local`, role, name: role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

// One short-answer response (pending or graded) plus one graded MCQ; score starts at 1.
async function makeAttempt({ pending = true } = {}) {
  const subject = `Grading ${new mongoose.Types.ObjectId()}`;
  const base = {
    subject,
    topic: 'Grading',
    difficulty: 'easy',
    status: 'approved',
    createdBy: new mongoose.Types.ObjectId(),
  };
  const essay = await Question.create({
    ...base,
    type: 'SUBJECTIVE',
    text: 'Explain paging.',
    answer: 'Paging splits memory into fixed-size pages.',
  });
  const mcq = await Question.create({
    ...base,
    type: 'MCQ',
    text: 'Pick B',
    options: ['A', 'B'],
    answer: 'B',
  });
  const quiz = await Quiz.create({
    title: 'Grading quiz',
    subject,
    questions: [essay._id, mcq._id],
    duration: 10,
    createdBy: base.createdBy,
  });
  const attempt = await QuizAttempt.create({
    student: new mongoose.Types.ObjectId(),
    quiz: quiz._id,
    status: 'submitted',
    responses: [
      {
        question: essay._id,
        answer: 'Memory is split into pages.',
        gradingStatus: pending ? 'Pending Review' : 'Graded',
      },
      { question: mcq._id, answer: 'B', gradingStatus: 'Graded' },
    ],
    score: 1,
    shuffledQuestions: [
      { question: essay._id, text: essay.text, type: 'SUBJECTIVE' },
      { question: mcq._id, text: mcq.text, type: 'MCQ', options: ['A', 'B'] },
    ],
    submittedAt: new Date(),
  });
  return { attempt, essay, mcq };
}

const gradeUrl = (attempt, question) =>
  `/api/attempts/${attempt._id}/responses/${question._id}/grade`;

describe('CSQP-25: subjective answer grading queue', () => {
  useSeededDatabase();

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app).get('/api/grading/queue');
    expect(res.status).toBe(401);
  });

  it('students cannot view the queue or grade answers (403)', async () => {
    const { attempt, essay } = await makeAttempt();

    const queue = await request(app)
      .get('/api/grading/queue')
      .set('Authorization', authFor('student'));
    expect(queue.status).toBe(403);

    const grade = await request(app)
      .patch(gradeUrl(attempt, essay))
      .set('Authorization', authFor('student'))
      .send({ marks: 1 });
    expect(grade.status).toBe(403);

    const unchanged = await QuizAttempt.findById(attempt._id);
    expect(unchanged.score).toBe(1);
  });

  it('lists only attempts that have Pending Review items', async () => {
    const pendingOne = await makeAttempt({ pending: true });
    const gradedOne = await makeAttempt({ pending: false });

    const res = await request(app)
      .get('/api/grading/queue')
      .set('Authorization', authFor('instructor'));

    expect(res.status).toBe(200);
    const found = res.body.attempts.find((a) => a.id === pendingOne.attempt._id.toString());
    expect(found).toBeDefined();
    expect(found.pendingReviewCount).toBe(1);
    expect(found.pendingResponses[0].questionId).toBe(pendingOne.essay._id.toString());
    expect(found.pendingResponses[0].studentAnswer).toBe('Memory is split into pages.');
    expect(found.pendingResponses[0].modelAnswer).toMatch(/fixed-size pages/);
    expect(found.pendingResponses[0].maxMarks).toBe(1);
    expect(res.body.attempts.find((a) => a.id === gradedOne.attempt._id.toString())).toBeUndefined();
  });

  it('grading saves the marks and updates the total score', async () => {
    const { attempt, essay } = await makeAttempt();

    const res = await request(app)
      .patch(gradeUrl(attempt, essay))
      .set('Authorization', authFor('instructor'))
      .send({ marks: 0.5 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1.5);
    expect(res.body.totalQuestions).toBe(2);
    expect(res.body.percentage).toBe(75);
    expect(res.body.pendingReviewCount).toBe(0);

    const saved = await QuizAttempt.findById(attempt._id);
    expect(saved.score).toBe(1.5);
    const response = saved.responses.find((r) => r.question.toString() === essay._id.toString());
    expect(response.gradingStatus).toBe('Graded');
    expect(response.marks).toBe(0.5);

    const queue = await request(app)
      .get('/api/grading/queue')
      .set('Authorization', authFor('instructor'));
    expect(queue.body.attempts.find((a) => a.id === attempt._id.toString())).toBeUndefined();
  });

  it('rejects marks outside the allowed range (400)', async () => {
    const { attempt, essay } = await makeAttempt();

    for (const marks of [-1, 2, 'abc', null]) {
      const res = await request(app)
        .patch(gradeUrl(attempt, essay))
        .set('Authorization', authFor('instructor'))
        .send({ marks });
      expect(res.status).toBe(400);
    }
    expect((await QuizAttempt.findById(attempt._id)).score).toBe(1);
  });

  it('cannot grade the same answer twice (409)', async () => {
    const { attempt, essay } = await makeAttempt();

    const first = await request(app)
      .patch(gradeUrl(attempt, essay))
      .set('Authorization', authFor('instructor'))
      .send({ marks: 1 });
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(gradeUrl(attempt, essay))
      .set('Authorization', authFor('instructor'))
      .send({ marks: 1 });
    expect(second.status).toBe(409);
    expect((await QuizAttempt.findById(attempt._id)).score).toBe(2);
  });

  it('cannot grade an objective response (409)', async () => {
    const { attempt, mcq } = await makeAttempt();
    const res = await request(app)
      .patch(gradeUrl(attempt, mcq))
      .set('Authorization', authFor('instructor'))
      .send({ marks: 1 });
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown attempt or a question outside the attempt', async () => {
    const { attempt } = await makeAttempt();

    const noAttempt = await request(app)
      .patch(`/api/attempts/${new mongoose.Types.ObjectId()}/responses/${new mongoose.Types.ObjectId()}/grade`)
      .set('Authorization', authFor('instructor'))
      .send({ marks: 1 });
    expect(noAttempt.status).toBe(404);

    const noQuestion = await request(app)
      .patch(`/api/attempts/${attempt._id}/responses/${new mongoose.Types.ObjectId()}/grade`)
      .set('Authorization', authFor('instructor'))
      .send({ marks: 1 });
    expect(noQuestion.status).toBe(404);
  });
});
