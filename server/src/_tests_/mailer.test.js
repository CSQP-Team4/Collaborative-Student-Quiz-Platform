const {
  buildVerificationHtml,
  sendVerificationEmail,
  buildPasswordResetHtml,
  sendPasswordResetEmail,
} = require('../utils/mailer');

describe('Mailer Service (Gmail SMTP)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('buildVerificationHtml', () => {
    it('renders the verification code and direct link in HTML template', () => {
      const html = buildVerificationHtml({
        name: 'Asha Rao',
        code: '654321',
        verificationLink: 'http://localhost:5173/verify-email?token=xyz123&email=asha%40pes.edu',
      });

      expect(html).toContain('Asha Rao');
      expect(html).toContain('654321');
      expect(html).toContain('http://localhost:5173/verify-email?token=xyz123&email=asha%40pes.edu');
      expect(html).toContain('Collaborative Student Quiz Platform');
    });

    it('falls back to "there" when name is not provided', () => {
      const html = buildVerificationHtml({
        code: '123456',
        verificationLink: 'http://localhost:5173/verify-email',
      });

      expect(html).toContain('Hello there,');
      expect(html).toContain('123456');
    });
  });

  describe('buildPasswordResetHtml', () => {
    it('renders the reset link and instructions in HTML template', () => {
      const html = buildPasswordResetHtml({
        name: 'John Doe',
        resetLink: 'http://localhost:5173/reset-password?token=reset123&email=john%40pes.edu',
      });

      expect(html).toContain('John Doe');
      expect(html).toContain('http://localhost:5173/reset-password?token=reset123&email=john%40pes.edu');
      expect(html).toContain('30 minutes');
    });
  });

  describe('sendVerificationEmail', () => {
    it('returns mocked success in test environment without network calls', async () => {
      process.env.NODE_ENV = 'test';
      const result = await sendVerificationEmail({
        to: 'student@pes.edu',
        name: 'Test Student',
        code: '112233',
        token: 'token999',
      });

      expect(result.success).toBe(true);
      expect(result.mocked).toBe(true);
      expect(result.code).toBe('112233');
      expect(result.verificationLink).toContain('token=token999');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('returns mocked success in test environment without network calls', async () => {
      process.env.NODE_ENV = 'test';
      const result = await sendPasswordResetEmail({
        to: 'student@pes.edu',
        name: 'Test Student',
        token: 'secret_token_123',
      });

      expect(result.success).toBe(true);
      expect(result.mocked).toBe(true);
      expect(result.token).toBe('secret_token_123');
      expect(result.resetLink).toContain('token=secret_token_123');
    });
  });
});
