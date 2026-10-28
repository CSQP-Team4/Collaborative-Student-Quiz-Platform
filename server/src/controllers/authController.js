const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const BCRYPT_SALT_ROUNDS = 10;
const VERIFICATION_CODE_EXPIRY_HOURS = 24;

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'csqp_dev_jwt_refresh_secret_key_change_in_production_32b';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15-minute access token expiry per SRS/SAD
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

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
 * Generates signed JWT Access Token (15-min expiry)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generates signed JWT Refresh Token (7-day expiry) with unique jti to ensure rotation novelty
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      jti: crypto.randomBytes(16).toString('hex'),
    },
    JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );
}

/**
 * Attaches the refresh token cookie as HttpOnly, Secure (in production), SameSite: Strict
 */
function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * Clears the refresh token cookie
 */
function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * POST /api/auth/register (CSQP-7)
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

    // Dispatch verification email with code and link via Gmail SMTP
    await sendVerificationEmail({
      to: newUser.email,
      name: newUser.name,
      code,
      token,
    });

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
 * POST /api/auth/verify-email (CSQP-7)
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

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VERIFICATION_EXPIRED',
        message: 'Verification code has expired. Please request a new code.',
        timestamp: new Date().toISOString(),
      });
    }

    if (code && user.verificationCode !== code.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_VERIFICATION_CODE',
        message: 'Invalid verification code.',
        timestamp: new Date().toISOString(),
      });
    }

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
 * POST /api/auth/resend-verification (CSQP-7)
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

    // Dispatch fresh verification email with code and link via Gmail SMTP
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code,
      token,
    });

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

/**
 * POST /api/auth/login (CSQP-8 & CSQP-9)
 * Request body: { email, password }
 * Response: 200 OK { success, accessToken, user } + sets HttpOnly refreshToken cookie
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required.',
        timestamp: new Date().toISOString(),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user including password and refreshTokens
    const user = await User.findOne({ email: normalizedEmail })
      .select('+password +refreshTokens +lockUntil +failedLoginAttempts');

    // Generic error message to prevent enumeration (CSQP-F-002)
    const genericAuthError = () =>
      res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password.',
        timestamp: new Date().toISOString(),
      });

    if (!user) {
      return genericAuthError();
    }

    // Check account lockout (CSQP-11 / CSQP-SR-005)
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({
        success: false,
        statusCode: 429,
        error: 'ACCOUNT_LOCKED',
        message: 'Too many failed attempts. Your account is locked for 15 minutes.',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed login counter
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const willLock = user.failedLoginAttempts >= 5;

      if (willLock) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      }
      await user.save();

      // Audit Log on lockout (CSQP-11 / AC-SR-005)
      if (willLock) {
        try {
          await AuditLog.create({
            user: user._id,
            action: 'ACCOUNT_LOCKOUT',
            resource: 'User',
            resourceId: user._id,
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
            details: {
              email: user.email,
              failedAttempts: user.failedLoginAttempts,
              lockDurationMinutes: 15,
            },
          });
        } catch (auditErr) {
          console.error('AuditLog creation error on lockout:', auditErr.message);
        }
      }

      return genericAuthError();
    }

    // Check if account is verified (SRS AC-CSQP-F-001: Unverified accounts cannot log in)
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your college email address before logging in.',
        timestamp: new Date().toISOString(),
      });
    }

    // Reset failed login counter on success
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    // Generate tokens (CSQP-8: 15m access token, CSQP-9: 7d rotating refresh token)
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user's active session list
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    // Keep max 5 active devices/refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift();
    }
    await user.save();

    // Set HttpOnly cookie for refresh token (CSQP-SR-003)
    setRefreshTokenCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Login failed due to an unexpected error.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/refresh (CSQP-9 / CSQP-SR-003)
 * Rotates the refresh token: verifies current token, issues new token pair, and revokes old token.
 * Prevents reuse attacks: if a revoked token is used, all tokens for the user are invalidated.
 */
exports.refresh = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Refresh token cookie missing.',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is expired or invalid. Please log in again.',
        timestamp: new Date().toISOString(),
      });
    }

    // Find user with refreshTokens selected
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'USER_NOT_FOUND',
        message: 'User no longer exists.',
        timestamp: new Date().toISOString(),
      });
    }

    // REUSE DETECTION (CSQP-SR-003):
    // If incoming token is not found in active refreshTokens, token was compromised/replayed!
    if (!user.refreshTokens.includes(incomingRefreshToken)) {
      // Invalidate all tokens for this user for security
      user.refreshTokens = [];
      await user.save();
      clearRefreshTokenCookie(res);
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: 'TOKEN_REUSE_DETECTED',
        message: 'Invalid session token reuse detected. All sessions terminated. Please log in again.',
        timestamp: new Date().toISOString(),
      });
    }

    // Remove the used refresh token (rotation)
    user.refreshTokens = user.refreshTokens.filter((token) => token !== incomingRefreshToken);

    // Generate new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshTokens.push(newRefreshToken);
    await user.save();

    // Set new rotating cookie
    setRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Tokens renewed successfully.',
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Token refresh failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/logout (CSQP-9)
 * Clears the refresh token cookie and revokes it from DB
 */
exports.logout = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (incomingRefreshToken) {
      try {
        const decoded = jwt.decode(incomingRefreshToken);
        if (decoded && decoded.id) {
          await User.findByIdAndUpdate(decoded.id, {
            $pull: { refreshTokens: incomingRefreshToken },
          });
        }
      } catch (e) {
        // Ignore decode errors on logout
      }
    }

    clearRefreshTokenCookie(res);

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Logout failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/forgot-password (CSQP-31 / AC-CSQP-F-004)
 * Generates single-use 30-minute password reset token and dispatches email via Gmail SMTP
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'A valid email address is required.',
        timestamp: new Date().toISOString(),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Enumeration prevention: always return generic success message
    const genericSuccess = {
      success: true,
      statusCode: 200,
      message: 'If an account exists with this email, a password reset link has been sent.',
      timestamp: new Date().toISOString(),
    };

    if (!user) {
      return res.status(200).json(genericSuccess);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes per AC-CSQP-F-004

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    // Dispatch reset email via Gmail SMTP
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: resetToken,
    });

    return res.status(200).json({
      ...genericSuccess,
      ...(process.env.NODE_ENV !== 'production' && {
        _devResetToken: resetToken,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Password reset request failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/auth/reset-password (CSQP-31 / AC-CSQP-F-004)
 * Resets user password using single-use 30-minute token, invalidates old sessions & tokens
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Reset token and new password are required.',
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

    const query = {
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    };

    if (email) {
      query.email = email.trim().toLowerCase();
    }

    const user = await User.findOne(query).select(
      '+resetPasswordToken +resetPasswordExpires +password +refreshTokens'
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'Password reset link is invalid or has expired. Please request a new one.',
        timestamp: new Date().toISOString(),
      });
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Invalidate all existing sessions/refresh tokens across all devices
    user.refreshTokens = [];
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.isVerified = true;
    await user.save();

    // Security audit log entry
    try {
      await AuditLog.create({
        user: user._id,
        action: 'PASSWORD_RESET',
        resource: 'User',
        resourceId: user._id,
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        details: {
          email: user.email,
          message: 'Password successfully reset via single-use token.',
        },
      });
    } catch (auditErr) {
      console.error('AuditLog creation error on password reset:', auditErr.message);
    }

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Password reset successful! You can now log in with your new password.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Password reset failed.',
      timestamp: new Date().toISOString(),
    });
  }
};
