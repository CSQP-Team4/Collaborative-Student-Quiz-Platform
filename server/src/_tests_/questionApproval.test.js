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

async function pendingQuestion() {
  return Question.create({
    type: 'MCQ',
    text: 'Approval queue test question?',
    options: ['A', 'B', 'C'],
    answer: 'B',
    subject: 'Queue Testing',
    topic: 'Moderation',
    difficulty: 'easy',
    status: 'pending',
    createdBy: new mongoose.Types.ObjectId(),
  });
}

describe('CSQP-18 / CSQP-F-023: instructor approval queue (TC-QB-04)', () => {
  useSeededDatabase();

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app).get('/api/questions/pending');
    expect(res.status).toBe(401);
  });

  it('students cannot view the queue or change a status (403)', async () => {
    const q = await pendingQuestion();

    const list = await request(app)
      .get('/api/questions/pending')
      .set('Authorization', authFor('student'));
    expect(list.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('student'))
      .send({ status: 'approved' });
    expect(patch.status).toBe(403);

    const unchanged = await Question.findById(q._id);
    expect(unchanged.status).toBe('pending');
  });

  it('instructor sees pending questions in the queue', async () => {
    const q = await pendingQuestion();
    const res = await request(app)
      .get('/api/questions/pending')
      .set('Authorization', authFor('instructor'));

    expect(res.status).toBe(200);
    expect(res.body.questions.every((item) => item.status === 'pending')).toBe(true);
    const found = res.body.questions.find((item) => item.id === q._id.toString());
    expect(found).toBeDefined();
    expect(found.answer).toBe('B');
  });

  it('instructor approves a question and it leaves the queue', async () => {
    const q = await pendingQuestion();
    const res = await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const saved = await Question.findById(q._id);
    expect(saved.status).toBe('approved');
    expect(saved.reviewedBy).toBeTruthy();

    const queue = await request(app)
      .get('/api/questions/pending')
      .set('Authorization', authFor('instructor'));
    expect(queue.body.questions.find((item) => item.id === q._id.toString())).toBeUndefined();
  });

  it('instructor rejects a question', async () => {
    const q = await pendingQuestion();
    const res = await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect((await Question.findById(q._id)).status).toBe('rejected');
  });

  it('rejects an invalid status (400)', async () => {
    const q = await pendingQuestion();
    const res = await request(app)
      .patch(`/api/questions/${q._id}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown question and 400 for a malformed id', async () => {
    const missing = await request(app)
      .patch(`/api/questions/${new mongoose.Types.ObjectId()}/status`)
      .set('Authorization', authFor('instructor'))
      .send({ status: 'approved' });
    expect(missing.status).toBe(404);

    const bad = await request(app)
      .patch('/api/questions/not-an-id/status')
      .set('Authorization', authFor('instructor'))
      .send({ status: 'approved' });
    expect(bad.status).toBe(400);
  });
});
