const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'csqp_dev_jwt_refresh_secret_key_change_in_production_32b';

describe('CSQP-8 & CSQP-9: Login & Refresh Token Rotation API (CSQP-F-002 & CSQP-SR-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login (CSQP-8 / TC-Auth-02)', () => {
    it('Returns signed JWT accessToken and user object with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword1', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Verified Student',
        email: 'student@pes.edu',
        password: hashedPassword,
        role: 'student',
        isVerified: true,
        refreshTokens: [],
        failedLoginAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@pes.edu',
          password: 'CorrectPassword1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Verified Student',
        email: 'student@pes.edu',
        role: 'student',
      });

      // Verify JWT payload and signature
      const decoded = jwt.verify(res.body.accessToken, JWT_SECRET);
      expect(decoded.email).toBe('student@pes.edu');
      expect(decoded.role).toBe('student');

      // Verify HttpOnly refresh token cookie is set (CSQP-9)
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);

      // Verify refresh token is saved on user
      expect(mockUser.refreshTokens.length).toBe(1);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('Rejects login with 401 and generic error if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword1', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'student@pes.edu',
        password: hashedPassword,
        failedLoginAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@pes.edu',
          password: 'WrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Incorrect email or password.');
      expect(mockUser.failedLoginAttempts).toBe(1);
    });

    it('Rejects login with 401 if user email does not exist (no email enumeration)', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@pes.edu',
          password: 'Password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Incorrect email or password.');
    });

    it('Blocks unverified users with 403 EMAIL_NOT_VERIFIED (AC-CSQP-F-001)', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword1', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'unverified@pes.edu',
        password: hashedPassword,
        isVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@pes.edu',
          password: 'CorrectPassword1',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('Blocks login with 429 if account is locked out', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'locked@pes.edu',
        lockUntil: new Date(Date.now() + 10 * 60 * 1000), // Locked for 10 more minutes
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@pes.edu',
          password: 'AnyPassword',
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('POST /api/auth/refresh (CSQP-9 / TC-Sec-03)', () => {
    it('Rotates the refresh token and returns new accessToken', async () => {
      const validRefreshToken = jwt.sign(
        { id: 'user_jwt_123', email: 'user@pes.edu' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      const mockUser = {
        _id: 'user_jwt_123',
        name: 'Token User',
        email: 'user@pes.edu',
        role: 'student',
        refreshTokens: [validRefreshToken],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${validRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();

      // Old token must be rotated out and replaced by a new one
      expect(mockUser.refreshTokens).not.toContain(validRefreshToken);
      expect(mockUser.refreshTokens.length).toBe(1);

      // New cookie must be set
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/refreshToken=/);
    });

    it('Detects token reuse, invalidates all sessions, and returns 403 (Reuse Detection)', async () => {
      const stolenToken = jwt.sign(
        { id: 'user_jwt_123', email: 'user@pes.edu' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // DB has active tokens, but NOT the stolen/already-used one
      const mockUser = {
        _id: 'user_jwt_123',
        email: 'user@pes.edu',
        refreshTokens: ['other_legit_token_1', 'other_legit_token_2'],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${stolenToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('TOKEN_REUSE_DETECTED');
      // All active tokens must be nuked for user security
      expect(mockUser.refreshTokens).toEqual([]);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('Rejects expired or malformed refresh tokens with 401 and clears cookie', async () => {
      const expiredToken = jwt.sign(
        { id: 'user_jwt_123', email: 'user@pes.edu' },
        JWT_REFRESH_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/refreshToken=;/);
    });

    it('Rejects refresh request without cookie with 401', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('Clears refresh token cookie and revokes token from DB', async () => {
      const token = jwt.sign({ id: 'user_123' }, JWT_REFRESH_SECRET);
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.status).toBe(204);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user_123', {
        $pull: { refreshTokens: token },
      });
      const cookie = res.headers['set-cookie'];
      expect(cookie[0]).toMatch(/refreshToken=;/);
    });
  });
});
