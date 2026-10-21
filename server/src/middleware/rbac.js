const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

/**
 * Authentication Middleware:
 * Extracts Bearer token from Authorization header, validates signature and expiration,
 * and attaches decoded user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Access token is required. Please provide Authorization: Bearer <token>.',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      statusCode: 401,
      error: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired
        ? 'Access token has expired. Please refresh your session.'
        : 'Access token is invalid.',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware (CSQP-10 / CSQP-SR-004):
 * Ensures the authenticated user's role is in the allowedRoles list.
 * Supported roles: 'student', 'instructor', 'admin'.
 * Returns 403 Forbidden if unauthorized.
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required before authorization check.',
        timestamp: new Date().toISOString(),
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: 'FORBIDDEN',
        message: `Forbidden: role '${req.user.role}' does not have permission to access this resource.`,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
