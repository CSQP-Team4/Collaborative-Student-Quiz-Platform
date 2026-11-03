const mongoose = require('mongoose');

// CSQP-35 / CSQP-NF-002: planned maintenance. Downtime inside a window does
// not count against the 99.5% target IF it was announced 24 hours ahead.
const maintenanceWindowSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    announcedAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

maintenanceWindowSchema.index({ start: 1 });

module.exports = mongoose.model('MaintenanceWindow', maintenanceWindowSchema);
