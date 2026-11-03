// CSQP-35 / CSQP-NF-002: monthly availability from uptime checks.
// Pure functions (no database), so the maths is easy to test by hand.
//
// availability % = healthy checks / counted checks * 100, per calendar month (UTC).
// Checks inside a maintenance window are NOT counted, but only if the window
// was announced at least 24 hours before it started.

const TARGET = 99.5;
const NOTICE_MS = 24 * 60 * 60 * 1000;

function isAnnouncedInTime(window) {
  return new Date(window.announcedAt).getTime() <= new Date(window.start).getTime() - NOTICE_MS;
}

function inWindow(time, windows) {
  return windows.some((w) => time >= new Date(w.start).getTime() && time < new Date(w.end).getTime());
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function minutesInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return (Date.UTC(y, m, 1) - Date.UTC(y, m - 1, 1)) / 60000;
}

/**
 * Groups consecutive failed checks into incidents. An incident ends at the
 * next healthy check; if it is still ongoing, at the last failed check plus
 * one interval.
 */
function findIncidents(sortedChecks, windows, intervalMs) {
  const incidents = [];
  let current = null;
  for (const c of sortedChecks) {
    const t = new Date(c.checkedAt).getTime();
    if (inWindow(t, windows)) continue;
    if (!c.ok) {
      if (!current) current = { start: t, lastFail: t, failedChecks: 0, error: c.error || `HTTP ${c.statusCode}` };
      current.lastFail = t;
      current.failedChecks += 1;
    } else if (current) {
      incidents.push({ ...current, end: t, ongoing: false });
      current = null;
    }
  }
  if (current) incidents.push({ ...current, end: current.lastFail + intervalMs, ongoing: true });
  return incidents.map(({ start, end, failedChecks, error, ongoing }) => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    durationMinutes: Math.round(((end - start) / 60000) * 10) / 10,
    failedChecks,
    error,
    ongoing,
  }));
}

/**
 * @param checks   [{ checkedAt, ok, statusCode?, error? }]
 * @param windows  [{ start, end, announcedAt, reason }]
 * @param options  { intervalMs, target }
 * @returns monthly rows (newest first) plus incidents
 */
function computeAvailability(checks, windows = [], { intervalMs = 60000, target = TARGET } = {}) {
  const validWindows = windows.filter(isAnnouncedInTime);
  const sorted = [...checks].sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt));

  const months = new Map();
  for (const c of sorted) {
    const key = monthKey(c.checkedAt);
    if (!months.has(key)) months.set(key, { month: key, checks: 0, healthy: 0, failed: 0, excluded: 0 });
    const row = months.get(key);
    if (inWindow(new Date(c.checkedAt).getTime(), validWindows)) {
      row.excluded += 1;
    } else {
      row.checks += 1;
      if (c.ok) row.healthy += 1;
      else row.failed += 1;
    }
  }

  const incidents = findIncidents(sorted, validWindows, intervalMs);

  const rows = [...months.values()]
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .map((row) => {
      const availability = row.checks ? Math.round((row.healthy / row.checks) * 100000) / 1000 : null;
      const allowed = Math.round(minutesInMonth(row.month) * (1 - target / 100) * 10) / 10;
      const downtime = incidents
        .filter((i) => monthKey(i.start) === row.month)
        .reduce((sum, i) => sum + i.durationMinutes, 0);
      return {
        ...row,
        availability,
        meetsTarget: availability === null ? null : availability >= target,
        downtimeMinutes: Math.round(downtime * 10) / 10,
        allowedDowntimeMinutes: allowed,
      };
    });

  return { target, months: rows, incidents: incidents.reverse() };
}

/**
 * The monitor runs as its own process, so the API does not know its
 * interval. Estimate it from the median gap between recent checks.
 */
function estimateIntervalMs(sortedChecks, fallbackMs) {
  const recent = sortedChecks.slice(-21);
  const gaps = [];
  for (let i = 1; i < recent.length; i += 1) {
    gaps.push(new Date(recent[i].checkedAt) - new Date(recent[i - 1].checkedAt));
  }
  if (!gaps.length) return fallbackMs;
  gaps.sort((a, b) => a - b);
  return Math.round(gaps[Math.floor(gaps.length / 2)] / 1000) * 1000 || fallbackMs;
}

module.exports = { TARGET, NOTICE_MS, computeAvailability, estimateIntervalMs, isAnnouncedInTime, monthKey };
