const { buildVerificationHtml, sendVerificationEmail } = require('../utils/mailer');

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
});
