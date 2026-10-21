const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

describe('CSQP-10: Role-Based Access Control (RBAC) Middleware (CSQP-F-003 & CSQP-SR-004)', () => {
  const studentToken = jwt.sign(
    { id: 'student_1', email: 's@pes.edu', role: 'student', name: 'Student 1' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const instructorToken = jwt.sign(
    { id: 'inst_1', email: 'inst@pes.edu', role: 'instructor', name: 'Instructor 1' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const adminToken = jwt.sign(
    { id: 'admin_1', email: 'admin@pes.edu', role: 'admin', name: 'Admin 1' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  describe('Authentication Enforcement (TC-Auth-03)', () => {
    it('Rejects requests without Authorization header with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('Rejects requests with invalid Bearer token with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_signature_token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('Allows any valid authenticated role to access general profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
    });
  });

  describe('Role-Based Authorization (TC-Sec-04 / AC-SR-004)', () => {
    it('Allows instructor to access instructor-only route', async () => {
      const res = await request(app)
        .get('/api/users/instructor-only')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Allows admin to access instructor-only route', async () => {
      const res = await request(app)
        .get('/api/users/instructor-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Denies student access to instructor-only route with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/users/instructor-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('Allows admin to access admin-only route', async () => {
      const res = await request(app)
        .get('/api/users/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('Denies instructor access to admin-only route with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/users/admin-only')
        .set('Authorization', `Bearer ${instructorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });
});

describe('CSQP-11: Account Lockout & Security Audit Log (CSQP-SR-005 / TC-Sec-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Locks account for 15 minutes after 5 consecutive failed attempts and logs audit event', async () => {
    const hashedPassword = await bcrypt.hash('CorrectPass1', 10);
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'target@pes.edu',
      password: hashedPassword,
      failedLoginAttempts: 4, // 5th failed attempt incoming
      isVerified: true,
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(User, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const auditSpy = jest.spyOn(AuditLog, 'create').mockResolvedValue({});

    // 5th failed login attempt
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'target@pes.edu', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(mockUser.failedLoginAttempts).toBe(5);
    expect(mockUser.lockUntil).toBeDefined();
    // Verify lock is set for ~15 minutes in the future
    expect(mockUser.lockUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    // Audit log must record the lockout event
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCOUNT_LOCKOUT',
        resource: 'User',
      })
    );
  });

  it('Rejects 6th consecutive attempt even with CORRECT credentials with 429 ACCOUNT_LOCKED', async () => {
    const hashedPassword = await bcrypt.hash('CorrectPass1', 10);
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'target@pes.edu',
      password: hashedPassword,
      failedLoginAttempts: 5,
      lockUntil: new Date(Date.now() + 15 * 60 * 1000), // Locked
      isVerified: true,
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(User, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'target@pes.edu', password: 'CorrectPass1' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ACCOUNT_LOCKED');
    expect(res.body.message).toMatch(/locked for 15 minutes/i);
  });

  it('Enforces IP-level rate limiting on auth routes when exceeded', async () => {
    // Send 11 requests with x-test-rate-limit header (limiter allows 10)
    let lastRes;
    for (let i = 0; i < 11; i++) {
      lastRes = await request(app)
        .post('/api/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({ email: 'rate@pes.edu', password: 'any' });
    }

    expect(lastRes.status).toBe(429);
    expect(lastRes.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});
