const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../test-utils/testDb');

describe('CSQP-31: Password Reset API (TC-Auth-04 / AC-CSQP-F-004)', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function createTestUser(overrides = {}) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(overrides.password || 'InitialPassword1', salt);
    return User.create({
      name: overrides.name || 'Test Student',
      email: overrides.email || 'student@pes.edu',
      password: hashedPassword,
      role: 'student',
      isVerified: true,
      refreshTokens: ['mock_existing_refresh_token_session'],
      ...overrides,
    });
  }

  describe('POST /api/auth/forgot-password', () => {
    it('generates a 30-minute single-use reset token and dispatches email for existing user', async () => {
      const user = await createTestUser({ email: 'student@pes.edu' });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'student@pes.edu' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account exists with this email');
      expect(res.body._devResetToken).toBeDefined();

      const updatedUser = await User.findById(user._id).select('+resetPasswordToken +resetPasswordExpires');
      expect(updatedUser.resetPasswordToken).toBe(res.body._devResetToken);
      expect(updatedUser.resetPasswordExpires).toBeDefined();

      // Verify token expiration is approximately 30 minutes in future
      const expiresAt = new Date(updatedUser.resetPasswordExpires).getTime();
      const expectedAt = Date.now() + 30 * 60 * 1000;
      expect(Math.abs(expiresAt - expectedAt)).toBeLessThan(5000);
    });

    it('returns generic success message for non-existent email to prevent enumeration attacks', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@pes.edu' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account exists with this email');
      expect(res.body._devResetToken).toBeUndefined();
    });

    it('validates email presence', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('rejects weak password with 400 WEAK_PASSWORD', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'some_random_token',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WEAK_PASSWORD');
    });

    it('rejects invalid or non-existent token with 400 INVALID_OR_EXPIRED_RESET_TOKEN', async () => {
      await createTestUser();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid_non_existent_token_123',
          password: 'NewStrongPassword1',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_OR_EXPIRED_RESET_TOKEN');
    });

    it('rejects expired reset token (>30 minutes old)', async () => {
      const user = await createTestUser();
      user.resetPasswordToken = 'expired_token_xyz';
      user.resetPasswordExpires = new Date(Date.now() - 5 * 60 * 1000); // Expired 5 mins ago
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired_token_xyz',
          password: 'NewStrongPassword1',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_OR_EXPIRED_RESET_TOKEN');
    });

    it('successfully resets password, invalidates old sessions, clears token, and writes audit log', async () => {
      const user = await createTestUser({ email: 'student@pes.edu', password: 'OldPassword1' });

      // Request reset
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'student@pes.edu' });

      const resetToken = forgotRes.body._devResetToken;
      expect(resetToken).toBeDefined();

      // Submit new password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          email: 'student@pes.edu',
          password: 'BrandNewPassword1',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toContain('Password reset successful');

      // 1. Verify token is wiped (single-use enforced)
      const updatedUser = await User.findById(user._id).select(
        '+resetPasswordToken +resetPasswordExpires +refreshTokens'
      );
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();

      // 2. Verify all previous refresh tokens were revoked
      expect(updatedUser.refreshTokens).toEqual([]);

      // 3. Verify audit log entry was recorded
      const log = await AuditLog.findOne({ action: 'PASSWORD_RESET' });
      expect(log).toBeDefined();
      expect(log.details.email).toBe('student@pes.edu');

      // 4. Verify old password no longer logs in
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@pes.edu', password: 'OldPassword1' });
      expect(oldLoginRes.status).toBe(401);

      // 5. Verify new password logs in successfully
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@pes.edu', password: 'BrandNewPassword1' });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.accessToken).toBeDefined();

      // 6. Verify single-use token cannot be reused
      const reuseRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'AnotherPassword1',
        });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toBe('INVALID_OR_EXPIRED_RESET_TOKEN');
    });
  });
});
