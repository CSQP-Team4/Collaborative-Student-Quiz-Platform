const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

const router = express.Router();

// CSQP-29 / CSQP-F-042: opt-in leaderboard
router.get('/', authenticateToken, leaderboardController.getLeaderboard);
router.get('/settings', authenticateToken, authorizeRoles('student'), leaderboardController.getSettings);
router.put('/settings', authenticateToken, authorizeRoles('student'), leaderboardController.updateSettings);

module.exports = router;
