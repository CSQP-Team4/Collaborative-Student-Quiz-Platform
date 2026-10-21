const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const BCRYPT_SALT_ROUNDS = 10;
const VERIFICATION_CODE_EXPIRY_HOURS = 24;

// Allow config of college email suffix via env (e.g., .edu, .pes.edu), default to .edu
const COLLEGE_EMAIL_SUFFIX = (process.env.COLLEGE_EMAIL_SUFFIX || '.edu').toLowerCase();

/**
 * Validates whether the email matches the required college domain.
 */
function isCollegeEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.includes('@') && normalized.endsWith(COLLEGE_EMAIL_SUFFIX);
}

/**
 * Generates a 6-digit numeric OTP and a secure random hex token.
 */
function generateVerificationArtifacts() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000);
  return { code, token, expires };
}

/**
 * POST /api/auth/register
 * Request body: { name, email, password }
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Name, email, and password are required.',
        timestamp: new Date().toISOString(),
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Name must be at least 2 characters.',
        timestamp: new Date().toISOString(),
      });
    }

    if (!isCollegeEmail(email)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_COLLEGE_EMAIL',
        message: `Registration requires a valid college email ending in ${COLLEGE_EMAIL_SUFFIX}.`,
        timestamp: new Date().toISOString(),
      });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters and contain at least one letter and one number.',
        timestamp: new Date().toISOString(),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists.',
        timestamp: new Date().toISOString(),
      });
    }

    // Salt and hash password (CSQP-SR-002)
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { code, token, expires } = generateVerificationArtifacts();

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      isVerified: false,
      verificationCode: code,
      verificationToken: token,
      verificationExpires: expires,
    });

    // In production/staging, this would be sent via SMTP/SendGrid.
    // For test and local dev, we log and return instructions.
    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Registration successful! Please check your college email for your verification code.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
      },
      // Expose verificationCode and token only in non-production/test environments for automated E2E testing
      ...(process.env.NODE_ENV !== 'production' && {
        _devVerificationCode: code,
        _devVerificationToken: token,
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Registration failed due to an unexpected error.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/verify-email
 * Request body: { email, code } OR { token }
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code, token } = req.body;

    let user;

    if (token) {
      user = await User.findOne({
        verificationToken: token,
      }).select('+verificationToken +verificationExpires');
    } else if (email && code) {
      const normalizedEmail = email.trim().toLowerCase();
      user = await User.findOne({
        email: normalizedEmail,
      }).select('+verificationCode +verificationExpires');
    } else {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Provide either email and 6-digit code or a verification token.',
        timestamp: new Date().toISOString(),
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_VERIFICATION',
        message: 'Invalid verification code or email.',
        timestamp: new Date().toISOString(),
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Account is already verified. You can log in.',
        timestamp: new Date().toISOString(),
      });
    }

    // Check expiry
    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VERIFICATION_EXPIRED',
        message: 'Verification code has expired. Please request a new code.',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify matching code
    if (code && user.verificationCode !== code.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_VERIFICATION_CODE',
        message: 'Invalid verification code.',
        timestamp: new Date().toISOString(),
      });
    }

    // Activate account
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Email verified successfully! You can now log in.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Email verification failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/resend-verification
 * Request body: { email }
 */
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Email is required.',
        timestamp: new Date().toISOString(),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Per security best practices (CSQP-F-002), return 200 even if user doesn't exist
    // to prevent email enumeration attacks.
    if (!user) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'If an account exists with this email, a new verification code has been sent.',
        timestamp: new Date().toISOString(),
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'ALREADY_VERIFIED',
        message: 'This account is already verified. Please log in directly.',
        timestamp: new Date().toISOString(),
      });
    }

    const { code, token, expires } = generateVerificationArtifacts();
    user.verificationCode = code;
    user.verificationToken = token;
    user.verificationExpires = expires;
    await user.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'A fresh verification code has been sent to your email.',
      ...(process.env.NODE_ENV !== 'production' && {
        _devVerificationCode: code,
        _devVerificationToken: token,
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to resend verification code.',
      timestamp: new Date().toISOString(),
    });
  }
};
