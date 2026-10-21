const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');

describe('CSQP-7: Registration & Verification API (CSQP-F-001 & CSQP-SR-002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('TC-Auth-01: Registers a user with a valid college email and hashes password', async () => {
      // Mock User.findOne to return null (no existing user)
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      let createdDoc = null;
      jest.spyOn(User, 'create').mockImplementation(async (data) => {
        createdDoc = {
          _id: '507f1f77bcf86cd799439011',
          ...data,
        };
        return createdDoc;
      });

      const payload = {
        name: 'John Student',
        email: 'john.student@pes.edu',
        password: 'Password123',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.isVerified).toBe(false);
      expect(res.body.user.email).toBe('john.student@pes.edu');

      // TC-Sec-02: Password must NOT be stored in plaintext and must be bcrypt-hashed
      expect(createdDoc.password).not.toBe(payload.password);
      const isMatch = await bcrypt.compare(payload.password, createdDoc.password);
      expect(isMatch).toBe(true);

      // Verification code must exist and expire in ~24h
      expect(createdDoc.verificationCode).toMatch(/^\d{6}$/);
      expect(createdDoc.verificationToken).toBeDefined();
      expect(new Date(createdDoc.verificationExpires).getTime()).toBeGreaterThan(Date.now());
    });

    it('Rejects registration with non-college email address', async () => {
      const payload = {
        name: 'Attacker User',
        email: 'attacker@gmail.com',
        password: 'Password123',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_COLLEGE_EMAIL');
    });

    it('Rejects duplicate registration with existing email', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: 'existing123',
        email: 'duplicate@pes.edu',
      });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Second User',
        email: 'duplicate@pes.edu',
        password: 'Password456',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('Enforces password complexity requirements (min 8 chars, letter + number)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Short Pass',
        email: 'short@pes.edu',
        password: 'pass',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WEAK_PASSWORD');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('Verifies account with correct 6-digit OTP code', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'verify@pes.edu',
        isVerified: false,
        verificationCode: '123456',
        verificationExpires: new Date(Date.now() + 100000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@pes.edu',
          code: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.isVerified).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('Verifies account using the token from verification link', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'link@pes.edu',
        isVerified: false,
        verificationToken: 'securehex123',
        verificationExpires: new Date(Date.now() + 100000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'securehex123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.isVerified).toBe(true);
    });

    it('Rejects invalid verification code', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'wrong@pes.edu',
        isVerified: false,
        verificationCode: '654321',
        verificationExpires: new Date(Date.now() + 100000),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'wrong@pes.edu',
          code: '000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_VERIFICATION_CODE');
    });

    it('Rejects expired verification code', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'expired@pes.edu',
        isVerified: false,
        verificationCode: '123456',
        verificationExpires: new Date(Date.now() - 100000), // Expired
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'expired@pes.edu',
          code: '123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VERIFICATION_EXPIRED');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('Generates and sends a new verification code for unverified users', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'resend@pes.edu',
        isVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'resend@pes.edu' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.verificationCode).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
