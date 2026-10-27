const nodemailer = require('nodemailer');

/**
 * Mailer service using Gmail SMTP (via Nodemailer) for transactional email dispatch.
 * Delivers verification OTP codes and one-click token verification links to any email.
 * Gracefully logs to terminal in local development or if credentials are not configured.
 */

let transporter = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass, // 16-character Google App Password (without spaces)
      },
    });
  }
  return transporter;
}

/**
 * Prints a clean formatted terminal box with email verification details
 * for local development and reviewer demonstration.
 */
function logDevEmailBox({ to, name, code, verificationLink, note }) {
  const width = 64;
  const line = '─'.repeat(width);
  console.log(`\n┌${line}┐`);
  console.log(`│ [EMAIL DISPATCH] ${note || 'Email Verification'} `.padEnd(width + 1) + '│');
  console.log(`├${line}┤`);
  console.log(`│ Recipient: ${to} (${name || 'Student'})`.padEnd(width + 1) + '│');
  console.log(`│ Verification OTP : ${code} `.padEnd(width + 1) + '│');
  console.log(`│ Direct Link      : ${verificationLink}`.padEnd(width + 1) + '│');
  console.log(`│ Valid For        : 24 Hours`.padEnd(width + 1) + '│');
  console.log(`└${line}┘\n`);
}

/**
 * Builds standard HTML email content for verification.
 */
function buildVerificationHtml({ name, code, verificationLink }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your CSQP Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background-color: #4f46e5; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;">Collaborative Student Quiz Platform</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="margin-top: 0; font-size: 18px; color: #1f2937;">Hello ${name || 'there'},</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">
        Welcome to CSQP! Please verify your college email address to activate your account.
      </p>

      <div style="margin: 28px 0; padding: 18px; background: #f3f4f6; border-radius: 6px; text-align: center;">
        <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.15em; color: #4f46e5; font-family: monospace;">${code}</span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #4b5563; text-align: center; margin-bottom: 24px;">
        Or click the button below to verify your account in one step:
      </p>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${verificationLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">Verify Email Address</a>
      </div>

      <p style="font-size: 13px; line-height: 1.5; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-bottom: 0;">
        This code and verification link will expire in 24 hours. If you did not sign up for CSQP, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends a verification email with code and link via Gmail SMTP.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email (can be any student email)
 * @param {string} options.name - Recipient full name
 * @param {string} options.code - 6-digit OTP code
 * @param {string} options.token - 24-hour verification token
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
async function sendVerificationEmail({ to, name, code, token }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationLink = `${clientUrl}/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

  // Skip actual network call in automated Jest tests to maintain test isolation and speed
  if (process.env.NODE_ENV === 'test') {
    return { success: true, mocked: true, code, token, verificationLink };
  }

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    logDevEmailBox({
      to,
      name,
      code,
      verificationLink,
      note: 'EMAIL_USER / EMAIL_PASS not set (Local Console Fallback)',
    });
    return { success: true, dispatched: false, reason: 'NO_CREDENTIALS' };
  }

  const senderName = process.env.EMAIL_FROM || 'Collaborative Quiz Platform';
  const senderAddress = process.env.EMAIL_USER;

  try {
    const info = await mailTransporter.sendMail({
      from: `"${senderName}" <${senderAddress}>`,
      to,
      subject: 'Verify your CSQP Account',
      html: buildVerificationHtml({ name, code, verificationLink }),
      text: `Hello ${name || 'there'},\n\nYour CSQP verification code is: ${code}\n\nOr verify directly at:\n${verificationLink}\n\nThis expires in 24 hours.`,
    });

    console.log(`[Gmail SMTP Success] Verification email sent to ${to} (Message ID: ${info.messageId})`);
    logDevEmailBox({
      to,
      name,
      code,
      verificationLink,
      note: `Sent via Gmail SMTP (ID: ${info.messageId})`,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Gmail SMTP Error] Failed to deliver email to ${to}:`, err.message);
    logDevEmailBox({
      to,
      name,
      code,
      verificationLink,
      note: 'Gmail SMTP Error Fallback',
    });
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendVerificationEmail,
  buildVerificationHtml,
  getTransporter,
};
