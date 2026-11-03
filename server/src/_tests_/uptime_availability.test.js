// CSQP-35 / CSQP-NF-002: availability maths, checked against hand calculations.
const { computeAvailability, estimateIntervalMs, isAnnouncedInTime } = require('../monitoring/availability');

const MIN = 60 * 1000;
const H = 60 * MIN;
const OCT1 = Date.UTC(2026, 9, 1); // 1 Oct 2026 00:00 UTC

// n checks one minute apart starting at `start`; `failAt` = indexes that fail
function checks(start, n, failAt = []) {
  const fails = new Set(failAt);
  return Array.from({ length: n }, (_, i) => ({
    checkedAt: new Date(start + i * MIN),
    ok: !fails.has(i),
    statusCode: fails.has(i) ? 500 : 200,
    error: fails.has(i) ? 'HTTP 500' : '',
  }));
}

describe('computeAvailability (CSQP-35)', () => {
  it('996 healthy of 1000 checks = 99.6%, meets the 99.5% target', () => {
    const { months, target } = computeAvailability(checks(OCT1, 1000, [10, 11, 12, 13]));
    expect(target).toBe(99.5);
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ month: '2026-10', checks: 1000, healthy: 996, failed: 4, availability: 99.6, meetsTarget: true });
  });

  it('994 of 1000 = 99.4%, misses the target', () => {
    const { months } = computeAvailability(checks(OCT1, 1000, [1, 2, 3, 4, 5, 6]));
    expect(months[0]).toMatchObject({ availability: 99.4, meetsTarget: false });
  });

  it('exactly 99.5% counts as meeting the target', () => {
    const { months } = computeAvailability(checks(OCT1, 1000, [1, 2, 3, 4, 5]));
    expect(months[0]).toMatchObject({ availability: 99.5, meetsTarget: true });
  });

  it('October allows 223.2 minutes of downtime (44,640 min x 0.5%)', () => {
    expect(computeAvailability(checks(OCT1, 10)).months[0].allowedDowntimeMinutes).toBe(223.2);
  });

  it('excludes maintenance announced at least 24 h ahead', () => {
    // 100 checks; checks 20-39 fail during a window from minute 20 to minute 40
    const data = checks(OCT1, 100, Array.from({ length: 20 }, (_, i) => 20 + i));
    const window = { start: new Date(OCT1 + 20 * MIN), end: new Date(OCT1 + 40 * MIN), announcedAt: new Date(OCT1 - 25 * H) };
    const { months, incidents } = computeAvailability(data, [window]);
    expect(months[0]).toMatchObject({ checks: 80, excluded: 20, failed: 0, availability: 100 });
    expect(incidents).toEqual([]);
  });

  it('does NOT exclude maintenance announced with less than 24 h notice', () => {
    const data = checks(OCT1, 100, Array.from({ length: 20 }, (_, i) => 20 + i));
    const late = { start: new Date(OCT1 + 20 * MIN), end: new Date(OCT1 + 40 * MIN), announcedAt: new Date(OCT1 - 2 * H) };
    const { months } = computeAvailability(data, [late]);
    expect(months[0]).toMatchObject({ checks: 100, excluded: 0, failed: 20, availability: 80 });
    expect(isAnnouncedInTime(late)).toBe(false);
  });

  it('groups consecutive failures into incidents with durations', () => {
    // fails at minutes 5,6,7 (back at 8) and 50 (back at 51)
    const { incidents, months } = computeAvailability(checks(OCT1, 60, [5, 6, 7, 50]));
    expect(incidents).toHaveLength(2);
    // newest first
    expect(incidents[0]).toMatchObject({ durationMinutes: 1, failedChecks: 1, ongoing: false });
    expect(incidents[1]).toMatchObject({
      start: new Date(OCT1 + 5 * MIN).toISOString(),
      end: new Date(OCT1 + 8 * MIN).toISOString(),
      durationMinutes: 3,
      failedChecks: 3,
      error: 'HTTP 500',
    });
    expect(months[0].downtimeMinutes).toBe(4);
  });

  it('marks an incident that is still happening as ongoing', () => {
    const { incidents } = computeAvailability(checks(OCT1, 10, [8, 9]));
    expect(incidents[0]).toMatchObject({ ongoing: true, failedChecks: 2, durationMinutes: 2 });
  });

  it('reports each month separately, newest first', () => {
    const sep = checks(Date.UTC(2026, 8, 30, 23, 58), 4, [0]); // 2 in Sept (1 fail), 2 in Oct
    const { months } = computeAvailability(sep);
    expect(months.map((m) => [m.month, m.checks, m.availability])).toEqual([
      ['2026-10', 2, 100],
      ['2026-09', 2, 50],
    ]);
  });

  it('handles no data', () => {
    expect(computeAvailability([])).toEqual({ target: 99.5, months: [], incidents: [] });
  });
});

describe('estimateIntervalMs (CSQP-35)', () => {
  it('uses the median gap between recent checks', () => {
    const times = [0, 2000, 4000, 6000, 30000, 32000].map((t) => ({ checkedAt: new Date(OCT1 + t) }));
    expect(estimateIntervalMs(times, 60000)).toBe(2000);
  });

  it('falls back when there are too few checks', () => {
    expect(estimateIntervalMs([{ checkedAt: new Date(OCT1) }], 60000)).toBe(60000);
  });
});
