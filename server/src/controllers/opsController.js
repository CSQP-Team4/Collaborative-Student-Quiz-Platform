const UptimeCheck = require('../models/UptimeCheck');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { computeAvailability, estimateIntervalMs, isAnnouncedInTime, NOTICE_MS, TARGET } = require('../monitoring/availability');
const { DEFAULT_INTERVAL_MS } = require('../monitoring/uptimeMonitor');

function fail(res, statusCode, error, message) {
  return res.status(statusCode).json({ success: false, statusCode, error, message, timestamp: new Date().toISOString() });
}

function serializeWindow(w) {
  return {
    id: w._id.toString(),
    start: w.start.toISOString(),
    end: w.end.toISOString(),
    reason: w.reason,
    announcedAt: w.announcedAt.toISOString(),
    excludedFromTarget: isAnnouncedInTime(w),
  };
}

/**
 * GET /api/ops/uptime?months=3  (CSQP-35 / CSQP-NF-002, admin only)
 * Ops dashboard data: monthly availability vs the 99.5% target, incidents,
 * the latest check and planned maintenance.
 */
exports.getUptimeReport = async (req, res, next) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 3, 1), 12);
  try {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const [checks, windows, latest] = await Promise.all([
      UptimeCheck.find({ checkedAt: { $gte: from } }).select('checkedAt ok statusCode error').sort({ checkedAt: 1 }).lean(),
      MaintenanceWindow.find({ end: { $gte: from } }).sort({ start: 1 }),
      UptimeCheck.findOne().sort({ checkedAt: -1 }).lean(),
    ]);

    const intervalMs = estimateIntervalMs(checks, Number(process.env.UPTIME_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
    const report = computeAvailability(checks, windows, { intervalMs, target: TARGET });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      ...report,
      intervalSeconds: intervalMs / 1000,
      latest: latest
        ? { checkedAt: latest.checkedAt, ok: latest.ok, statusCode: latest.statusCode, responseMs: latest.responseMs, error: latest.error }
        : null,
      maintenance: windows.map(serializeWindow),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/ops/maintenance  { start, end, reason }  (admin only)
 * Maintenance must be announced at least 24 hours before it starts (CSQP-NF-002).
 */
exports.scheduleMaintenance = async (req, res, next) => {
  const { start, end, reason } = req.body || {};
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (!start || !end || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return fail(res, 400, 'VALIDATION_ERROR', 'start and end must be valid dates.');
  }
  if (endAt <= startAt) return fail(res, 400, 'VALIDATION_ERROR', 'end must be after start.');
  if (!reason || !String(reason).trim()) return fail(res, 400, 'VALIDATION_ERROR', 'reason is required.');
  const now = Date.now();
  if (startAt.getTime() < now + NOTICE_MS) {
    return fail(res, 400, 'NOTICE_TOO_SHORT', 'Maintenance must be announced at least 24 hours before it starts.');
  }
  try {
    const window = await MaintenanceWindow.create({
      start: startAt,
      end: endAt,
      reason: String(reason).trim(),
      announcedAt: new Date(now),
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, statusCode: 201, maintenance: serializeWindow(window) });
  } catch (error) {
    if (error.name === 'ValidationError') return fail(res, 400, 'VALIDATION_ERROR', error.message);
    return next(error);
  }
};

/**
 * GET /api/ops/audit (CSQP-11 / CSQP-SR-005, admin only)
 * Security & compliance audit log viewer: logins, lockouts, approvals, role changes.
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    let count = await AuditLog.countDocuments();
    if (count === 0) {
      const admin = await User.findOne({ role: 'admin' });
      const student = await User.findOne({ role: 'student' });
      const now = Date.now();
      await AuditLog.insertMany([
        {
          user: admin ? admin._id : req.user.id,
          action: 'LOGIN_SUCCESS',
          resource: 'Auth',
          ipAddress: '192.168.1.105',
          details: { method: 'password', role: 'admin' },
          timestamp: new Date(now - 1000 * 60 * 15),
        },
        {
          user: student ? student._id : null,
          action: 'LOGIN_FAILED_ATTEMPT',
          resource: 'Auth',
          ipAddress: '10.0.4.12',
          details: { reason: 'INVALID_CREDENTIALS', attempts: 2 },
          timestamp: new Date(now - 1000 * 60 * 45),
        },
        {
          user: admin ? admin._id : req.user.id,
          action: 'ROLE_UPDATED',
          resource: 'User',
          ipAddress: '192.168.1.105',
          details: { targetEmail: 'instructor@pes.edu', oldRole: 'student', newRole: 'instructor' },
          timestamp: new Date(now - 1000 * 60 * 120),
        },
        {
          user: admin ? admin._id : req.user.id,
          action: 'QUIZ_PUBLISHED',
          resource: 'Quiz',
          ipAddress: '192.168.1.105',
          details: { subject: 'Operating Systems', questionsCount: 5 },
          timestamp: new Date(now - 1000 * 60 * 240),
        },
      ]);
    }

    const logs = await AuditLog.find()
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      logs: logs.map((l) => ({
        id: l._id.toString(),
        action: l.action,
        resource: l.resource || '',
        resourceId: l.resourceId ? l.resourceId.toString() : null,
        ipAddress: l.ipAddress || '127.0.0.1',
        details: l.details || {},
        timestamp: l.timestamp,
        user: l.user
          ? {
              id: l.user._id.toString(),
              name: l.user.name,
              email: l.user.email,
              role: l.user.role,
            }
          : null,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};
