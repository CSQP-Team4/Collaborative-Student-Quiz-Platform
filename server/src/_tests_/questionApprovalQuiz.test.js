const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const { useSeededDatabase } = require('../test-utils/testDb');
const Question = require('../models/Question');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

function authFor(role) {
  const token = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: `${role}@test.local`, role, name: role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

// Each test uses its own subject so approved questions from one test cannot affect another.
function uniqueSubject() {
  return `Moderation Quiz ${new mongoose.Types.ObjectId().toString()}`;
}

function pendingQuestion(subject) {
  return Question.create({
    type: 'TRUE_FALSE',
    text: 'Pending questions must not enter quizzes?',
    answer: 'True',
    subject,
    topic: 'Moderation',
    difficulty: 'easy',
    status: 'pending',
    createdBy: new mongoose.Types.ObjectId(),
  });
}

const quizBase = (subject) => ({ title: 'Moderation quiz', subject, duration: 10, attemptCap: 1 });

describe('CSQP-18 / CSQP-F-023: unapproved questions stay out of quizzes (TC-QB-04)', () => {
  useSeededDatabase();

  it('manual quiz rejects a pending question, then accepts it once approved', async () => {
    const subject = uniqueSubject();
    const q = await pendingQuestion(subject);
    const body = { ...quizBase(subject), selectionMode: 'manual', questionIds: [q._id.toString()] };

    const before = await request(app)
      .post('/api/quizzes')
      .set('Authorization', authFor('instructor'))
      .send(body);
    expect(before.status).toBe(400);
    expect(before.body.error).toBe('INVALID_QUESTION_SELECTION');

    const approve = await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);

    const after = await request(app)
      .post('/api/quizzes')
      .set('Authorization', authFor('instructor'))
      .send(body);
    expect([200, 201]).toContain(after.status);
  });

  it('random quiz ignores pending questions until they are approved', async () => {
    const subject = uniqueSubject();
    const q = await pendingQuestion(subject);
    const body = { ...quizBase(subject), selectionMode: 'random', questionCount: 1 };

    const before = await request(app)
      .post('/api/quizzes')
      .set('Authorization', authFor('instructor'))
      .send(body);
    expect(before.status).toBe(400);
    expect(before.body.error).toBe('INSUFFICIENT_QUESTIONS');

    await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'approved' });

    const after = await request(app)
      .post('/api/quizzes')
      .set('Authorization', authFor('instructor'))
      .send(body);
    expect([200, 201]).toContain(after.status);
  });

  it('a rejected question stays out of quizzes', async () => {
    const subject = uniqueSubject();
    const q = await pendingQuestion(subject);
    await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'rejected' });

    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', authFor('instructor'))
      .send({ ...quizBase(subject), selectionMode: 'manual', questionIds: [q._id.toString()] });
    expect(res.status).toBe(400);
  });
});
