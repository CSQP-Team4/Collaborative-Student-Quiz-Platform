const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

// GET /api/users/profile - Accessible by any authenticated user (Student, Instructor, Admin)
router.get('/profile', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully.',
    user: req.user,
  });
});

// GET /api/users/instructor-only - Requires Instructor or Admin role
router.get(
  '/instructor-only',
  authenticateToken,
  authorizeRoles('instructor', 'admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Instructor resource accessed.',
    });
  }
);

// GET /api/users/admin-only - Requires Admin role only
router.get(
  '/admin-only',
  authenticateToken,
  authorizeRoles('admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Admin resource accessed.',
    });
  }
);

module.exports = router;
