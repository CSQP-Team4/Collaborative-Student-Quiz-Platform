
const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

// CSQP-21: Start a quiz attempt.
router.post(
  '/quizzes/:id/start',
  authenticateToken,
  authorizeRoles('student', 'admin'),
  quizController.startQuizAttempt
);

// CSQP-20: Create a quiz from manually selected or randomly sampled questions.
router.post(
  '/quizzes',
  authenticateToken,
  authorizeRoles('instructor', 'admin'),
  quizController.createQuiz
);

// Public / student browse routes
router.get('/quizzes', quizController.listPublishedQuizzes);
router.get('/quizzes/:id', quizController.getQuizById);

// Attempt lifecycle & anti-cheat routes
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

// Existing submission endpoint
router.post(
  '/attempts/:id/submit',
  authenticateToken,
  quizController.submitQuizAttempt
);

// CSQP-22: Submit and auto-grade a quiz attempt.
router.post(
  '/quizzes/:id/submit',
  authenticateToken,
  authorizeRoles('student', 'admin'),
  quizController.submitQuizAttempt
);

module.exports = router;
