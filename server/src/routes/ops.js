const express = require('express');
const opsController = require('../controllers/opsController');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

const router = express.Router();

// CSQP-35 / CSQP-NF-002: uptime report and planned maintenance (admins only)
router.get('/uptime', authenticateToken, authorizeRoles('admin'), opsController.getUptimeReport);
router.post('/maintenance', authenticateToken, authorizeRoles('admin'), opsController.scheduleMaintenance);

// CSQP-11 / CSQP-SR-005: audit log viewer (admins only)
router.get('/audit', authenticateToken, authorizeRoles('admin'), opsController.getAuditLogs);

module.exports = router;
