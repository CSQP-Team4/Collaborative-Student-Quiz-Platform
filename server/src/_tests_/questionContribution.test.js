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

const validQuestion = {
  type: 'MCQ',
  text: 'Which scheduling algorithm is preemptive?',
  options: ['FCFS', 'Round Robin', 'None of these'],
  answer: 'Round Robin',
  subject: 'Operating Systems',
  topic: 'Scheduling',
  difficulty: 'medium',
};

describe('CSQP-17 / CSQP-F-020: question contribution (TC-QB-01)', () => {
  useSeededDatabase();

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app).post('/api/questions').send(validQuestion);
    expect(res.status).toBe(401);
  });

  it('instructor adds a question: 201 { id, status: approved }', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('instructor'))
      .send(validQuestion);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('approved');
  });

  it('student question is stored as pending', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('student'))
      .send(validQuestion);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    const saved = await Question.findById(res.body.id);
    expect(saved.status).toBe('pending');
    expect(saved.subject).toBe('Operating Systems');
    expect(saved.topic).toBe('Scheduling');
    expect(saved.difficulty).toBe('medium');
  });

  it('student cannot choose their own status', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('student'))
      .send({ ...validQuestion, status: 'approved' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('rejects a question with a missing tag (400)', async () => {
    const { topic, ...withoutTopic } = validQuestion;
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('student'))
      .send(withoutTopic);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/topic/);
  });

  it('rejects an MCQ whose answer is not an option (400)', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('student'))
      .send({ ...validQuestion, answer: 'Not listed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('instructor can list pending questions; student cannot', async () => {
    await request(app)
      .post('/api/questions')
      .set('Authorization', authFor('student'))
      .send(validQuestion);

    const list = await request(app)
      .get('/api/questions?status=pending')
      .set('Authorization', authFor('instructor'));
    expect(list.status).toBe(200);
    expect(list.body.questions.length).toBeGreaterThan(0);
    expect(list.body.questions.every((q) => q.status === 'pending')).toBe(true);

    const forbidden = await request(app)
      .get('/api/questions?status=pending')
      .set('Authorization', authFor('student'));
    expect(forbidden.status).toBe(403);
  });
});
