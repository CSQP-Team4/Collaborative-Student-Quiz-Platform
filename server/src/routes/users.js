const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');

// GET /api/users/profile - Returns current user's profile details
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    let userDoc = null;
    if (mongoose.Types.ObjectId.isValid(req.user.id)) {
      userDoc = await User.findById(req.user.id)
        .select('name email role isVerified leaderboardOptIn usn department semester bio createdAt')
        .lean();
    }

    const mergedUser = userDoc
      ? { ...req.user, ...userDoc, id: userDoc._id ? userDoc._id.toString() : req.user.id }
      : req.user;

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully.',
      user: mergedUser,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile - Updates current user's profile details
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { name, usn, department, semester, bio } = req.body || {};
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof usn === 'string') {
      updates.usn = usn.trim();
    }
    if (typeof department === 'string') {
      updates.department = department.trim();
    }
    if (semester !== undefined) {
      const sem = parseInt(semester, 10);
      if (!isNaN(sem) && sem >= 1 && sem <= 8) {
        updates.semester = sem;
      }
    }
    if (typeof bio === 'string') {
      updates.bio = bio.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('name email role isVerified leaderboardOptIn usn department semester bio createdAt');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/change-password - Change current user's password
router.put('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'MISSING_FIELDS',
        message: 'Current password and new password are required.',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'WEAK_PASSWORD',
        message: 'New password must be at least 8 characters long.',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Incorrect current password.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await AuditLog.create({
      user: user._id,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: user._id,
      ipAddress: req.ip || '127.0.0.1',
      details: { email: user.email },
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users - List all users (Admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role isVerified usn department semester createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        isVerified: u.isVerified,
        usn: u.usn || '',
        department: u.department || '',
        semester: u.semester || 1,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id/role - Update user role (Admin only)
router.put('/:id/role', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!['student', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_ROLE',
        message: "Role must be 'student', 'instructor', or 'admin'.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'ROLE_UPDATED',
      resource: 'User',
      resourceId: user._id,
      ipAddress: req.ip || '127.0.0.1',
      details: { targetEmail: user.email, oldRole, newRole: role },
    });

    return res.status(200).json({
      success: true,
      message: `Role for ${user.email} updated to ${role}.`,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
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
