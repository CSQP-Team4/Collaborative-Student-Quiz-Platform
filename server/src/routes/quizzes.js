const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

// Public / student browse routes
router.get('/quizzes', quizController.listPublishedQuizzes);
router.get('/quizzes/:id', quizController.getQuizById);

// Attempt lifecycle & anti-cheat routes (CSQP-F-032 & CSQP-F-033)
router.post(
  '/quizzes/:id/attempts',
  authenticateToken,
  authorizeRoles('student', 'admin'),
  quizController.startQuizAttempt
);

router.post(
  '/attempts/:id/anti-cheat',
  authenticateToken,
  quizController.recordAntiCheatEvent
);

router.post(
  '/attempts/:id/submit',
  authenticateToken,
  quizController.submitQuizAttempt
);

module.exports = router;
