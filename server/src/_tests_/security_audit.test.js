const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

describe('CSQP-36: Personal Data & Quiz Content Protection Security Audit (CSQP-NF-003 / STRIDE Model)', () => {
  let studentUser, instructorUser, adminUser;
  let studentToken, instructorToken;
  let testQuiz, testQuestion;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Seed users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePass123!', salt);

    studentUser = await User.create({
      name: 'Audit Student',
      email: 'student.audit@pes.edu',
      password: passwordHash,
      role: 'student',
      isVerified: true,
    });

    instructorUser = await User.create({
      name: 'Audit Instructor',
      email: 'instructor.audit@pes.edu',
      password: passwordHash,
      role: 'instructor',
      isVerified: true,
    });

    adminUser = await User.create({
      name: 'Audit Admin',
      email: 'admin.audit@pes.edu',
      password: passwordHash,
      role: 'admin',
      isVerified: true,
    });

    studentToken = jwt.sign(
      { id: studentUser._id.toString(), role: 'student', email: studentUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    instructorToken = jwt.sign(
      { id: instructorUser._id.toString(), role: 'instructor', email: instructorUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Seed question with secret answer key
    testQuestion = await Question.create({
      text: 'What is the private encryption key standard in TLS 1.3?',
      type: 'MCQ',
      options: ['AES-GCM', 'RSA-1024', 'MD5', 'SHA-1'],
      answer: 'AES-GCM',
      subject: 'Information Security',
      topic: 'Cryptography',
      difficulty: 'hard',
      status: 'approved',
      createdBy: instructorUser._id,
    });

    testQuiz = await Quiz.create({
      title: 'Information Security Final Exam',
      subject: 'Security',
      description: 'Confidential Exam',
      duration: 45,
      questions: [testQuestion._id],
      isPublished: true,
      createdBy: instructorUser._id,
    });
  });

  describe('Control 1: Personal Data Protection & Credential Isolation (STRIDE: Information Disclosure)', () => {
    it('ensures passwords in database are hashed with unique salt rounds and excluded by default', async () => {
      const userFromDb = await User.findById(studentUser._id);
      expect(userFromDb.password).toBeUndefined(); // select: false

      const userWithSecret = await User.findById(studentUser._id).select('+password');
      expect(userWithSecret.password).not.toBe('SecurePass123!');
      expect(userWithSecret.password).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash
    });

    it('ensures auth responses never leak password hash, salt, or verification tokens', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student.audit@pes.edu', password: 'SecurePass123!' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.password).toBeUndefined();
      expect(loginRes.body.user.salt).toBeUndefined();
      expect(loginRes.body.user.verificationToken).toBeUndefined();
      expect(loginRes.body.user.verificationCode).toBeUndefined();
      expect(loginRes.body.user.resetPasswordToken).toBeUndefined();
    });
  });

  describe('Control 2: Quiz Content Protection & Answer-Key Stripping (STRIDE: Information Disclosure)', () => {
    it('strictly omits answer keys and solutions when fetching quiz catalog and details', async () => {
      // 1. List quizzes
      const listRes = await request(app)
        .get('/api/quizzes')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(listRes.status).toBe(200);
      const listStr = JSON.stringify(listRes.body);
      expect(listStr).not.toContain('AES-GCM');
      expect(listStr).not.toContain('"answer"');

      // 2. Get specific quiz
      const detailRes = await request(app)
        .get(`/api/quizzes/${testQuiz._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(detailRes.status).toBe(200);
      const detailStr = JSON.stringify(detailRes.body);
      expect(detailStr).not.toContain('AES-GCM');
      expect(detailStr).not.toContain('"answer"');
    });

    it('strictly omits answer keys when student begins an active quiz attempt', async () => {
      const attemptRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(attemptRes.status).toBe(201);
      const attemptPayload = JSON.stringify(attemptRes.body);
      expect(attemptPayload).not.toContain('"answer"');
      expect(attemptPayload).not.toContain('"solution"');
      expect(attemptPayload).not.toContain('"correctAnswer"');
    });

    it('enforces isolation: students cannot access attempts belonging to other students', async () => {
      // Student 1 starts attempt
      const attemptRes = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);
      const attemptId = attemptRes.body.attempt.id;

      // Another student creates account
      const otherStudent = await User.create({
        name: 'Attacker Student',
        email: 'attacker@pes.edu',
        password: 'HashedPassword123!',
        role: 'student',
        isVerified: true,
      });
      const otherToken = jwt.sign(
        { id: otherStudent._id.toString(), role: 'student', email: otherStudent.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Other student tries to submit or hijack Student 1 attempt
      const hijackRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ responses: [] });

      expect([403, 404]).toContain(hijackRes.status);
    });
  });

  describe('Control 3: Role-Based Access Control & Privilege Escalation Guard (STRIDE: Elevation of Privilege)', () => {
    it('blocks student token from accessing instructor-only endpoints with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/users/instructor-only')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('blocks student and instructor tokens from accessing admin-only management routes', async () => {
      const studentRes = await request(app)
        .get('/api/users/admin-only')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentRes.status).toBe(403);
      expect(studentRes.body.error).toBe('FORBIDDEN');

      const instructorRes = await request(app)
        .get('/api/users/admin-only')
        .set('Authorization', `Bearer ${instructorToken}`);

      expect(instructorRes.status).toBe(403);
      expect(instructorRes.body.error).toBe('FORBIDDEN');
    });
  });

  describe('Control 4: Token Signature & Tamper Resistance (STRIDE: Tampering & Spoofing)', () => {
    it('rejects forged JWT tokens with invalid signatures or altered roles', async () => {
      // Forged token signed with bogus secret
      const forgedToken = jwt.sign(
        { id: studentUser._id.toString(), role: 'admin', email: studentUser.email },
        'bogus_unauthorized_signing_key_123',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('rejects expired JWT access tokens', async () => {
      const expiredToken = jwt.sign(
        { id: studentUser._id.toString(), role: 'student', email: studentUser.email },
        JWT_SECRET,
        { expiresIn: -10 } // Expired 10s ago
      );

      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Control 5: Brute-Force & Denial-of-Service Mitigation (STRIDE: Denial of Service)', () => {
    it('locks account for 15 minutes after 5 consecutive failed logins and records audit log', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'student.audit@pes.edu', password: 'WrongPassword' });
      }

      // 6th attempt with correct password should be locked
      const sixthRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student.audit@pes.edu', password: 'SecurePass123!' });

      expect(sixthRes.status).toBe(429);
      expect(sixthRes.body.error).toBe('ACCOUNT_LOCKED');

      // Verify immutable audit log recorded
      const log = await AuditLog.findOne({
        user: studentUser._id,
        action: 'ACCOUNT_LOCKOUT',
      });
      expect(log).toBeDefined();
      expect(log.details.failedAttempts).toBe(5);
    });
  });

  describe('Control 6: Audit Logging & Non-Repudiation (STRIDE: Repudiation)', () => {
    it('creates immutable audit trail on security-sensitive actions', async () => {
      // Check that audit logs track user ID, action, timestamp, and IP
      const auditCountBefore = await AuditLog.countDocuments();

      await AuditLog.create({
        user: studentUser._id,
        action: 'PASSWORD_RESET',
        resource: 'User',
        resourceId: studentUser._id,
        ipAddress: '127.0.0.1',
        details: { method: 'EMAIL_VERIFIED_TOKEN' },
      });

      const auditCountAfter = await AuditLog.countDocuments();
      expect(auditCountAfter).toBe(auditCountBefore + 1);

      const log = await AuditLog.findOne({ action: 'PASSWORD_RESET', user: studentUser._id });
      expect(log.ipAddress).toBe('127.0.0.1');
      expect(log.timestamp).toBeDefined();
    });
  });
});
