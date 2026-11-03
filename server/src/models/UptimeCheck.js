const mongoose = require('mongoose');

// CSQP-35 / CSQP-NF-002: one row per uptime probe of GET /api/health.
const uptimeCheckSchema = new mongoose.Schema({
  checkedAt: { type: Date, required: true, default: Date.now },
  ok: { type: Boolean, required: true },
  statusCode: { type: Number, default: null },
  responseMs: { type: Number, default: null },
  error: { type: String, default: '' },
  target: { type: String, default: '' },
});

// Serves the date-range queries and deletes rows after ~13 months, so a full
// year of monthly reports is always available without the collection growing forever.
uptimeCheckSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

module.exports = mongoose.model('UptimeCheck', uptimeCheckSchema);
