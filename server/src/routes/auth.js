const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ipRateLimiter } = require('../middleware/rateLimiter');

// Apply IP-level rate limiting on login & registration routes (CSQP-11 / AC-SR-005)
router.post('/register', ipRateLimiter({ maxAttempts: 10 }), authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', ipRateLimiter({ maxAttempts: 5 }), authController.resendVerification);
router.post('/login', ipRateLimiter({ maxAttempts: 10 }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
