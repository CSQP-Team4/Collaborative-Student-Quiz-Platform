const UptimeCheck = require('../models/UptimeCheck');
const MaintenanceWindow = require('../models/MaintenanceWindow');
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
