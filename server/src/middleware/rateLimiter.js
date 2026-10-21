// In-memory sliding-window IP rate limiter for auth routes
const ipAttempts = new Map();

/**
 * IP-level rate limiter:
 * Limits each IP to `maxAttempts` within `windowMs` (e.g., 20 attempts per 15 minutes).
 */
function ipRateLimiter({ windowMs = 15 * 60 * 1000, maxAttempts = 20 } = {}) {
  return (req, res, next) => {
    // In test environment, allow bypassing unless explicitly tested
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    let record = ipAttempts.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      ipAttempts.set(ip, record);
    } else {
      record.count += 1;
    }

    if (record.count > maxAttempts) {
      return res.status(429).json({
        success: false,
        statusCode: 429,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

module.exports = { ipRateLimiter };
