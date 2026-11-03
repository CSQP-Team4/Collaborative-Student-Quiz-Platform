
const express = require('express');
const multer = require('multer');

const router = express.Router();
const questionImportController = require('../controllers/questionImportController');
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

module.exports = router;
