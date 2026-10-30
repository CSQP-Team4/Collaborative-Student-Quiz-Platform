const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

const router = express.Router();

// CSQP-27 / CSQP-F-040: student performance dashboard
router.get('/me', authenticateToken, authorizeRoles('student'), analyticsController.getMyPerformance);

// CSQP-28 / CSQP-F-041: instructor class analytics
router.get(
  '/class',
  authenticateToken,
  authorizeRoles('instructor', 'admin'),
  analyticsController.getClassAnalytics,
);

module.exports = router;
