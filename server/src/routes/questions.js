
const express = require('express');
const multer = require('multer');

const router = express.Router();
const questionImportController = require('../controllers/questionImportController');
const questionController = require('../controllers/questionController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/rbac');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const questionManager = [
  authenticateToken,
  authorizeRoles('instructor', 'admin'),
];

const questionContributor = [
  authenticateToken,
  authorizeRoles('student', 'instructor', 'admin'),
];

// CSQP-F-020: contribute a question to the shared bank.
router.post(
  '/questions',
  ...questionContributor,
  questionController.createQuestion
);

router.post(
  '/questions/import',
  ...questionManager,
  upload.single('file'),
  questionImportController.importQuestions
);

router.get(
  '/questions/export',
  ...questionManager,
  questionImportController.exportQuestions
);

router.get(
  '/questions',
  ...questionManager,
  questionImportController.listQuestions
);

module.exports = router;
